/**
 * EpicChatAgent — Real AI chat for epic context
 *
 * Handles all epic chat LLM calls (free-form, /interview, /review) with
 * streaming responses. Streams text deltas to the renderer via IPC.
 *
 * Architecture:
 *   EpicChatPanel -> IPC(FLOW_EPIC_CHAT_SEND) -> EpicChatAgent
 *                 <- IPC(FLOW_EPIC_CHAT_STATUS) <- streaming text events
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { BrowserWindow } from 'electron'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatCommandType = 'interview' | 'review' | 'chat'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface EpicChatParams {
  epicId: string
  commandType: ChatCommandType
  message: string
  history: ChatMessage[]
  workspaceRoot: string
  window: BrowserWindow
}

export type EpicChatEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'text_complete' }
  | { type: 'error'; errorType: 'rate_limit' | 'auth' | 'network' | 'invalid_response'; message: string }

// ─── Active Stream Tracking ──────────────────────────────────────────────────

const activeStreams = new Map<string, AbortController>()

function getStreamKey(workspaceRoot: string, epicId: string): string {
  return `${workspaceRoot}:${epicId}`
}

/**
 * Abort an active stream for a given workspace+epic combination.
 * Returns true if an active stream was found and aborted.
 */
export function abortChat(workspaceRoot: string, epicId: string): boolean {
  const key = getStreamKey(workspaceRoot, epicId)
  const controller = activeStreams.get(key)
  if (controller) {
    controller.abort()
    activeStreams.delete(key)
    return true
  }
  return false
}

// ─── Context Gathering ───────────────────────────────────────────────────────

function readEpicSpec(workspaceRoot: string, epicId: string): string | null {
  const specPath = join(workspaceRoot, '.flow', 'specs', `${epicId}.md`)
  try {
    return readFileSync(specPath, 'utf-8')
  } catch {
    return null
  }
}

function readTaskList(workspaceRoot: string, epicId: string): string {
  const tasksDir = join(workspaceRoot, '.flow', 'tasks')
  try {
    if (!existsSync(tasksDir)) return 'No tasks found.'

    const files = require('fs').readdirSync(tasksDir) as string[]
    const taskFiles = files.filter(
      (f: string) => f.startsWith(epicId + '.') && f.endsWith('.json'),
    )

    if (taskFiles.length === 0) return 'No tasks found for this epic.'

    const tasks: string[] = []
    for (const file of taskFiles) {
      try {
        const content = readFileSync(join(tasksDir, file), 'utf-8')
        const task = JSON.parse(content) as {
          id?: string
          title?: string
          status?: string
        }
        tasks.push(`- [${task.status || 'unknown'}] ${task.id || file}: ${task.title || 'Untitled'}`)
      } catch {
        // Skip unreadable task files
      }
    }

    return tasks.length > 0 ? tasks.join('\n') : 'No tasks found for this epic.'
  } catch {
    return 'Unable to read tasks.'
  }
}

function readProjectName(workspaceRoot: string): string {
  const pkgPath = join(workspaceRoot, 'package.json')
  try {
    if (existsSync(pkgPath)) {
      const content = readFileSync(pkgPath, 'utf-8')
      const pkg = JSON.parse(content) as { name?: string }
      if (pkg.name && typeof pkg.name === 'string') return pkg.name
    }
  } catch {
    // Fall through to basename
  }
  return require('path').basename(workspaceRoot)
}

function readProjectLearnings(workspaceRoot: string): string | null {
  try {
    const { readLearnings } = require('@craft-agent/shared/agent/learnings') as typeof import('@craft-agent/shared/agent/learnings')
    const learnings = readLearnings(workspaceRoot)
    return learnings && learnings.trim() ? learnings : null
  } catch {
    return null
  }
}

// ─── System Prompt Builder ───────────────────────────────────────────────────

interface BuildSystemPromptParams {
  commandType: ChatCommandType
  epicSpec: string | null
  taskContext: string
  projectMetadata: { name: string }
  extraContext?: string
}

/**
 * Build a system prompt for the epic chat agent.
 *
 * The `extraContext` parameter is an extension point for injecting
 * cross-project knowledge. Task 4 will provide this.
 */
export function buildSystemPrompt(params: BuildSystemPromptParams): string {
  const { commandType, epicSpec, taskContext, projectMetadata, extraContext } = params

  const commandInstructions = getCommandInstructions(commandType)

  let prompt = `You are an AI assistant helping with software development for the project "${projectMetadata.name}".

${commandInstructions}

## Epic Specification
${epicSpec || 'No epic specification available.'}

## Current Tasks
${taskContext}
`

  // Task 4: Cross-project context injected here
  if (extraContext) {
    prompt += `\n## Cross-Project Context\n${extraContext}\n`
  }

  return prompt
}

function getCommandInstructions(commandType: ChatCommandType): string {
  switch (commandType) {
    case 'interview':
      return `## Role: Requirements Interviewer

You are conducting a requirements elicitation interview for this epic. Your goal is to:
- Ask targeted, specific questions about unclear requirements
- Help the user think through edge cases and constraints
- Identify missing acceptance criteria
- Suggest potential technical approaches and trade-offs
- Build understanding incrementally through conversation

Ask one or two focused questions at a time. Do not overwhelm the user with too many questions at once. Build on their answers to dig deeper.`

    case 'review':
      return `## Role: Epic Analyst

You are reviewing this epic's specification and current progress. Your goal is to:
- Analyze the epic spec for completeness, clarity, and feasibility
- Review the current task breakdown and identify gaps
- Flag potential risks, blockers, or architectural concerns
- Suggest improvements to the spec or task structure
- Assess overall progress and remaining effort

Provide a structured, actionable review. Be specific about what's good and what needs attention.`

    case 'chat':
      return `## Role: Development Assistant

You are a helpful development assistant with context about this epic and its tasks. Your goal is to:
- Answer questions about the epic, its tasks, and implementation approach
- Help with technical decisions and trade-offs
- Suggest solutions to implementation challenges
- Provide code guidance when asked
- Help prioritize and plan work

Be concise and practical. Reference the epic spec and task list when relevant.`
  }
}

// ─── Chat Executor ───────────────────────────────────────────────────────────

/**
 * Execute a chat interaction with the LLM.
 *
 * Streams text deltas to the renderer window via IPC. Handles
 * cancellation via AbortController. Returns when streaming is complete.
 */
export async function executeChat(params: EpicChatParams): Promise<void> {
  const { epicId, commandType, message, history, workspaceRoot, window } = params
  const streamKey = getStreamKey(workspaceRoot, epicId)

  // Abort any existing stream for this workspace+epic
  const existingController = activeStreams.get(streamKey)
  if (existingController) {
    existingController.abort()
    activeStreams.delete(streamKey)
  }

  const abortController = new AbortController()
  activeStreams.set(streamKey, abortController)

  const sendEvent = (event: EpicChatEvent) => {
    if (!window.isDestroyed()) {
      window.webContents.send('flow:epic-chat-status', { epicId, ...event })
    }
  }

  try {
    // Gather context
    const epicSpec = readEpicSpec(workspaceRoot, epicId)
    const taskContext = readTaskList(workspaceRoot, epicId)
    const projectName = readProjectName(workspaceRoot)
    const learnings = readProjectLearnings(workspaceRoot)

    // Build system prompt
    let systemPrompt = buildSystemPrompt({
      commandType,
      epicSpec,
      taskContext,
      projectMetadata: { name: projectName },
    })

    // Add project learnings if available
    if (learnings) {
      systemPrompt += `\n## Project Learnings\n${learnings}\n`
    }

    // Get API key from credential manager (never send to renderer)
    const { getCredentialManager } = await import('@craft-agent/shared/credentials')
    const apiKey = await getCredentialManager().getApiKey()

    if (!apiKey) {
      sendEvent({
        type: 'error',
        errorType: 'auth',
        message: 'No API key configured. Please set up your API key in Settings.',
      })
      return
    }

    // Use DEFAULT_MODEL constant
    const { DEFAULT_MODEL } = await import('@craft-agent/shared/config')

    // Create Anthropic client with explicit API key
    const { Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })

    // Build messages array from history + current message
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history,
      { role: 'user' as const, content: message },
    ]

    // Stream the response
    const stream = client.messages.stream({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    })

    // Set up abort handling
    const onAbort = () => {
      stream.abort()
    }
    abortController.signal.addEventListener('abort', onAbort)

    try {
      // Forward text events to renderer
      stream.on('text', (text) => {
        if (abortController.signal.aborted) return
        sendEvent({ type: 'text_delta', text })
      })

      // Wait for completion
      await stream.finalMessage()

      if (!abortController.signal.aborted) {
        sendEvent({ type: 'text_complete' })
      }
    } finally {
      abortController.signal.removeEventListener('abort', onAbort)
    }
  } catch (error) {
    // Don't send error events if the stream was intentionally aborted
    if (abortController.signal.aborted) return

    const chatError = classifyError(error)
    sendEvent(chatError)
  } finally {
    activeStreams.delete(streamKey)
  }
}

// ─── Error Classification ────────────────────────────────────────────────────

function classifyError(error: unknown): EpicChatEvent {
  if (error instanceof Error) {
    const message = error.message

    // Check for Anthropic API error status codes
    const statusMatch = (error as { status?: number }).status
    if (statusMatch === 429) {
      return {
        type: 'error',
        errorType: 'rate_limit',
        message: 'Rate limit exceeded. Please wait a moment and try again.',
      }
    }
    if (statusMatch === 401) {
      return {
        type: 'error',
        errorType: 'auth',
        message: 'Authentication failed. Please check your API key in Settings.',
      }
    }

    // Network errors
    if (
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('ETIMEDOUT') ||
      message.includes('fetch failed') ||
      message.includes('network')
    ) {
      return {
        type: 'error',
        errorType: 'network',
        message: 'Network error. Please check your internet connection and try again.',
      }
    }

    // Invalid response
    if (message.includes('invalid') || message.includes('parse')) {
      return {
        type: 'error',
        errorType: 'invalid_response',
        message: `Invalid response from API: ${message}`,
      }
    }

    // Default to network for unknown errors
    return {
      type: 'error',
      errorType: 'network',
      message: `An error occurred: ${message}`,
    }
  }

  return {
    type: 'error',
    errorType: 'network',
    message: 'An unexpected error occurred.',
  }
}
