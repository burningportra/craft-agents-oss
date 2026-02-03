import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import {
  EpicListResponseSchema,
  EpicSchema,
  TaskListResponseSchema,
  TaskSchema,
  type EpicListResponse,
  type Epic,
  type TaskListResponse,
  type Task,
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

    // Fall back to PATH — will throw at exec time if not found
    this.flowctlPath = 'flowctl'
    return 'flowctl'
  }

  /** Execute a read-only flowctl command (no serialization) */
  private exec<T>(args: string[], schema: ZodSchema<T>): Promise<FlowBridgeResult<T>> {
    return this.runCommand(args, schema)
  }

  /** Execute a write flowctl command (serialized, max 1 concurrent) */
  private execWrite<T>(args: string[], schema: ZodSchema<T>): Promise<FlowBridgeResult<T>> {
    const promise = this.writeQueue.then(() => this.runCommand(args, schema))
    // Update queue — swallow errors so queue keeps moving
    this.writeQueue = promise.then(() => {}, () => {})
    return promise
  }

  private runCommand<T>(args: string[], schema: ZodSchema<T>): Promise<FlowBridgeResult<T>> {
    return new Promise((resolve) => {
      let flowctl: string
      try {
        flowctl = this.resolveFlowctl()
      } catch {
        return resolve({ ok: false, error: { type: 'flowctl_not_found' } })
      }

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
                type: 'invalid_output',
                zodError: new (require('zod').ZodError)([
                  { code: 'custom', message: 'Invalid JSON output from flowctl', path: [] },
                ]),
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

  /** Start a task (claim it) */
  startTask(taskId: string): Promise<FlowBridgeResult<{ success: boolean }>> {
    return this.execWrite(['start', taskId], require('zod').z.object({ success: require('zod').z.boolean() }))
  }

  /** Initialize flow-next in workspace */
  init(): Promise<FlowBridgeResult<{ success: boolean }>> {
    return this.execWrite(['init'], require('zod').z.object({ success: require('zod').z.boolean() }))
  }
}
