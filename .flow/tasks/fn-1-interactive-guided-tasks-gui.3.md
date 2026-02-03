# fn-1-interactive-guided-tasks-gui.3 FlowWatcher: .flow/ directory watcher with IPC events

## Description
Implement FlowWatcher class that monitors `.flow/` directory for changes and emits IPC events to renderer, enabling live sync between CLI and GUI.

**Size:** M
**Files:**
- `apps/electron/src/main/lib/flow-watcher.ts` — FlowWatcher class
- `apps/electron/src/main/ipc.ts` — integrate FlowWatcher lifecycle (start/stop per workspace)
- `apps/electron/src/shared/types.ts` — add `FLOW_CHANGED` IPC event channel

## Approach

- Follow `ConfigWatcher` pattern at `main/lib/config-watcher.ts` — especially the per-file-path debounce map (`debounceTimers: Map<string, NodeJS.Timeout>`)
- Use `fs.watch()` with `recursive: true` on `.flow/` directory (macOS/Windows supported)
- Debounce per file path: 100ms stabilization before emitting (matching ConfigWatcher.debounce())
- Emit `FLOW_CHANGED` IPC event with payload: `{ type: 'epic' | 'task' | 'config', id?: string }`
- Parse changed filename to determine type (e.g., `epics/fn-1.json` → epic, `tasks/fn-1.1.json` → task)
- WindowManager owns FlowWatcher instances via `Map<workspaceId, FlowWatcher>`. Created when first window opens workspace, destroyed when last window for that workspace closes.
- Handle `.flow/` not existing: watch parent dir for creation, then switch to watching `.flow/`

## Key context

- `fs.watch` with `recursive: true` works on macOS (FSEvents) and Windows. Linux requires chokidar — defer.
- Renderer subscribes via `ipcRenderer.on(FLOW_CHANGED, callback)` in preload
- Note: fn-1.2 also modifies `main/ipc.ts` — fn-1.3 depends on fn-1.2 to avoid merge conflicts
## Approach

- Follow `ConfigWatcher` pattern at `main/lib/config-watcher.ts`
- Use `fs.watch()` with `recursive: true` on `.flow/` directory (macOS/Windows supported)
- Debounce per file key: 100ms stabilization before emitting
- Emit `flow:changed` IPC event with payload: `{ type: 'epic' | 'task' | 'config', id?: string }`
- Parse changed filename to determine type (e.g., `epics/fn-1.json` → epic, `tasks/fn-1.1.json` → task)
- Lifecycle: create watcher when workspace opens, destroy on workspace close
- Handle `.flow/` not existing: watch parent dir for creation, then switch to watching `.flow/`

## Key context

- `fs.watch` with `recursive: true` works on macOS (FSEvents) and Windows. Linux requires chokidar — defer Linux support.
- ConfigWatcher creates/destroys per workspace. FlowWatcher should follow same lifecycle.
- Renderer subscribes via `ipcRenderer.on('flow:changed', callback)` in preload
## Acceptance
- [ ] FlowWatcher class monitors .flow/ directory recursively
- [ ] Changes debounced via per-file-path debounce map (matching ConfigWatcher pattern)
- [ ] IPC event FLOW_CHANGED emitted with typed payload
- [ ] WindowManager owns FlowWatcher lifecycle (one per workspace)
- [ ] Handles .flow/ not existing (watches for creation)
- [ ] Handles .flow/ being deleted while watching (graceful cleanup)
- [ ] Renderer can subscribe to FLOW_CHANGED events via preload API
## Done summary
Implemented FlowWatcher class that monitors .flow/ directory recursively with per-file-path debouncing (100ms), parses changed files into typed FlowChangedPayload (epic/task/config with ID), and broadcasts FLOW_CHANGED IPC events to all windows. Handles .flow/ not existing (watches parent for creation) and deletion mid-watch with graceful fallback.
## Evidence
- Commits: 8c2940d, 6a999cc
- Tests: bun typecheck (pre-existing errors in packages/shared, new code compiles clean)
- PRs: