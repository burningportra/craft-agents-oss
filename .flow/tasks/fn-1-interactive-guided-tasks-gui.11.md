# fn-1-interactive-guided-tasks-gui.11 Collapsible AI suggestion sidebar with contextual nudges

## Description
Build the collapsible AI suggestion sidebar that analyzes current epic/task state and recommends actions. Appears as a right panel that can be toggled open/closed.

**Size:** M
**Files:**
- `apps/electron/src/renderer/components/tasks/AISuggestionSidebar.tsx` — collapsible sidebar container
- `apps/electron/src/renderer/components/tasks/SuggestionCard.tsx` — individual suggestion with action button
- `apps/electron/src/renderer/atoms/tasks-state.ts` — add suggestion sidebar state atoms

## Approach

- Collapsible panel on right side of tasks view, toggle via button in toolbar
- State: `sidebarOpenAtom` persisted with `atomWithStorage`, defaults to collapsed
- Suggestions re-evaluated on epic/task state change (debounced 500ms). Client-side rules, not LLM-powered:
  - Epic has no tasks → "Run /plan to create tasks"
  - Task stuck in_progress >24h → "Check on this task"
  - All tasks done → "Run epic review" (also triggers auto-prompt)
  - Epic has no dependencies → "Add dependencies if needed"
  - Tasks have no specs → "Interview to add detail"
- Max 3 suggestions shown at a time, prioritized by urgency
- Each suggestion: icon, title, description, action button (executes the suggestion)
- Dismiss individual suggestions (remembered per epic in Jotai atom)
- Animate with Motion `AnimatePresence` for enter/exit
- Auto-prompt for epic review: when "all tasks done" rule fires, also show a prominent banner/toast prompting review

## Key context

- Suggestions are rule-based, not LLM-powered (keeps it fast and free)
- Don't show suggestions on truly empty state (no .flow/) — that's the onboarding flow
- The "all tasks done" rule doubles as the epic review auto-prompt (epic acceptance criterion)
## Approach

- Collapsible panel on right side of tasks view, toggle via button in toolbar
- State: `sidebarOpenAtom` persisted with `atomWithStorage`, defaults to collapsed
- Suggestions generated from epic state analysis (client-side rules, not AI model):
  - Epic has no tasks → "Run /plan to create tasks"
  - Task stuck in_progress >24h → "Check on this task"
  - All tasks done → "Run epic review"
  - Epic has no dependencies → "Add dependencies if needed"
  - Tasks have no specs → "Interview to add detail"
- Max 3 suggestions shown at a time, prioritized by urgency
- Each suggestion: icon, title, description, action button (executes the suggestion)
- Dismiss individual suggestions (remembered per epic in Jotai atom)
- Animate with Motion `AnimatePresence` for enter/exit

## Key context

- Suggestions are rule-based, not LLM-powered (keeps it fast and free)
- Collapsible sidebar pattern: use Motion for slide animation, Radix Collapsible for state
- Don't show suggestions on truly empty state (no .flow/) — that's the onboarding flow
## Acceptance
- [ ] Sidebar toggles open/closed via toolbar button
- [ ] Sidebar state persists across sessions
- [ ] Rule-based suggestions re-evaluated on state change (debounced 500ms)
- [ ] Max 3 suggestions shown, prioritized by urgency
- [ ] Each suggestion has icon, title, description, action button
- [ ] Clicking action button executes the suggestion
- [ ] Individual suggestions dismissable (remembered per epic)
- [ ] Sidebar animates in/out smoothly
- [ ] No suggestions shown when .flow/ doesn't exist
- [ ] "All tasks done" triggers auto-prompt for epic review (banner/toast)
## Done summary
Added collapsible AI suggestion sidebar with rule-based contextual nudges. Features include debounced suggestion re-evaluation (500ms), max 3 prioritized suggestions, dismissable suggestions per epic, smooth Motion animations, and auto-prompt banner/toast when all tasks are done.
## Evidence
- Commits: dcb9fa7
- Tests: bun typecheck (electron app)
- PRs: