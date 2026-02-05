# Workspace-Aware Tasks & Onboarding Flow

## Overview

The Tasks view currently resolves the project directory via `process.cwd()` with fallback to `workspace.rootPath` (see `TasksPage.tsx:41-61` and `AppShell.tsx:514-530`), meaning it looks at the app's own repo. This epic replaces that with an `activeFlowProjectAtom` that points at a user-selected project directory, adds a sidebar project switcher, migrates UI state to per-project `.flow/ui-state.json`, and provides a 5-step onboarding wizard when `.flow/` doesn't exist.

**Terminology note**: The existing `Workspace` type (`packages/core/src/types/workspace.ts:11-20`) represents an auth/sessions container. This epic's "project" concept is a filesystem directory registered for flow-next task management. We use `FlowProject` / `activeFlowProjectAtom` internally to avoid collision with the existing Workspace type, while the UI displays "Project" to users.

## Scope

**In scope:**
- `activeFlowProjectAtom` — Jotai atom tracking `{ path, flowStatus, gitInfo? }` for the selected project directory
- Replace `process.cwd()` / `workspace.rootPath` pattern in TasksPage + AppShell
- All new IPC channel type definitions added in Task 1 (foundation) to minimize cross-task file conflicts
- Per-project UI state persistence to `.flow/ui-state.json` (always gitignored, debounced 500ms writes)
- Sidebar project switcher with colored avatars, health badges, add/remove actions
- 5-step onboarding wizard (Welcome → Interactive Demo → Configure → Initialize → Create Epic + Celebrate)
- Brief welcome banner for cloned repos with existing `.flow/`
- Empty states and edge case handling (.flow/ deletion, no projects registered, monorepo)

**Out of scope:**
- Multi-workspace concurrent views (one active project at a time)
- Cloud sync of .flow/ state
- Linux chokidar fallback for FlowWatcher (deferred per `flow-watcher.ts:11`)
- Changes to the existing `Workspace` auth type
- AI-generated demo content (use static contextual demo based on README/package.json analysis with template fallback)

## Approach

### State Architecture

- **`activeFlowProjectAtom`**: New Jotai atom holding `{ path: string | null, flowStatus: 'initialized' | 'needs-setup' | 'error', gitInfo?: { branch, remote, lastCommit } }`. Null when no projects are registered. All FlowBridge IPC calls handle null path gracefully (return empty/error, don't crash).
- **`registeredFlowProjectsAtom`**: Persisted to localStorage via `atomWithStorage` keyed as `flow-registered-projects`. Shape: `[{ path, name, addedAt }]`. On app launch, validate paths still exist.
- **FlowBridge cache**: Already implemented as `Map<string, FlowBridge>` at `ipc.ts:2545-2585` — no changes needed to caching strategy. Wire `activeFlowProjectAtom.path` through existing IPC channels.
- **UI state persistence**: Replace global localStorage atoms (`tasks-state.ts:66-560`) with reads/writes to `.flow/ui-state.json`. Use FlowBridge for file I/O. Debounce writes at 500ms using existing persistence-queue pattern from `sessions/persistence-queue.ts`.
- **IPC type definitions**: All new IPC channels and `ElectronAPI` method signatures are defined in Task 1 to prevent cross-task conflicts in `types.ts`.

### Project Switching

- **Instant swap**: On project switch, load cached Jotai state immediately, refresh FlowBridge data in background.
- **FlowWatcher lifecycle**: Atom effect on `activeFlowProjectAtom` tears down the old project's FlowWatcher and starts a new one for the active project. Debounce watcher setup to handle rapid switching.
- **Lazy git info**: Fetch branch/remote/lastCommit via existing `GET_GIT_BRANCH` IPC (`types.ts:743`) only when project is selected (not on list load).
- **State reset**: Use existing `resetTasksStateAtom` pattern (`tasks-state.ts:280-292`) on switch, then restore from `.flow/ui-state.json`.

### localStorage Migration (Task 2)

Current localStorage atoms are **global** (not per-project) — they represent whichever project was active before this migration. Migration strategy:
1. On first load with new code: read global localStorage keys → write to active project's `.flow/ui-state.json`
2. Clear global localStorage keys after successful write
3. Other projects (not yet opened) start fresh with "auto-open most active epic" behavior (no data loss — the global state was only ever for one project)
4. If `.flow/` doesn't exist yet (needs-setup), skip migration — use in-memory defaults until initialized

### Onboarding Wizard

- **5-step modal**: Radix Dialog + Motion AnimatePresence `mode="wait"` + spring config `{ type: 'spring', stiffness: 600, damping: 49 }` (matching existing `EpicCreationWizard.tsx` pattern).
- **Step 1 (Welcome)**: Explain flow-next methodology with static content. Read project name from README/package.json via IPC for contextual framing (fallback: use directory basename if README/package.json missing, unreadable, or invalid JSON).
- **Step 2 (Interactive Demo)**: Static clickable walkthrough showing plan → work → review cycle with sample data using project name.
- **Step 3 (Configure)**: Default view mode preference (list/kanban). Skippable.
- **Step 4 (Initialize)**: Run `flowctl init` via FlowBridge. Show progress spinner. `.flow/.gitignore` always includes `ui-state.json`. On error: detailed dialog with error text, troubleshooting, retry/cancel. Skippable (defers init).
- **Step 5 (Create Epic + Celebrate)**: Open existing `EpicCreationWizard`. On success: confetti via `canvas-confetti` (respects `prefers-reduced-motion`). Navigate to new epic's kanban view.
- **Skip behavior**: Steps 1-2 (Welcome + Interactive Demo) are required and not skippable. Steps 3-5 (Configure, Initialize, Create Epic) are individually skippable with sensible defaults. Skipping step 4 means `.flow/` won't exist until later manual init.
- **Old tutorial removal**: The old `OnboardingTutorial.tsx` spotlight tutorial is removed in the same task that creates the new wizard (Task 4), to avoid having two competing onboarding experiences.

### Sidebar Switcher

- New `ProjectSwitcher` component in sidebar area (`LeftSidebar.tsx`).
- Each item: auto-generated colored avatar (initials + deterministic color from name hash), project name, truncated path, health badge.
- **Project name priority**: (1) `name` field from `package.json`, (2) directory basename if `package.json` missing/invalid.
- Health badge: green check (`.flow/` exists + epic count), yellow warning (needs setup).
- `+ Add Project` button triggers `OPEN_FOLDER_DIALOG` IPC (existing at `types.ts:631`). Auto-detect git root via `git rev-parse --show-toplevel`; if command fails (not a git repo, no git binary), proceed with selected directory without error. If selected dir ≠ git root, suggest git root.
- Remove: unregister only (`.flow/` stays on disk).

### Task Execution Order

To minimize file conflicts in `ipc.ts` and `types.ts`:
- **Task 1 (foundation)**: Creates ALL new IPC channel definitions and `ElectronAPI` type signatures upfront, plus `activeFlowProjectAtom`, path resolution replacement, and FlowWatcher lifecycle.
- **Task 2 (persistence)**: Implements UI state read/write handlers and migrates localStorage atoms. Depends on Task 1.
- **Tasks 3 and 4**: Can run in parallel after Task 2. Task 3 creates sidebar UI. Task 4 creates wizard shell + removes old tutorial.
- **Task 5**: Implements wizard steps 3-5. Depends on Task 4.
- **Task 6**: Empty states and edge cases. Depends on Tasks 3 and 5 (needs sidebar for CTA, wizard complete for clean state).

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Dual "workspace" concept confusion | Use `FlowProject` / `activeFlowProjectAtom` naming; audit all variable names |
| localStorage migration edge cases | Global state → active project's ui-state.json; other projects start fresh (no per-project data existed) |
| `.flow/ui-state.json` doesn't exist during onboarding | Use in-memory defaults until `.flow/` initialized |
| Existing `OnboardingTutorial.tsx` overlap | Remove in Task 4 (same task that creates replacement) |
| `canvas-confetti` new dependency | Lightweight (~4KB gzip), no framework deps, web worker support; respects prefers-reduced-motion |
| FlowWatcher race on rapid project switching | Atom effect with debounce; tear down previous before starting new |
| `ipc.ts`/`types.ts` file conflicts | All IPC types defined in Task 1; tasks serialize through Task 2 before branching |
| Null project path in IPC calls | Handle null/undefined gracefully (return error response, don't crash) |

## Quick commands

```bash
# Typecheck the electron app
cd apps/electron && bun run typecheck

# Lint check
cd apps/electron && bun run lint

# Build and start
cd apps/electron && bun run start
```

## Acceptance

- [ ] Tasks view uses `activeFlowProjectAtom.path` instead of `process.cwd()`
- [ ] Jotai atom tracks active project path + flow status + git info
- [ ] FlowBridge instances use `activeFlowProjectAtom.path` through existing cache
- [ ] FlowWatcher lifecycle managed on project switch (teardown old, start new, debounced)
- [ ] All new IPC channels have typed `ElectronAPI` method signatures
- [ ] FlowBridge IPC calls handle null project path gracefully
- [ ] Sidebar shows project list with auto-generated avatars and health badges
- [ ] `+ Add Project` opens native OS folder picker with git root auto-detection (graceful fallback if not git repo)
- [ ] Switching projects is instant (cached state swap, background refresh)
- [ ] 5-step onboarding wizard shown when `.flow/` doesn't exist
- [ ] Onboarding welcome step explains flow-next methodology with project context from README/package.json
- [ ] Interactive demo step shows plan → work → review cycle with project name
- [ ] Configuration step offers default view preference
- [ ] Steps 1-2 required, steps 3-5 individually skippable
- [ ] Step 5 reuses EpicCreationWizard, ends with confetti (respects prefers-reduced-motion) + summary
- [ ] UI state persisted to `.flow/ui-state.json` (always gitignored, debounced 500ms)
- [ ] Per-project state restored on switch (open tabs, active tab, view mode)
- [ ] localStorage migration: global state → active project's ui-state.json on first load
- [ ] First open of cloned repo shows brief project overview welcome
- [ ] `.flow/` deletion detected via FlowWatcher, user prompted to re-initialize
- [ ] No projects registered shows polished empty state with add project CTA
- [ ] Error during init shows detailed dialog with troubleshooting + retry
- [ ] Old `OnboardingTutorial.tsx` spotlight tutorial removed (in Task 4)
- [ ] Monorepo: `.flow/` only checked at exact registered project path (no parent search)
- [ ] `canvas-confetti` respects `prefers-reduced-motion: reduce`

## References

- Spec: `docs/specs/workspace-aware-tasks-onboarding.md`
- FlowBridge cache: `apps/electron/src/main/ipc.ts:2545-2585`
- FlowWatcher: `apps/electron/src/main/lib/flow-watcher.ts`
- Task atoms: `apps/electron/src/renderer/atoms/tasks-state.ts`
- Existing wizard: `apps/electron/src/renderer/components/tasks/EpicCreationWizard.tsx`
- Existing tutorial: `apps/electron/src/renderer/components/tasks/OnboardingTutorial.tsx`
- Existing empty state: `apps/electron/src/renderer/components/tasks/TasksEmptyState.tsx`
- AppShell context: `apps/electron/src/renderer/context/AppShellContext.tsx:179-183`
- Sidebar: `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx`
- IPC channels: `apps/electron/src/shared/types.ts`
- Workspace type: `packages/core/src/types/workspace.ts:11-20`
- localStorage keys: `apps/electron/src/renderer/lib/local-storage.ts`
