# fn-1-interactive-guided-tasks-gui.5 Kanban board: columns, task cards, drag-drop status changes

## Description
Build the kanban board view as the main content area when an epic is selected. Four columns (todo, in_progress, blocked, done) with task cards and drag-drop for pure status changes.

**Size:** M
**Files:**
- `apps/electron/src/renderer/components/tasks/KanbanBoard.tsx` — board layout with 4 columns
- `apps/electron/src/renderer/components/tasks/KanbanColumn.tsx` — droppable column
- `apps/electron/src/renderer/components/tasks/TaskCard.tsx` — draggable task card with agent badge
- `apps/electron/src/renderer/components/tasks/KanbanDragOverlay.tsx` — drag preview

## Approach

- Use `@dnd-kit/core` with `useDroppable` on columns, `useDraggable` on cards (NOT `@dnd-kit/sortable` — no intra-column reordering needed, justifies simpler API)
- `DragOverlay` renders card preview during drag
- `PointerSensor` with `activationConstraint: { distance: 8 }` to prevent accidental drags
- `KeyboardSensor` for accessibility
- `onDragEnd`: if target column === source column, no-op. Otherwise extract target status, call `FLOW_TASK_UPDATE_STATUS` IPC, optimistic update with rollback on failure
- Task card shows: title, status badge, size indicator, assignee (if claimed), agent status badge ("Agent working..." with spinner when active)
- Blocked column: tasks with unresolved dependencies shown with lock icon

## Key context

- `@dnd-kit/core` v6.3.1 already installed
- Optimistic update: immediately move card, revert if IPC call fails (with sonner toast error)
- Agent badge: check task assignee field for agent marker (implementation detail — detect via assignee naming convention or separate field)
## Approach

- Use `@dnd-kit/core` with `useDroppable` on columns, `useDraggable` on cards (NOT `@dnd-kit/sortable` — no intra-column reordering needed)
- `DragOverlay` renders card preview during drag
- `PointerSensor` with `activationConstraint: { distance: 8 }` to prevent accidental drags
- `KeyboardSensor` for accessibility
- `onDragEnd`: extract target column status, call `flow:task-update-status` IPC, optimistic update with rollback on failure
- Task card shows: title, status badge, size indicator, assignee (if claimed), agent badge (if active)
- Drag within same column = no-op
- Blocked column: tasks with unresolved dependencies shown with lock icon

## Key context

- Practice scout confirmed: use `useDroppable`/`useDraggable` (not sortable) for pure status change kanban
- `@dnd-kit/core` v6.3.1 and `@dnd-kit/sortable` v10.0.0 already installed
- Optimistic update: immediately move card, revert if IPC call fails (with toast error)
## Acceptance
- [ ] Kanban board renders 4 columns: todo, in_progress, blocked, done
- [ ] Task cards display title, status badge, size, assignee
- [ ] Agent status badge ("Agent working...") shown on cards with active agents
- [ ] Drag-drop moves card between columns (status change via IPC)
- [ ] Drag within same column is no-op (no intra-column reordering)
- [ ] DragOverlay shows card preview during drag
- [ ] Optimistic update with rollback on failure (sonner toast)
- [ ] Keyboard sensor enables accessible drag-drop
- [ ] Empty column shows placeholder text
## Done summary
Implemented Kanban board view with 4 columns (todo, in_progress, blocked, done), task cards with status/size badges, and drag-drop status changes using @dnd-kit. Features optimistic updates with rollback, keyboard accessibility, and sonner toast error feedback.
## Evidence
- Commits: b369ff9, 478895a
- Tests: bun lint
- PRs: