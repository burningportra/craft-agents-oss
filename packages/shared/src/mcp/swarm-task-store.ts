/**
 * Swarm Task Store - In-process MCP server for multi-agent coordination
 *
 * Provides shared task management and messaging tools that enable swarm-style
 * coordination between parent and sub-agents. All state is in-memory,
 * scoped per session, and shared across agents in the same Node.js process.
 *
 * Tools:
 * - SwarmTaskCreate: Create a new task with title, description, optional dependencies
 * - SwarmTaskList: List all tasks, filterable by status/owner
 * - SwarmTaskGet: Get full details of a single task
 * - SwarmTaskUpdate: Claim ownership, change status, add comments
 * - SwarmSendMessage: Send a message to a specific agent or broadcast
 * - SwarmReadMessages: Read messages filtered by recipient and/or since timestamp
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { debug } from '../utils/debug.ts';

// ============================================================
// Data Types
// ============================================================

export interface SwarmTask {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  owner?: string;
  dependencies: string[];
  comments: { author: string; text: string; timestamp: number }[];
  createdAt: number;
  updatedAt: number;
}

export interface SwarmMessage {
  id: string;
  from: string;
  to?: string;
  content: string;
  timestamp: number;
}

// ============================================================
// Per-session state
// ============================================================

interface SwarmSessionState {
  tasks: Map<string, SwarmTask>;
  messages: SwarmMessage[];
}

const sessionStates = new Map<string, SwarmSessionState>();

function getState(sessionId: string): SwarmSessionState {
  let state = sessionStates.get(sessionId);
  if (!state) {
    state = { tasks: new Map(), messages: [] };
    sessionStates.set(sessionId, state);
  }
  return state;
}

// ============================================================
// Tools
// ============================================================

function createSwarmTaskCreateTool(sessionId: string) {
  return tool(
    'SwarmTaskCreate',
    'Create a new task in the swarm task store. Returns the created task with its ID.',
    {
      title: z.string().describe('Short title for the task'),
      description: z.string().describe('Detailed description of what needs to be done'),
      dependencies: z.array(z.string()).optional().describe('Task IDs that must complete before this task can start'),
    },
    async (args) => {
      const state = getState(sessionId);
      const task: SwarmTask = {
        id: randomUUID().slice(0, 8),
        title: args.title,
        description: args.description,
        status: 'todo',
        dependencies: args.dependencies ?? [],
        comments: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      state.tasks.set(task.id, task);
      debug(`[SwarmTaskStore] Created task ${task.id}: ${task.title}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
    },
  );
}

function createSwarmTaskListTool(sessionId: string) {
  return tool(
    'SwarmTaskList',
    'List all tasks in the swarm task store. Optionally filter by status and/or owner.',
    {
      status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional().describe('Filter by task status'),
      owner: z.string().optional().describe('Filter by owner agent ID'),
    },
    async (args) => {
      const state = getState(sessionId);
      let tasks = Array.from(state.tasks.values());
      if (args.status) tasks = tasks.filter((t) => t.status === args.status);
      if (args.owner) tasks = tasks.filter((t) => t.owner === args.owner);

      const summary = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        owner: t.owner ?? 'unassigned',
        dependencies: t.dependencies,
      }));
      return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
    },
  );
}

function createSwarmTaskGetTool(sessionId: string) {
  return tool(
    'SwarmTaskGet',
    'Get full details of a single task by ID.',
    {
      taskId: z.string().describe('The task ID to retrieve'),
    },
    async (args) => {
      const state = getState(sessionId);
      const task = state.tasks.get(args.taskId);
      if (!task) {
        return { content: [{ type: 'text' as const, text: `Error: Task ${args.taskId} not found` }] };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
    },
  );
}

function createSwarmTaskUpdateTool(sessionId: string) {
  return tool(
    'SwarmTaskUpdate',
    'Update a task: claim ownership, change status, or add a comment. Use this to claim unclaimed tasks, mark progress, and communicate results.',
    {
      taskId: z.string().describe('The task ID to update'),
      status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional().describe('New status'),
      owner: z.string().optional().describe('Agent ID claiming this task'),
      comment: z.string().optional().describe('Comment to add (e.g. summary of work done)'),
    },
    async (args) => {
      const state = getState(sessionId);
      const task = state.tasks.get(args.taskId);
      if (!task) {
        return { content: [{ type: 'text' as const, text: `Error: Task ${args.taskId} not found` }] };
      }
      if (args.status) task.status = args.status;
      if (args.owner) task.owner = args.owner;
      if (args.comment) {
        task.comments.push({
          author: args.owner ?? task.owner ?? 'unknown',
          text: args.comment,
          timestamp: Date.now(),
        });
      }
      task.updatedAt = Date.now();
      debug(`[SwarmTaskStore] Updated task ${task.id}: status=${task.status}, owner=${task.owner}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] };
    },
  );
}

function createSwarmSendMessageTool(sessionId: string) {
  return tool(
    'SwarmSendMessage',
    'Send a message to a specific agent or broadcast to all agents. Use for coordination, sharing findings, or requesting help.',
    {
      from: z.string().describe('Your agent ID'),
      to: z.string().optional().describe('Target agent ID (omit for broadcast to all)'),
      content: z.string().describe('Message content'),
    },
    async (args) => {
      const state = getState(sessionId);
      const msg: SwarmMessage = {
        id: randomUUID().slice(0, 8),
        from: args.from,
        to: args.to,
        content: args.content,
        timestamp: Date.now(),
      };
      state.messages.push(msg);
      debug(`[SwarmTaskStore] Message from ${msg.from} to ${msg.to ?? 'all'}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ sent: true, id: msg.id }) }] };
    },
  );
}

function createSwarmReadMessagesTool(sessionId: string) {
  return tool(
    'SwarmReadMessages',
    'Read messages. Filter by recipient and/or since a timestamp to get only new messages.',
    {
      recipient: z.string().optional().describe('Your agent ID — returns messages addressed to you plus broadcasts'),
      since: z.number().optional().describe('Only return messages after this timestamp (epoch ms)'),
    },
    async (args) => {
      const state = getState(sessionId);
      let msgs = state.messages;
      if (args.recipient) {
        msgs = msgs.filter((m) => !m.to || m.to === args.recipient);
      }
      if (args.since) {
        msgs = msgs.filter((m) => m.timestamp > args.since!);
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(msgs, null, 2) }] };
    },
  );
}

// ============================================================
// Server factory (cached per session)
// ============================================================

const swarmServerCache = new Map<string, ReturnType<typeof createSdkMcpServer>>();

export function getSwarmTaskStore(sessionId: string): ReturnType<typeof createSdkMcpServer> {
  let cached = swarmServerCache.get(sessionId);
  if (!cached) {
    cached = createSdkMcpServer({
      name: 'swarm-tasks',
      version: '1.0.0',
      tools: [
        createSwarmTaskCreateTool(sessionId),
        createSwarmTaskListTool(sessionId),
        createSwarmTaskGetTool(sessionId),
        createSwarmTaskUpdateTool(sessionId),
        createSwarmSendMessageTool(sessionId),
        createSwarmReadMessagesTool(sessionId),
      ],
    });
    swarmServerCache.set(sessionId, cached);
    debug(`[SwarmTaskStore] Created swarm task store for session ${sessionId}`);
  }
  return cached;
}

/**
 * Clean up swarm state for a session.
 */
export function cleanupSwarmTaskStore(sessionId: string): void {
  sessionStates.delete(sessionId);
  swarmServerCache.delete(sessionId);
  debug(`[SwarmTaskStore] Cleaned up session ${sessionId}`);
}
