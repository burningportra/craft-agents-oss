# fn-3-workspace-aware-tasks-onboarding-flow.4 Onboarding Wizard Shell & Steps 1-2

## Description
Build the onboarding wizard modal shell, implement steps 1-2 (Welcome + Interactive Demo), and remove the old `OnboardingTutorial.tsx` spotlight tutorial. Steps 1-2 are required (not skippable).

**Size:** M
**Files:** new `apps/electron/src/renderer/components/tasks/OnboardingWizard.tsx`, `apps/electron/src/renderer/pages/TasksPage.tsx`, `apps/electron/src/renderer/components/tasks/OnboardingTutorial.tsx` (delete), `apps/electron/src/renderer/lib/local-storage.ts`

## Approach

- Create `OnboardingWizard` component as a Radix Dialog modal
- Follow the existing `EpicCreationWizard.tsx` pattern: Radix Dialog + Motion AnimatePresence `mode="wait"` + spring config `{ type: 'spring', stiffness: 600, damping: 49 }`
- Props: `open`, `onOpenChange`, `projectPath`, `onComplete`
- Step navigation: prev/next buttons, step indicator dots, progress bar
- **Step 1 (Welcome)**:
  - Explain the flow-next plan → work → review methodology with static content
  - Use `FLOW_READ_PROJECT_CONTEXT` IPC (defined in Task 1) to read project name from README.md + package.json for contextual framing (e.g., "Set up flow-next for <project-name>")
  - Fallback triggers if README/package.json don't exist, can't be read, or JSON parse fails. Use generic "your project" as project name.
- **Step 2 (Interactive Demo)**:
  - Show a mock kanban board or task flow visualization with sample data
  - Clickable elements that highlight how epics, tasks, and the AI-assisted workflow operate
  - Use the project name from step 1 in demo content
  - Static animations using Motion for polish
- Trigger in `TasksPage.tsx`: when `activeFlowProjectAtom.flowStatus === 'needs-setup'`, show the wizard
- Wire up step state management (current step, completed steps, can-skip logic)
- **Remove old tutorial**: Delete `OnboardingTutorial.tsx` and its references in `TasksPage.tsx`. Remove `KEYS.flowTasksOnboardingComplete` from `local-storage.ts`. This prevents two competing onboarding experiences.
- Wizard shell handles all 5 steps but this task only implements steps 1-2. Steps 3-5 are wired as placeholder/pass-through that Task 5 will fill in.

## Key context

- `EpicCreationWizard.tsx` is the closest existing pattern — study its Dialog + AnimatePresence setup
- IPC channel `FLOW_READ_PROJECT_CONTEXT` types and handler already implemented by Task 1. Renderer calls `window.electronAPI.flowReadProjectContext(path)` which returns `FlowProjectContext | null` (type: `{ name: string, description?: string }`)
- Old `OnboardingTutorial.tsx` at L128-137 in `TasksPage.tsx` uses `isFirstTimeUser` state — remove this entirely
- `activeFlowProjectAtom` shape includes `error?: string` field for error state display
## Acceptance
- [ ] `OnboardingWizard` component renders as a Radix Dialog modal
- [ ] Wizard has step navigation (prev/next, indicator dots, progress bar)
- [ ] Step 1 shows flow-next methodology explanation with project context
- [ ] Step 1 reads project name from README/package.json via IPC (with fallback to "your project")
- [ ] Step 2 shows interactive demo with clickable elements and project name
- [ ] Steps 1-2 are not skippable (next only)
- [ ] Wizard triggers when `activeFlowProjectAtom.flowStatus === 'needs-setup'`
- [ ] Wizard shell has placeholder slots for steps 3-5 (implemented in Task 5)
- [ ] AnimatePresence transitions match existing wizard pattern
- [ ] Old `OnboardingTutorial.tsx` is deleted
- [ ] `KEYS.flowTasksOnboardingComplete` removed from `local-storage.ts`
- [ ] No competing onboarding experiences exist
- [ ] App typechecks and lints clean
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
