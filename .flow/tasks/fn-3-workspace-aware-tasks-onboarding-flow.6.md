# fn-3-workspace-aware-tasks-onboarding-flow.6 Brief Welcome, Empty States & Edge Cases

## Description
Implement the brief welcome banner for cloned repos, polished empty states, and edge case handling.

**Size:** M
**Files:** `apps/electron/src/renderer/components/tasks/TasksEmptyState.tsx`, `apps/electron/src/renderer/pages/TasksPage.tsx`

## Approach

- **Brief welcome (cloned repo with `.flow/`)**:
  - When a project has `.flow/` but user opens it for the first time (no `ui-state.json` yet):
    - Show dismissible banner with: project name, epic count, task count, in-progress work summary
    - Auto-open the most active epic (most in-progress tasks → most recently updated → first by epic ID)
    - Non-blocking — user can dismiss immediately
  - Track dismissal per-project (store `welcomeDismissed: true` in `ui-state.json`)
- **Empty state (no projects)**:
  - When `registeredFlowProjectsAtom` is empty: show polished empty state in Tasks view
  - Explain the project concept with illustration
  - CTA: "Add a Project" button → should behave identically to sidebar's `+ Add Project` (from Task 3). The handler logic in `ProjectSwitcher.tsx` is a local `useCallback` (`handleAddProject`) and is NOT exported. Either extract the shared logic (folder dialog + git root detection + `registerFlowProjectAtom`) into a reusable hook/atom, or re-compose from: `window.electronAPI.openFolderDialog()`, `window.electronAPI.getGitRoot(path)`, `window.electronAPI.flowProjectCheckStatus(path)`, `window.electronAPI.flowReadProjectContext(path)`, and `registerFlowProjectAtom`. The git root suggestion dialog (`GitRootDialog` sub-component) is also local to `ProjectSwitcher.tsx`.
  - Follow existing `Empty` compound component pattern from `TasksEmptyState.tsx`
- **`.flow/` deletion detection**:
  - FlowWatcher at `flow-watcher.ts:99-105` already handles this (`syncFlowWatcherAtom` action atom from Task 1 manages watcher lifecycle; not an atom effect but an action atom called by `setActiveFlowProjectAtom`)
  - On deletion: show banner in Tasks view — ".flow/ was removed. Re-initialize?"
  - Update `activeFlowProjectAtom.flowStatus` to `'needs-setup'` (use `setActiveFlowProjectAtom` to re-check status)
  - "Re-initialize" triggers onboarding wizard or direct `flowctl init`
- **Monorepo handling**: Only look for `.flow/` at exact registered project path (no parent directory search). If user wants repo root, they should register repo root.

## Key context

- `TasksEmptyState.tsx` uses the `Empty` compound component — follow same pattern for new empty states
- FlowWatcher's `.flow/` deletion handling (`flow-watcher.ts:99-105`) falls back to parent directory watching
<!-- Updated by plan-sync: fn-3...1 used activeFlowProjectAtom/registeredFlowProjectsAtom (not activeProjectAtom/registeredProjectsAtom). Action atoms: registerFlowProjectAtom, unregisterFlowProjectAtom, setActiveFlowProjectAtom. Old tutorial removal moved to Task 4. -->
<!-- Updated by plan-sync: fn-3...2 already implemented auto-open most active epic logic in loadEpicsAtom (tasks-state.ts ~L674-686) via findMostActiveEpic(). When no ui-state.json exists and no tab is selected, loadEpicsAtom auto-opens the most active epic using the same tiebreaker (in-progress count → updated_at → epic ID). Task 6 should NOT re-implement this — focus only on the brief welcome banner UI overlay. The auto-open fires automatically from the existing hydration + epic-load path. -->
- Task 3's `ProjectSwitcher` has the `+ Add Project` handler — but it is a local `useCallback` (`handleAddProject` at line 458), NOT exported. It calls `openFolderDialog()` → `getGitRoot()` → shows `GitRootDialog` (local sub-component) if git root differs → `registerFlowProjectAtom`. To reuse, extract into a shared hook or re-compose from underlying APIs.
<!-- Updated by plan-sync: fn-3...3 — handleAddProject is a local useCallback inside ProjectSwitcher, not a shared function/atom. GitRootDialog is also a local sub-component. Reuse requires extraction or re-composition from underlying IPC calls + registerFlowProjectAtom. -->
- Old tutorial removal (OnboardingTutorial.tsx + KEYS.flowTasksOnboardingComplete) is handled in Task 4, not Task 6
- Auto-open most active epic is already implemented in `loadEpicsAtom` (Task 2) — the brief welcome banner is additive UI on top of existing auto-open behavior
- `FlowUiState` type (in `types.ts`) currently has `{ openTabs?, activeTab?, viewModePerEpic? }` — Task 6 needs to extend it with `welcomeDismissed?: boolean`
## Acceptance
- [ ] Brief welcome banner shows for cloned repos (has `.flow/`, no `ui-state.json`)
- [ ] Banner shows project name, epic/task counts, in-progress summary
- [ ] Banner is dismissible and dismissal persisted in `ui-state.json`
- [ ] Most active epic auto-opens on first visit (in-progress count → updated_at → epic ID)
- [ ] No-projects empty state shows with "Add a Project" CTA
- [ ] "Add a Project" CTA reuses same handler as sidebar's `+ Add Project`
- [ ] Empty state follows existing `Empty` compound component pattern
- [ ] `.flow/` deletion triggers banner with re-init option
- [ ] `activeFlowProjectAtom.flowStatus` updates to `'needs-setup'` on deletion
- [ ] Monorepo: `.flow/` only checked at exact registered project path
- [ ] App typechecks and lints clean
## Done summary
Implemented brief welcome banner for cloned repos, polished no-projects empty state with Add a Project CTA, and .flow/ deletion detection with re-init banner. Extracted shared useAddProject hook from ProjectSwitcher for reuse, extended FlowUiState with welcomeDismissed persistence, and integrated all components into TasksPage with proper conditional rendering and state management.
## Evidence
- Commits: 96a894f1ba0f62b5dbbe2c63e3e0c757d52278c2
- Tests: cd apps/electron && bun run typecheck, cd apps/electron && bun run lint
- PRs: