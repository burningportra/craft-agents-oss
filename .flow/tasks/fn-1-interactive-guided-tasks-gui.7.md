# fn-1-interactive-guided-tasks-gui.7 Slide-over task detail panel: Spec, Deps, Activity tabs

## Description
Build the slide-over task detail panel that opens when clicking a task card. Tabbed content: Spec (markdown), Deps (blocking/blocked-by), Activity (status history).

**Size:** M
**Files:**
- `apps/electron/src/renderer/components/tasks/TaskDetailSlideOver.tsx` — slide-over container with animation
- `apps/electron/src/renderer/components/tasks/TaskSpecTab.tsx` — markdown spec rendering
- `apps/electron/src/renderer/components/tasks/TaskDepsTab.tsx` — dependency list with links
- `apps/electron/src/renderer/components/tasks/TaskActivityTab.tsx` — status change history

## Approach

- Slide-over: Radix Dialog + Motion `initial={{ x: '100%' }} animate={{ x: 0 }}` with spring transition
- Width: 400px, right-aligned, overlay dims kanban behind
- Tabs: Radix Tabs inside the panel. Tab bar stays sticky at top.
- Spec tab: reuse existing `<Markdown>` component from `packages/ui/src/components/markdown/Markdown.tsx`
- Deps tab: list of blocking tasks and blocked-by tasks, each clickable to navigate to that task
- Activity tab: status transitions with timestamps (read from task JSON history if available)
- Header: task title, status badge, close button, action buttons (Start, Complete, etc.)

## Key context

- Practice scout: use Radix Dialog (not Vaul drawer) for right-side slide-over
- Motion `AnimatePresence` required for exit animation
- Each tab panel should scroll independently, tab bar fixed
- Markdown component already handles remark-gfm + rehype-raw
## Acceptance
- [ ] Clicking task card opens slide-over panel from right
- [ ] Panel animates in/out with spring transition
- [ ] Spec tab renders task spec as markdown
- [ ] Deps tab lists blocking and blocked-by tasks with clickable links
- [ ] Activity tab shows status change history with timestamps
- [ ] Tab bar stays sticky at top while content scrolls
- [ ] Header shows task title, status badge, close button
- [ ] Action buttons (Start, Complete) update task status via IPC
- [ ] Escape key closes panel
## Done summary
Implemented slide-over task detail panel with three tabs: Spec (renders task spec as markdown), Deps (shows blocking/blocked-by tasks with clickable navigation), and Activity (displays status history with timestamps). Panel uses Radix Dialog with Motion spring animation, includes action buttons for Start/Complete status updates, and subscribes to flow:changed events for live updates.
## Evidence
- Commits: d5c3ecb, 9a809a1
- Tests: bun typecheck, bun lint
- PRs: