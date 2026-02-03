# fn-1-interactive-guided-tasks-gui.9 Epic creation wizard: Quick, Standard, Complex templates

## Description
Build the epic creation wizard triggered by the '+' button. Three complexity tiers: Quick (one-liner → auto-plan), Standard (5-10 question light interview), Complex (creates shell → opens chat).

**Size:** M
**Files:**
- `apps/electron/src/renderer/components/tasks/EpicCreationWizard.tsx` — wizard dialog with step management
- `apps/electron/src/renderer/components/tasks/QuickEpicStep.tsx` — one-liner input
- `apps/electron/src/renderer/components/tasks/StandardInterviewStep.tsx` — multi-question form
- `apps/electron/src/renderer/components/tasks/ComplexEpicStep.tsx` — shell creation + chat handoff

## Approach

- Follow `OnboardingWizard.tsx` pattern: discriminated union step types, parent manages state
- Step 1: Template picker — three cards: Quick / Standard / Complex with descriptions
- Quick flow: text input → calls `FLOW_EPIC_CREATE` IPC → auto-navigate to new epic tab
- Standard flow: structured form with questions:
  1. Title (required)
  2. Description / problem statement
  3. Acceptance criteria (textarea, one per line)
  4. Dependencies on other epics (optional dropdown)
  5. Estimated complexity (S/M/L selector)
  6. Technical notes / constraints
  Creates epic + tasks via IPC.
- Complex flow: title + description → creates epic shell → opens split-view chat for deep interview (task 10)
- Wizard opens as Radix Dialog (modal)
- '+' button positioned in navigator panel header and tab bar

## Key context

- OnboardingWizard at `components/onboarding/OnboardingWizard.tsx` is the pattern reference
- Quick template should be fast: single text input, no modal steps after submission
- Complex template just creates the epic and hands off to the chat — no interview in the wizard itself
## Approach

- Follow `OnboardingWizard.tsx` pattern: discriminated union step types, parent manages state
- Step 1: Template picker — three cards: Quick / Standard / Complex with descriptions
- Quick flow: text input → calls `flow:epic-create` IPC → auto-navigate to new epic tab
- Standard flow: 5-10 structured questions (title, description, acceptance criteria, tech notes, risk level) → creates epic + tasks via IPC
- Complex flow: title + description → creates epic shell → opens split-view chat for deep interview (task 10)
- Wizard opens as Radix Dialog (modal)
- '+' button positioned in navigator panel header and tab bar

## Key context

- OnboardingWizard at `components/onboarding/OnboardingWizard.tsx` is the pattern reference
- Quick template should be fast: single text input, no modal steps after submission
- Standard template questions should be derived from flow-next interview methodology
- Complex template just creates the epic and hands off to the chat — no interview in the wizard itself
## Acceptance
- [ ] '+' button in navigator panel and tab bar opens wizard
- [ ] Template picker shows Quick / Standard / Complex cards
- [ ] Quick: one-liner input → epic created → navigates to new epic
- [ ] Standard: 6-question form (title, description, acceptance, deps, complexity, tech notes) → epic + tasks created
- [ ] Complex: title + description → epic shell created → opens split-view chat
- [ ] Wizard dialog is modal with escape to close
- [ ] Back/Next navigation between wizard steps
- [ ] Loading state while IPC calls execute
- [ ] Error handling with retry option on failure
## Done summary
Implemented epic creation wizard with Quick, Standard, and Complex templates as a modal dialog triggered from both the tab bar '+' button and navigator panel header. Added Zod validation schemas, full accessibility support (keyboard navigation, ARIA), abort signal handling for memory leak prevention, and comprehensive data-testid attributes for E2E testing.
## Evidence
- Commits: 6023da6, 09beb93
- Tests: npx tsc --noEmit -p apps/electron/tsconfig.json
- PRs: