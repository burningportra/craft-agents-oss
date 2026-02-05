# fn-3-workspace-aware-tasks-onboarding-flow.5 Onboarding Wizard Steps 3-5

## Description
Implement the remaining onboarding wizard steps: Configure (3), Initialize (4), and Create Epic + Celebrate (5). These steps are individually skippable with sensible defaults.

**Size:** M
**Files:** `apps/electron/src/renderer/components/tasks/OnboardingWizard.tsx`, `apps/electron/src/main/ipc.ts`, `apps/electron/package.json`

## Approach

- **Step 3 (Configure)**:
  - Select: default view mode (list/kanban, default: kanban)
  - Store preferences in a local config atom; apply when `.flow/` is initialized
  - Skippable — uses defaults
- **Step 4 (Initialize)**:
  - Call `flowctl init` via FlowBridge IPC
  - Show animated progress spinner during init
  - `.flow/.gitignore` always includes `ui-state.json` (no toggle — always gitignored)
  - On success: update `activeFlowProjectAtom.flowStatus` to `'initialized'`, auto-advance to step 5
  - On error: show detailed error dialog with full error text, troubleshooting steps, retry button, cancel button
  - Skippable — but skipping means `.flow/` won't exist until later manual init
- **Step 5 (Create Epic + Celebrate)**:
  - Open the existing `EpicCreationWizard` (Quick/Standard/Complex modes) inline or as nested dialog
  - On epic creation success:
    - `canvas-confetti` burst animation (respects `prefers-reduced-motion: reduce` — skip animation if set)
    - Summary card showing what was created (epic name, task count)
    - "Get Started" button closes wizard and navigates to the new epic's kanban view
  - Skippable — closes wizard without creating an epic
- Wire skip behavior: "Skip" button on steps 3-5 advances to next step (or closes wizard if step 5)
- Add `canvas-confetti` to `apps/electron/package.json` dependencies (~4KB gzip, no React dependency)
- Check if `FLOW_INIT` IPC channel exists; if not, implement handler that calls FlowBridge `init()` method

## Key context

- `EpicCreationWizard.tsx` has props `{ open, onOpenChange, workspaceRoot, epics, onEpicCreated, onOpenChat }` — reuse for step 5
- `canvas-confetti` is recommended over `react-confetti` — lighter, supports web workers, no React dependency
<!-- Updated by plan-sync: fn-3...1 used activeFlowProjectAtom (not activeProjectAtom), and FlowWatcher lifecycle is managed via syncFlowWatcherAtom action atom -->
<!-- Updated by plan-sync: fn-3...2 — note that DEFAULT_VIEW_MODE in tasks-state.ts is 'list' (not kanban). Step 3's "default: kanban" is the wizard's recommended selection; if user skips Step 3, the code-level default 'list' applies. Ensure Step 3 sets viewModePerEpic via setViewModeAtom (exported from tasks-state.ts) which triggers scheduleUiStatePersistAtom for debounced write to .flow/ui-state.json. -->
- FlowBridge already has `init()` method at `flow-bridge.ts` — may just need IPC wiring
- On init success, use `setActiveFlowProjectAtom` to refresh status (it calls `flowProjectCheckStatus` and updates `activeFlowProjectAtom.flowStatus`)
- `.flow/.gitignore` management for `ui-state.json` is already handled by FlowBridge's `writeUiState()` (Task 2) — no extra gitignore work needed after init
## Acceptance
- [ ] Step 3 shows configure options (default view mode)
- [ ] Step 3 defaults are sensible (kanban view)
- [ ] Step 4 runs `flowctl init` and shows progress
- [ ] Step 4 on success: updates flowStatus to 'initialized', auto-advances
- [ ] Step 4 on error: shows detailed error dialog with retry/cancel
- [ ] `.flow/.gitignore` always includes `ui-state.json` after init
- [ ] Step 5 opens EpicCreationWizard for epic creation
- [ ] Step 5 on success: confetti animation + summary card + "Get Started" button
- [ ] Confetti respects `prefers-reduced-motion: reduce` (skip if set)
- [ ] "Get Started" navigates to new epic's kanban view
- [ ] Steps 3-5 are individually skippable
- [ ] `canvas-confetti` added to `apps/electron/package.json` dependencies
- [ ] App typechecks and lints clean
## Done summary
Implemented OnboardingWizard steps 3-5: Configure (view mode selector with kanban default), Initialize (flowctl init with progress spinner, auto-advance, error handling with retry/cancel), and Create Epic + Celebrate (embedded EpicCreationWizard, canvas-confetti with prefers-reduced-motion respect, summary card, Get Started button). All steps individually skippable. Added canvas-confetti dependency. Review fixes addressed memory leak, view mode persistence, re-entry bug, and error type safety.
## Evidence
- Commits: eec4597, a26bf83
- Tests: cd apps/electron && bun run typecheck, cd apps/electron && bun run lint
- PRs: