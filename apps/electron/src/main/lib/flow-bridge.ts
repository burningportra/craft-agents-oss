import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  CommandSuccessSchema,
  EpicListResponseSchema,
  EpicSchema,
  TaskListResponseSchema,
  TaskSchema,
  type CommandSuccess,
  type EpicListResponse,
  type Epic,
  type TaskListResponse,
  type Task,
  type TaskStatus,
  type FlowBridgeError,
  type FlowBridgeResult,
} from '../../shared/flow-schemas'
import type { ZodSchema, ZodError } from 'zod'

const TIMEOUT_MS = 10_000

/**
 * FlowBridge: execFile wrapper for flowctl with --json output.
 *
 * - Resolves flowctl binary per workspace (.flow/bin/flowctl first, then PATH)
 * - 10s timeout on all commands
 * - Serialized write queue (max 1 concurrent write) to prevent file lock contention
 *   when user drags cards rapidly in the Kanban board
 * - Parses + validates output with Zod schemas
 */
export class FlowBridge {
  private workspaceRoot: string
  private flowctlPath: string | null = null
  private writeQueue: Promise<unknown> = Promise.resolve()

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
  }

  /** Resolve flowctl binary: .flow/bin/flowctl first, then global PATH */
  private resolveFlowctl(): string {
    if (this.flowctlPath) return this.flowctlPath

    const localPath = join(this.workspaceRoot, '.flow', 'bin', 'flowctl')
    if (existsSync(localPath)) {
      this.flowctlPath = localPath
      return localPath
    }

    // Fall back to PATH — will fail at exec time with ENOENT if not found
    this.flowctlPath = 'flowctl'
    return 'flowctl'
  }

  /** Execute a read-only flowctl command (no serialization) */
  private exec<T>(args: string[], schema: ZodSchema<T>): Promise<FlowBridgeResult<T>> {
    return this.runCommand(args, schema)
  }

  /** Execute a write flowctl command (serialized, max 1 concurrent to prevent file lock contention) */
  private execWrite<T>(args: string[], schema: ZodSchema<T>): Promise<FlowBridgeResult<T>> {
    const promise = this.writeQueue.then(() => this.runCommand(args, schema))
    // Log errors but don't propagate — keep the queue moving for subsequent writes
    this.writeQueue = promise.catch((err) => {
      console.error('[FlowBridge] Write operation failed:', err)
    })
    return promise
  }

  private runCommand<T>(args: string[], schema: ZodSchema<T>): Promise<FlowBridgeResult<T>> {
    return new Promise((resolve) => {
      const flowctl = this.resolveFlowctl()
      const fullArgs = [...args, '--json']

      execFile(
        flowctl,
        fullArgs,
        {
          cwd: this.workspaceRoot,
          timeout: TIMEOUT_MS,
          maxBuffer: 1024 * 1024, // 1MB
          env: { ...process.env },
        },
        (error, stdout, stderr) => {
          if (error) {
            // Check if it's a timeout
            if (error.killed || (error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
              return resolve({
                ok: false,
                error: { type: 'timeout', command: `flowctl ${args.join(' ')}` },
              })
            }
            // Check if flowctl not found
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              this.flowctlPath = null // Reset cache so next call re-resolves
              return resolve({ ok: false, error: { type: 'flowctl_not_found' } })
            }
            // Command failed
            return resolve({
              ok: false,
              error: {
                type: 'command_failed',
                stderr: stderr || error.message,
                exitCode: error.code ? Number(error.code) : 1,
              },
            })
          }

          // Parse JSON
          let parsed: unknown
          try {
            parsed = JSON.parse(stdout)
          } catch {
            return resolve({
              ok: false,
              error: {
                type: 'invalid_json',
                stdout: stdout.slice(0, 500), // Truncate for safety
              },
            })
          }

          // Validate with Zod
          const result = schema.safeParse(parsed)
          if (!result.success) {
            return resolve({
              ok: false,
              error: { type: 'invalid_output', zodError: result.error as ZodError },
            })
          }

          resolve({ ok: true, data: result.data })
        },
      )
    })
  }

  // ─── Public API ─────────────────────────────────────────────────────

  /** List all epics */
  listEpics(): Promise<FlowBridgeResult<EpicListResponse>> {
    return this.exec(['epics'], EpicListResponseSchema)
  }

  /** List tasks for an epic */
  listTasks(epicId: string): Promise<FlowBridgeResult<TaskListResponse>> {
    return this.exec(['tasks', '--epic', epicId], TaskListResponseSchema)
  }

  /** Show epic details */
  showEpic(epicId: string): Promise<FlowBridgeResult<Epic>> {
    return this.exec(['show', epicId], EpicSchema)
  }

  /** Show task details */
  showTask(taskId: string): Promise<FlowBridgeResult<Task>> {
    return this.exec(['show', taskId], TaskSchema)
  }

  /** Start a task (claim it). Only status transition supported by flowctl directly. */
  startTask(taskId: string): Promise<FlowBridgeResult<CommandSuccess>> {
    return this.execWrite(['start', taskId], CommandSuccessSchema)
  }

  /**
   * Update task status.
   * Maps to flowctl commands:
   * - todo: `flowctl task reset <taskId>`
   * - in_progress: `flowctl start <taskId>`
   * - blocked: Not directly supported (needs reason file) - returns error
   * - done: `flowctl done <taskId> --summary "Status changed via GUI" --force`
   */
  updateTaskStatus(taskId: string, status: TaskStatus): Promise<FlowBridgeResult<CommandSuccess>> {
    switch (status) {
      case 'todo':
        return this.execWrite(['task', 'reset', taskId], CommandSuccessSchema)
      case 'in_progress':
        return this.execWrite(['start', taskId], CommandSuccessSchema)
      case 'done':
        // Use --force to skip checks, --summary for required summary
        return this.execWrite(['done', taskId, '--summary', 'Status changed via GUI', '--force'], CommandSuccessSchema)
      case 'blocked':
        // Blocking requires a reason file - not supported via simple drag-drop
        return Promise.resolve({
          ok: false,
          error: {
            type: 'command_failed',
            stderr: 'Blocking a task requires a reason. Use the task detail panel instead.',
            exitCode: 1,
          },
        })
      default:
        return Promise.resolve({
          ok: false,
          error: {
            type: 'command_failed',
            stderr: `Unknown status: ${status}`,
            exitCode: 1,
          },
        })
    }
  }

  /** Initialize flow-next in workspace */
  init(): Promise<FlowBridgeResult<CommandSuccess>> {
    return this.execWrite(['init'], CommandSuccessSchema)
  }
}
