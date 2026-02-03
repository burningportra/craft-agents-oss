# fn-1-interactive-guided-tasks-gui.2 Data layer: Zod schemas, IPC channels, flowctl bridge

## Description
Build the data access layer: Zod schemas for flow-next types, IPC channel definitions (FLOW_* constants), and a main-process FlowBridge that shells out to flowctl with JSON output.

**Size:** M
**Files:**
- `apps/electron/src/shared/flow-schemas.ts` — Zod schemas for Epic, Task, TaskStatus, EpicStatus
- `apps/electron/src/shared/types.ts` — add FLOW_* IPC_CHANNELS entries (SCREAMING_SNAKE_CASE)
- `apps/electron/src/main/lib/flow-bridge.ts` — execFile wrapper for flowctl with --json, 10s timeout, write queue
- `apps/electron/src/main/ipc.ts` — register FLOW_* IPC handlers
- `apps/electron/src/preload/index.ts` — expose flow API via contextBridge

## Approach

- Zod schemas: `TaskStatusSchema = z.enum(['todo', 'in_progress', 'blocked', 'done'])`, `EpicStatusSchema = z.enum(['open', 'done'])`, `TaskSchema`, `EpicSchema` with all fields from flowctl JSON output
- IPC channels follow SCREAMING_SNAKE_CASE convention: `FLOW_EPICS_LIST: 'flow:epics-list'`, `FLOW_TASKS_LIST: 'flow:tasks-list'`, `FLOW_TASK_UPDATE_STATUS: 'flow:task-update-status'`, etc.
- FlowBridge class:
  - Constructor accepts workspace root path
  - Resolves flowctl binary per workspace: `<workspace-root>/.flow/bin/flowctl` first, then global PATH
  - Wraps `execFile` with `--json` flag, 10s timeout
  - Serialized write queue (max 1 concurrent write) to prevent file lock contention
  - Parses + validates output with Zod schemas
- Typed error discriminated union:
  ```typescript
  type FlowBridgeError =
    | { type: 'flowctl_not_found' }
    | { type: 'invalid_output'; zodError: ZodError }
    | { type: 'command_failed'; stderr: string; exitCode: number }
    | { type: 'timeout'; command: string }
  ```

## Key context

- IPC pattern: `ipcMain.handle(channel, handler)` in `main/ipc.ts`, `ipcRenderer.invoke(channel)` in preload
- All flowctl commands support `--json` output flag
- Each arg as separate array element in execFile — never string interpolation (command injection prevention)
- Write serialization prevents file lock contention when user drags cards rapidly
## Approach

- Zod schemas: `TaskStatusSchema = z.enum(['todo', 'in_progress', 'blocked', 'done'])`, `EpicStatusSchema = z.enum(['open', 'done'])`, `TaskSchema`, `EpicSchema` with all fields from flowctl JSON output
- IPC channels: `flow:epics-list`, `flow:tasks-list`, `flow:task-update-status`, `flow:epic-create`, `flow:task-create`, `flow:epic-show`, `flow:task-show`
- FlowBridge class: resolves flowctl binary path, wraps `execFile` with `--json` flag, 10s timeout, serialized write queue (max 1 concurrent write), parses + validates output with Zod
- Error handling: distinguish "flowctl not found", "invalid JSON output", "command failed" — each returns typed error for GUI recovery

## Key context

- flowctl binary path: check `.flow/bin/flowctl` first (local install), then global PATH
- IPC pattern: `ipcMain.handle(channel, handler)` in `main/ipc.ts`, `ipcRenderer.invoke(channel)` in preload
- All flowctl commands support `--json` output flag
- Write serialization prevents file lock contention when user drags cards rapidly
## Acceptance
- [ ] Zod schemas validate real flowctl --json output for epics and tasks
- [ ] IPC channels defined as FLOW_* constants in IPC_CHANNELS (SCREAMING_SNAKE_CASE)
- [ ] FlowBridge resolves flowctl binary per workspace (.flow/bin/ then PATH)
- [ ] FlowBridge execFile has 10s timeout
- [ ] FlowBridge serializes writes (queue, max 1 concurrent)
- [ ] IPC handlers registered for all FLOW_* channels
- [ ] Preload exposes flow API to renderer
- [ ] Typed FlowBridgeError discriminated union: flowctl_not_found, invalid_output, command_failed, timeout
- [ ] TypeScript compiles without errors
## Done summary
Implemented flow-next data layer: Zod schemas for Epic/Task/Status validation, FLOW_* IPC channels (SCREAMING_SNAKE_CASE), FlowBridge class with execFile wrapper (10s timeout, serialized write queue, per-workspace binary resolution), typed FlowBridgeError discriminated union, IPC handlers, and preload contextBridge exposure.
## Evidence
- Commits: d1dacd0, 11ce1c6699f34ee81da90e45859fe3c5178cffc1
- Tests: bun typecheck (pre-existing errors only, no new errors)
- PRs: