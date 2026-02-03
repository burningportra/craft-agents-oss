# fn-1-interactive-guided-tasks-gui.4 Tasks navigator panel: epic list, progress indicators, empty state

## Description
Build the Tasks navigator panel (left panel when Tasks nav is active): epic list with progress indicators, filtering, and empty state for no .flow/ directory.

**Size:** M
**Files:**
- `apps/electron/src/renderer/components/tasks/TasksNavigatorPanel.tsx` — main navigator panel
- `apps/electron/src/renderer/components/tasks/EpicListItem.tsx` — epic row with progress bar
- `apps/electron/src/renderer/components/tasks/TasksEmptyState.tsx` — empty state with init CTA
- `apps/electron/src/renderer/atoms/tasks-state.ts` — Jotai atoms for epics, tasks, loading state
- `apps/electron/src/renderer/pages/TasksPage.tsx` — replace placeholder from task 1

## Approach

- Navigator panel follows `NavigatorPanel.tsx` pattern: `Panel variant="shrink"` + `PanelHeader`
- Fetch epics via IPC `flow:epics-list` on mount, subscribe to `flow:changed` for live updates
- Each epic row: title, status badge, progress bar (done/total tasks), click to select
- Empty state: illustration + "Initialize Flow-Next" button → calls `flow:init` IPC
- Jotai atoms: `epicsAtom` (derived from IPC), `tasksAtomFamily(epicId)`, `selectedEpicAtom`
- Use `atomWithStorage` for `selectedEpicAtom` to persist across sessions

## Key context

- NavigatorPanel is a simple wrapper. The real content is children.
- AppShell.tsx conditionally renders navigator content based on `navState.navigator`
- The '+' button (epic creation) is Task 9 — for now, just show the list + empty state
## Acceptance
- [ ] TasksNavigatorPanel renders when Tasks nav is active
- [ ] Epic list shows all epics with title and progress indicators
- [ ] Clicking an epic selects it and updates navigation state
- [ ] Empty state renders when no .flow/ directory exists
- [ ] "Initialize" button in empty state creates .flow/ via IPC
- [ ] Live updates when flow:changed event received
- [ ] Selected epic persists across sessions via atomWithStorage
- [ ] Loading state shown while fetching epics
## Done summary
- Task completed
## Evidence
- Commits:
- Tests:
- PRs: