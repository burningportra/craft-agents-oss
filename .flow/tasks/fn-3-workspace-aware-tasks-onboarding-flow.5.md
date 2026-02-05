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
- FlowBridge already has `init()` method at `flow-bridge.ts` — may just need IPC wiring
## Approach

- **Step 3 (Configure)**:
  - Toggle: gitignore `ui-state.json` (default: yes)
  - Select: default view mode (list/kanban, default: kanban)
  - Store preferences in a local config atom; apply when `.flow/` is initialized
  - Skippable — uses defaults
- **Step 4 (Initialize)**:
  - Call `flowctl init` via FlowBridge IPC
  - Show animated progress spinner during init
  - On success: update `activeProjectAtom.flowStatus` to `'initialized'`, auto-advance to step 5
  - On error: show detailed error dialog with full error text, troubleshooting steps, retry button, cancel button
  - Skippable — but skipping means `.flow/` won't exist yet (user must init later)
- **Step 5 (Create Epic + Celebrate)**:
  - Open the existing `EpicCreationWizard` (Quick/Standard/Complex modes) inline or as nested dialog
  - On epic creation success:
    - `canvas-confetti` burst animation (new dependency, ~4KB gzip, no framework deps)
    - Summary card showing what was created (epic name, task count)
    - "Get Started" button closes wizard and navigates to the new epic's kanban view
  - Skippable — closes wizard without creating an epic
- Wire skip behavior: "Skip" button on steps 3-5 advances to next step (or closes wizard if step 5)
- Add `FLOW_INIT` IPC channel if not already present (check existing channels first)

## Key context

- `EpicCreationWizard.tsx` has props `{ open, onOpenChange, workspaceRoot, epics, onEpicCreated, onOpenChat }` — reuse for step 5
- `canvas-confetti` is recommended over `react-confetti` — lighter, supports web workers, no React dependency
- FlowBridge already has methods for flowctl operations — may need a `runInit()` method or use existing exec pattern
- The IPC channel `FLOW_EPIC_CREATE` from epic fn-1 may already exist — check and reuse
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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
