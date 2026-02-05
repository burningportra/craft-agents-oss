# fn-3-workspace-aware-tasks-onboarding-flow.1 Active Project Atom & Path Resolution

## Description
Create the foundational `activeFlowProjectAtom`, define ALL new IPC channel types upfront, replace all `process.cwd()` / `workspace.rootPath` patterns, and manage FlowWatcher lifecycle on project switch. This is the foundation task — all other tasks depend on it.

**Size:** M
**Files:** `apps/electron/src/renderer/atoms/tasks-state.ts`, `apps/electron/src/renderer/pages/TasksPage.tsx`, `apps/electron/src/renderer/components/app-shell/AppShell.tsx`, `apps/electron/src/shared/types.ts`, `apps/electron/src/main/ipc.ts`, `apps/electron/src/preload/index.ts`

## Approach

- Create `activeFlowProjectAtom` holding `{ path: string | null, flowStatus: 'initialized' | 'needs-setup' | 'error', gitInfo?: { branch, remote, lastCommit } }` in `tasks-state.ts`. Null path when no projects registered.
- Create `registeredFlowProjectsAtom` persisted to localStorage via `atomWithStorage` keyed as `flow-registered-projects`. Shape: `[{ path, name, addedAt }]`.
- **Define ALL new IPC channel constants and `ElectronAPI` method signatures in `types.ts`** (minimizes cross-task conflicts):
  - `FLOW_PROJECT_REGISTER`, `FLOW_PROJECT_UNREGISTER`, `FLOW_PROJECT_LIST`, `FLOW_PROJECT_CHECK_STATUS`
  - `GET_GIT_INFO` (returns `{ branch: string, remote: string, lastCommit: string } | null`)
  - `FLOW_UI_STATE_READ` (returns `UiState | null`), `FLOW_UI_STATE_WRITE` (accepts `UiState`)
  - `FLOW_READ_PROJECT_CONTEXT` (reads README.md + package.json, returns `{ name: string, description?: string } | null`)
- Implement main process handlers in `ipc.ts` for project registration, status checks, and git info
- Add preload bridge methods in `preload/index.ts` for all new IPC channels
- Replace the `process.cwd()` + fallback pattern in `TasksPage.tsx:41-61` — derive project path from `activeFlowProjectAtom`
- Replace the duplicate pattern in `AppShell.tsx:514-530`
- Wire `activeFlowProjectAtom.path` into all existing FlowBridge IPC calls
- All FlowBridge IPC calls handle `null`/`undefined` projectPath gracefully (return error response, don't crash)
- **FlowWatcher lifecycle**: Add atom effect on `activeFlowProjectAtom` that tears down old FlowWatcher and starts new one for active project. Debounce watcher setup (300ms) to handle rapid switching.
- Existing FlowBridge cache at `ipc.ts:2545-2585` already handles per-path instances — just ensure the new atom's path flows through

## Key context

- Use `FlowProject` / `activeFlowProjectAtom` naming to avoid collision with existing `Workspace` type at `packages/core/src/types/workspace.ts:11-20`
- `useActiveWorkspace()` at `AppShellContext.tsx:179-183` provides the existing auth workspace concept — the new project atom is separate
- `resetTasksStateAtom` at `tasks-state.ts:280-292` already handles state reset on workspace changes — extend for project switching
- `OPEN_FOLDER_DIALOG` IPC channel already exists at `types.ts:631` — reusable for project registration
- Existing `FlowWatcher` at `flow-watcher.ts:89-138` already handles `.flow/` deletion — atom effect manages create/teardown lifecycle
## Approach

- Create `activeProjectAtom` holding `{ path: string | null, flowStatus: 'initialized' | 'needs-setup' | 'error', gitInfo?: { branch, remote, lastCommit } }` in `tasks-state.ts`
- Create `registeredProjectsAtom` (persisted to app config or localStorage) holding `[{ path, name, addedAt }]`
- Add IPC channels: `FLOW_PROJECT_REGISTER`, `FLOW_PROJECT_UNREGISTER`, `FLOW_PROJECT_LIST`, `FLOW_PROJECT_CHECK_STATUS` (check if `.flow/` exists at path)
- Implement main process handlers in `ipc.ts` for project registration and status checks
- Add `GET_GIT_INFO` IPC to lazily fetch `{ branch, remote, lastCommit }` via `git rev-parse` commands when a project is selected
- Replace the `process.cwd()` + fallback pattern in `TasksPage.tsx:41-61` — derive project path from `activeProjectAtom` instead
- Replace the duplicate pattern in `AppShell.tsx:514-530`
- Wire `activeProjectAtom.path` into all existing FlowBridge IPC calls that currently use the resolved `projectPath`
- Existing FlowBridge cache at `ipc.ts:2545-2585` already handles per-path instances — just ensure the new atom's path flows through

## Key context

- The existing `Workspace` type at `packages/core/src/types/workspace.ts:11-20` is an auth/sessions container — use "project" naming to avoid collision
- `useActiveWorkspace()` at `AppShellContext.tsx:179-183` provides the existing workspace concept — the new project atom is separate
- `resetTasksStateAtom` at `tasks-state.ts:280-292` already handles state reset on workspace changes — extend for project switching
- `OPEN_FOLDER_DIALOG` IPC channel already exists at `types.ts:631` — reusable for project registration
## Acceptance
- [ ] `activeFlowProjectAtom` exists with `{ path: string | null, flowStatus, gitInfo? }` shape
- [ ] `registeredFlowProjectsAtom` persists project list via `atomWithStorage` across app restarts
- [ ] ALL new IPC channel constants defined in `types.ts` (project mgmt + UI state + git info + project context)
- [ ] `ElectronAPI` interface in `types.ts` has typed method signatures for all new IPC channels
- [ ] Preload bridge methods added for all new IPC channels
- [ ] IPC handlers for project register/unregister/list/status-check implemented in `ipc.ts`
- [ ] `GET_GIT_INFO` IPC lazily fetches branch, remote, lastCommit
- [ ] `TasksPage.tsx` no longer uses `process.cwd()` — uses `activeFlowProjectAtom.path`
- [ ] `AppShell.tsx` duplicate pattern replaced with `activeFlowProjectAtom.path`
- [ ] All FlowBridge IPC calls receive path from `activeFlowProjectAtom`
- [ ] FlowBridge IPC calls handle null/undefined projectPath gracefully (return error, don't crash)
- [ ] Atom effect on `activeFlowProjectAtom` tears down old FlowWatcher and starts new one (debounced 300ms)
- [ ] No naming collisions with existing `workspace` code (uses `FlowProject` prefix)
- [ ] App typechecks (`bun run typecheck` in `apps/electron`)
- [ ] App lints clean (`bun run lint` in `apps/electron`)
## Done summary
Implemented activeFlowProjectAtom and workspace-aware project management foundation. Created new IPC channels, Jotai atoms (activeFlowProjectAtom, registeredFlowProjectsAtom, syncFlowWatcherAtom), preload bridge methods, and validateProjectPath security helper. Replaced process.cwd() patterns with atom-based path resolution in TasksPage and AppShell. Added FlowWatcher lifecycle management with debounce on project switch.
## Evidence
- Commits: 2997413, bdcb4d2, 4e0b14e
- Tests: npx tsc --noEmit --project apps/electron/tsconfig.json
- PRs: