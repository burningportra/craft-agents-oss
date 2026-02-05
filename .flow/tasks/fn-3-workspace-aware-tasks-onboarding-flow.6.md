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
  - CTA: "Add a Project" button → calls the same handler as sidebar's `+ Add Project` (from Task 3). Import and reuse the handler function.
  - Follow existing `Empty` compound component pattern from `TasksEmptyState.tsx`
- **`.flow/` deletion detection**:
  - FlowWatcher at `flow-watcher.ts:99-105` already handles this (atom effect from Task 1 manages lifecycle)
  - On deletion: show banner in Tasks view — ".flow/ was removed. Re-initialize?"
  - Update `activeFlowProjectAtom.flowStatus` to `'needs-setup'`
  - "Re-initialize" triggers onboarding wizard or direct `flowctl init`
- **Monorepo handling**: Only look for `.flow/` at exact registered project path (no parent directory search). If user wants repo root, they should register repo root.

## Key context

- `TasksEmptyState.tsx` uses the `Empty` compound component — follow same pattern for new empty states
- FlowWatcher's `.flow/` deletion handling (`flow-watcher.ts:99-105`) falls back to parent directory watching
- Task 3's `ProjectSwitcher` has the `+ Add Project` handler — reuse it via shared function/atom
## Approach

- **Brief welcome (cloned repo with `.flow/`)**:
  - When a project has `.flow/` but user opens it for the first time (no `ui-state.json` yet):
    - Show dismissible banner with: project name, epic count, task count, in-progress work summary
    - Auto-open the most active epic (most in-progress tasks)
    - Non-blocking — user can dismiss immediately
  - Track dismissal per-project (store in `ui-state.json` or localStorage)
- **Empty state (no projects)**:
  - When `registeredProjectsAtom` is empty: show polished empty state in Tasks view
  - Explain the project concept with illustration
  - CTA: "Add a Project" button → triggers `+ Add Project` flow from sidebar switcher
  - Follow existing `Empty` compound component pattern from `TasksEmptyState.tsx`
- **`.flow/` deletion detection**:
  - FlowWatcher at `flow-watcher.ts:99-105` already handles this
  - On deletion: show banner in Tasks view — ".flow/ was removed. Re-initialize?"
  - Update `activeProjectAtom.flowStatus` to `'needs-setup'`
  - "Re-initialize" triggers onboarding wizard or direct `flowctl init`
- **Monorepo handling**: Only look for `.flow/` at project root (the registered path)
- **Remove old tutorial**: Delete `OnboardingTutorial.tsx` and its references. Remove `KEYS.flowTasksOnboardingComplete` from localStorage registry.

## Key context

- `TasksEmptyState.tsx` uses the `Empty` compound component — follow same pattern for new empty states
- FlowWatcher's `.flow/` deletion handling (`flow-watcher.ts:99-105`) falls back to parent directory watching
- `OnboardingTutorial.tsx` has a 4-step spotlight overlay with localStorage persistence — all of this gets removed
- `local-storage.ts` has the `KEYS` registry — clean up removed keys
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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
