# Flow-Next Tasks GUI

**Goal**: Add a "Tasks" navigator to the Craft Agents Electron app that gives PMs a visual interface for flow-next task management — no CLI commands needed.

## Scope

### In scope
- Tasks navigator panel (epic list with progress indicators)
- Kanban board view (tasks grouped by status columns: todo / in_progress / blocked / done)
- Task detail panel with spec rendering (read-only markdown)
- Epic detail view with task list and progress
- Task/epic creation via dialogs
- Drag-and-drop status changes on kanban
- Dependency graph visualization (read-only, dagre layout)
- File watcher for live sync with CLI changes
- Empty states and onboarding (no `.flow/` initialized)

### Out of scope (v1)
- Inline spec editing (PMs use CLI or text editor for now — can add in v2)
- Bulk operations (multi-select, batch status)
- WIP limits on kanban columns
- Interactive dependency edge creation (use dialog-based dep management)
- `flowctl checkpoint` / `flowctl prep-chat` integration
- Kanban column virtualization (defer until perf testing shows need)

## Architecture

### Navigation integration

Follow existing `ChatsNavigationState` / `SourcesNavigationState` pattern:

```typescript
// types.ts
interface TasksNavigationState {
  navigator: 'tasks'
  filter?: { epicId?: string; status?: TaskStatus }
  details?:
    | { type: 'epic'; epicId: string }
    | { type: 'task'; epicId: string; taskId: string }
    | { type: 'graph'; epicId: string }
    | null
  rightSidebar?: null
}

// Add to NavigationState union:
export type NavigationState =
  | ChatsNavigationState
  | SourcesNavigationState
  | SettingsNavigationState
  | SkillsNavigationState
  | TasksNavigationState

// Type guard:
export const isTasksNavigation = (
  state: NavigationState
): state is TasksNavigationState => state.navigator === 'tasks'
```

**Files to modify**:
- `apps/electron/src/shared/types.ts` — add `TasksNavigationState` to union, add `isTasksNavigation()` guard
- `apps/electron/src/shared/routes.ts` — add `routes.view.tasks()`, `routes.view.taskDetail()`, `routes.view.epicDetail()`, `routes.view.taskGraph()`
- `apps/electron/src/shared/route-parser.ts` — parse task routes
- `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx` — add "Tasks" item (Lucide `KanbanSquare` icon, between Skills and Settings)
- `apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx` — add `isTasksNavigation()` branch

### Data access layer

#### Zod schemas

Define schemas for all flow-next data types before any file reads:

```typescript
// shared/flow-schemas.ts
import { z } from 'zod'

const TaskStatus = z.enum(['todo', 'in_progress', 'blocked', 'done'])
const EpicStatus = z.enum(['open', 'done'])

const EpicSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: EpicStatus,
  plan_review_status: z.string().optional(),
  branch_name: z.string().optional(),
  depends_on_epics: z.array(z.string()).optional(),
  spec_path: z.string().optional(),
  next_task: z.number().optional(),
})

const TaskSchema = z.object({
  id: z.string(),
  epic: z.string(),
  title: z.string(),
  status: TaskStatus,
  priority: z.string().optional(),
  depends_on: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  claimed_at: z.string().optional(),
  spec_path: z.string().optional(),
})

const RuntimeStateSchema = z.object({
  status: TaskStatus.optional(),
  updated_at: z.string().optional(),
  assignee: z.string().optional(),
})
```

#### IPC result type

All IPC handlers return a typed Result to avoid try/catch at the renderer boundary:

```typescript
// shared/types.ts
type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: unknown }
```

#### IPC handler pattern

All IPC handlers follow this pattern to construct `IpcResult<T>`:

```typescript
async function handleFlowEpicsList(workspaceRootPath: string): Promise<IpcResult<Epic[]>> {
  try {
    const epicsDir = path.join(workspaceRootPath, '.flow', 'epics')
    if (!existsSync(epicsDir)) return { ok: true, data: [] }

    const files = await readdir(epicsDir)
    const epics: Epic[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const raw = await readFile(path.join(epicsDir, file), 'utf-8')
      const parsed = EpicSchema.safeParse(JSON.parse(raw))

      if (!parsed.success) {
        return { ok: false, error: `Invalid epic file ${file}: ${parsed.error.message}`, details: parsed.error.format() }
      }
      epics.push(parsed.data)
    }
    return { ok: true, data: epics }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error', details: error }
  }
}
```

#### Read path

Direct JSON file reads in main process (no Python dependency for reads):
- Read `epics/*.json`, merge with runtime state from `.git/flow-state/`
- Read `tasks/*.json` + `.md` specs
- **All JSON parsed via Zod `.safeParse()`** — returns `IpcResult` with validation errors on failure
- Invalid files surfaced in UI with error indicator (not silently skipped)

#### Write path

Shell out to `flowctl --json` via `child_process.execFile` in main process:
- Handles all business logic (ID generation, validation, dependency cycles)
- Returns created/updated entity as JSON on stdout
- **Security**: All user input passed as separate argv elements, never via string interpolation:
  ```typescript
  // CORRECT: each arg is a separate array element
  execFile(flowctlPath, ['task', 'create', '--title', title, '--epic', epicId, '--json'])

  // NEVER: string interpolation
  execFile(flowctlPath, [`task create --title=${title}`])
  ```

#### IPC channels

Registered via `IPC_CHANNELS` enum in `shared/types.ts` (matching existing codebase pattern — no hardcoded strings):

```typescript
// shared/types.ts — add to existing IPC_CHANNELS
export const IPC_CHANNELS = {
  // ... existing channels
  FLOW_EPICS_LIST: 'flow:epics-list',
  FLOW_EPIC_GET: 'flow:epic-get',
  FLOW_EPIC_CREATE: 'flow:epic-create',
  FLOW_TASKS_LIST: 'flow:tasks-list',
  FLOW_TASK_GET: 'flow:task-get',
  FLOW_TASK_CREATE: 'flow:task-create',
  FLOW_TASK_UPDATE_STATUS: 'flow:task-update-status',
  FLOW_TASK_SET_DEPS: 'flow:task-set-deps',
  FLOW_CHANGED: 'flow:flow-changed',
} as const
```

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `IPC_CHANNELS.FLOW_EPICS_LIST` | invoke | List all epics |
| `IPC_CHANNELS.FLOW_EPIC_GET` | invoke | Get epic + tasks |
| `IPC_CHANNELS.FLOW_EPIC_CREATE` | invoke | Create epic via flowctl |
| `IPC_CHANNELS.FLOW_TASKS_LIST` | invoke | List tasks (optional epic filter) |
| `IPC_CHANNELS.FLOW_TASK_GET` | invoke | Get task detail + spec |
| `IPC_CHANNELS.FLOW_TASK_CREATE` | invoke | Create task via flowctl |
| `IPC_CHANNELS.FLOW_TASK_UPDATE_STATUS` | invoke | Change task status via flowctl |
| `IPC_CHANNELS.FLOW_TASK_SET_DEPS` | invoke | Set task dependencies |
| `IPC_CHANNELS.FLOW_CHANGED` | send (main→renderer) | File watcher notification |

### File watcher

New `FlowWatcher` class modeled on existing `ConfigWatcher` (`apps/electron/src/main/lib/config-watcher.ts`):

**Workspace scoping**: Constructor takes `workspaceId` and `workspaceRootPath`. SessionManager creates/destroys FlowWatcher when active workspace changes. Watches `.flow/` relative to workspace root: `path.join(workspaceRoot, '.flow')`.

**Debounce pattern**: Exact copy of ConfigWatcher approach — 100ms per-file-path debounce with per-key timers. No TTL-based echo suppression. Instead, rely on Jotai's structural equality to prevent unnecessary re-renders when data hasn't changed:

```typescript
// Follows ConfigWatcher pattern exactly
private debounce(key: string, handler: () => void): void {
  const existing = this.debounceTimers.get(key)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    this.debounceTimers.delete(key)
    handler()
  }, DEBOUNCE_MS) // 100ms, matching ConfigWatcher
  this.debounceTimers.set(key, timer)
}
```

**File change routing**: Parse changed filename to determine type (epic/task/spec/meta), read only the changed file, validate with Zod, push granular IPC event.

**Multi-workspace management**: SessionManager maintains `Map<workspaceId, FlowWatcher>` (one watcher per workspace, not per window). When a new window opens for workspace X: if FlowWatcher already exists for X, reuse it; otherwise create new `FlowWatcher(workspaceId, workspaceRootPath)`. When all windows for a workspace close, destroy its FlowWatcher.

**IPC event payload**: All `IPC_CHANNELS.FLOW_CHANGED` events include `workspaceId` for filtering:

```typescript
// main/flow-watcher.ts
private notifyChange(epicId?: string, taskId?: string) {
  this.windowManager?.sendToAll(IPC_CHANNELS.FLOW_CHANGED, {
    workspaceId: this.workspaceId,
    epicId,
    taskId,
  })
}
```

**Event granularity**: Single `FLOW_CHANGED` event with typed payload:
- `epicId` only → epic metadata changed
- `taskId` only → task changed
- Both → task reassigned to different epic
- Neither → meta file or unknown change (reload all)

Renderer decides which atoms to reload based on payload.

**Renderer-side filtering**: Only process events for active workspace:

```typescript
// renderer/hooks/useFlowWatcher.ts
useEffect(() => {
  const unsubscribe = window.electronAPI.onFlowChanged((event) => {
    if (event.workspaceId !== activeWorkspaceId) return
    // Reload affected epic/task atoms
  })
  return unsubscribe
}, [activeWorkspaceId])
```

**Externally-triggered changes**: Toast via `sonner` when file changes are detected that weren't initiated by the GUI.

### State management

Jotai atoms with `atomFamily` for granular re-renders:

```typescript
// atoms/flow-state.ts
const epicsAtom = atom<Epic[]>([])
const taskAtomFamily = atomFamily((taskId: string) => atom<Task | null>(null))
const selectedEpicAtom = atom<string | null>(null)
const kanbanViewAtom = atom<'kanban' | 'list' | 'graph'>('kanban')

// Per-epic transient UI state (follows SessionUIState atomFamily pattern)
const epicUIStateFamily = atomFamily(
  (_epicId: string) => atom<{ scrollPosition: number; expandedSections: string[] }>({
    scrollPosition: 0,
    expandedSections: [],
  }),
  (a, b) => a === b
)

// Pending task updates for visual feedback during writes
const pendingTaskUpdatesAtom = atom<Map<string, PendingUpdate>>(new Map())
```

**Atom load pattern** (follows session/sources loading patterns):

```typescript
const epicsAtom = atom<Epic[] | null>(null) // null = not loaded yet
const epicsLoadingAtom = atom(false)
const epicsErrorAtom = atom<string | null>(null)
const epicsListAtom = atom((get) => get(epicsAtom) ?? []) // Safe access

const loadEpicsAtom = atom(null, async (get, set, workspaceId: string) => {
  set(epicsLoadingAtom, true)
  set(epicsErrorAtom, null)
  const result = await window.electronAPI.flowEpicsList(workspaceId)
  if (result.ok) {
    set(epicsAtom, result.data)
  } else {
    set(epicsErrorAtom, result.error)
  }
  set(epicsLoadingAtom, false)
})
```

**No optimistic rollback**. Instead, use pending state + error recovery:
1. On drag-drop: add task to `pendingTaskUpdatesAtom` (renders card at 0.7 opacity with spinner)
2. Fire IPC write to flowctl
3. On success: clear pending state, update atom with confirmed data
4. On failure: clear pending state, show error toast with retry action, let user manually fix

This matches `SourcesListPanel` pattern (loading states, not optimistic rollback).

## UI Components

### 1. TasksNavigatorPanel (left panel)
- Epic list with progress bars (`done / total` ratio, tooltip shows breakdown: "3 done, 2 in progress, 1 blocked, 4 todo")
- "New Epic" button at top
- Click epic → filters kanban to that epic
- Badge showing task counts per status
- Reuse: `ScrollArea`, `Collapsible`, existing panel patterns from `SourcesListPanel`

### 2. TasksKanbanView (main content)
- 4 columns: Todo, In Progress, Blocked, Done
- Task cards show: title, epic badge, priority indicator, dep count, assignee (if set), blocked indicator
- Drag-and-drop between columns via `@dnd-kit/sortable` multi-container
- Column headers with task count
- Empty column states with drop target affordance
- Cards in pending state render at 0.7 opacity with spinner overlay
- Reuse: `SortableList`, `Badge`, `Card` patterns
- **No virtualization in v1** — defer until perf testing shows need (kanban boards typically <50 tasks per column)

### 3. TaskDetailPanel (slide-over via vaul drawer)
- Task metadata: status, priority, epic, assignee, created/claimed dates
- Spec markdown rendered via `react-markdown` + `remark-gfm`
- Dependencies section: list of blocking/blocked-by tasks (clickable)
- Action buttons: Start, Complete, Block, Delete
- Reuse: `vaul` drawer for slide-over (keeps kanban/graph visible underneath), settings components for metadata display

### 4. EpicDetailView (main content)
- Epic title + status
- Task table via `@tanstack/react-table` with sortable columns
- Progress summary (todo/in_progress/blocked/done counts)
- Spec viewer for epic-level spec
- "New Task" button

### 5. DependencyGraphView (main content)
- DAG layout via `dagre`, reusing existing utilities from `packages/mermaid/src/dagre-adapter.ts`:
  - `snapToOrthogonal()` for routing edges
  - `centerToTopLeft()` for node positioning
  - `clipEndpointsToNodes()` for edge endpoints
- SVG rendering with task nodes as rounded rectangles
- Color-coded by status
- Click node → open task detail in vaul drawer (preserves graph state, avoids expensive dagre relayout)
- Critical path highlighting
- Pan/zoom via CSS transforms
- Scoped to selected epic

### 6. CreateEpicDialog / CreateTaskDialog
- Modal dialogs via shadcn `Dialog`
- Epic: title field (required)
- Task: title, epic (dropdown), priority (select), dependencies (multi-select autocomplete)

## Keyboard shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `cmd+K` | Task search via command palette | Global (tasks navigator active) |
| `N` | New task | When epic selected |
| `E` | New epic | Tasks navigator |
| `Arrow keys` | Navigate cards | When card focused |
| `Enter` | Open task detail | When card focused |
| `Escape` | Close detail/dialog | Detail panel or dialog open |
| `1-4` | Filter by status column | Kanban view |

## Edge cases

| Case | Handling |
|------|----------|
| No `.flow/` directory | Show onboarding card: "Create your first epic to group related tasks. An epic represents a feature or milestone." with init button |
| Empty epic (0 tasks) | Show empty kanban: "Break this epic into tasks. Each task is a self-contained unit of work with a spec and dependencies." |
| flowctl not found / Python missing | For reads: direct file access (no Python needed). For writes: show error toast with install instructions |
| flowctl write failure | Clear pending state, show error toast with stderr message and retry action |
| Circular dependencies | flowctl prevents these on write. Graph view: show warning badge if detected in existing data |
| Concurrent GUI + CLI writes | FlowWatcher detects external changes via file watch. Jotai structural equality prevents spurious re-renders. **Detection**: track `lastWriteTimestamp` per entity. When FlowWatcher fires and entity is in `pendingTaskUpdatesAtom`, compare mtime — if newer, show banner: "This task was modified externally. Reload to see changes." Use `useBeforeUnload()` hook to warn of unsaved form edits. |
| Long titles | Truncate with ellipsis in cards and navigator, full title in detail view |
| Malformed JSON | Zod `.safeParse()` returns validation error. Show error indicator in navigator with "Recover" action: view raw JSON in dialog, edit and save, or copy backup from `.git/flow-state/` |
| Only epic is corrupt | Show error state with recovery options: view/edit raw JSON, or reinitialize from CLI |

## Task state transitions

Research `flowctl` task status transitions before Phase 2 implementation. If transitions are unrestricted (any→any), allow all drag targets. If DAG-constrained, validate drop targets client-side: gray out invalid columns and show "not allowed" cursor on hover.

## Implementation phases

### Phase 1: Foundation
- Define Zod schemas for Epic/Task/RuntimeState in `shared/flow-schemas.ts`
- Add `TasksNavigationState` to types union, routes, parser
- Add `isTasksNavigation()` type guard
- Add `IPC_CHANNELS.FLOW_*` constants to types
- Add "Tasks" item to LeftSidebar
- Create IPC handlers for read operations (direct JSON file reads with Zod validation)
- Create `FlowWatcher` class (workspace-scoped, ConfigWatcher debounce pattern)
- Create Jotai atoms for flow state
- Wire up `TasksNavigatorPanel` with epic list

### Phase 2: Kanban board
- `TasksKanbanView` with 4 status columns
- Task cards with metadata display (title, epic, priority, deps, assignee, blocked indicator)
- Drag-and-drop status changes with pending state UI (no optimistic rollback)
- IPC write handler (flowctl execFile with safe argv passing)
- Research and implement task state transition validation

### Phase 3: Detail views
- `TaskDetailPanel` as vaul drawer slide-over
- `EpicDetailView` with task table
- Action buttons (start, complete, block)
- Markdown spec rendering

### Phase 4: Creation & deps
- `CreateEpicDialog` and `CreateTaskDialog`
- Dependency management UI (add/remove deps from task detail)
- `DependencyGraphView` with dagre layout (reuse dagre-adapter.ts utilities)

### Phase 5: Polish
- Empty states with educational copy and onboarding
- Error handling, recovery UI for corrupt files, and toasts
- Keyboard shortcuts (see table above)
- Persist selected epic across restarts
- Perf testing — add virtualization only if needed

## Acceptance criteria

- [ ] PM can view all epics and their progress without CLI
- [ ] PM can view tasks in kanban board grouped by status
- [ ] PM can drag tasks between status columns to change status
- [ ] PM can create new epics and tasks via dialogs
- [ ] PM can view task/epic specs rendered as markdown
- [ ] PM can view and manage task dependencies
- [ ] PM can see dependency graph for an epic
- [ ] Changes made via CLI are reflected in GUI within 200ms
- [ ] Changes made via GUI are reflected in `.flow/` files
- [ ] Empty states guide new users to initialize and create their first epic
- [ ] All task statuses (todo, in_progress, blocked, done) represented as kanban columns
- [ ] All JSON reads validated via Zod schemas
- [ ] All flowctl writes use safe argv passing (no string interpolation)
- [ ] FlowWatcher scoped to active workspace
- [ ] Corrupt files show recovery UI (not silent skip)

## Open questions

1. **Task state transitions**: Research flowctl source to determine if transitions are unrestricted or DAG-constrained. Must resolve before Phase 2.
2. **Python runtime**: Is Python 3 guaranteed on all target machines? If not, implement a pure Node.js writer for `.flow/` files instead of shelling out to flowctl.
3. **Spec editing (v2)**: When we add editing, should it be raw markdown or a rich editor (Tiptap)?

## UX Flows

### Flow 1: First-Time Discovery (No `.flow/` directory)

```
User clicks "Tasks" in LeftSidebar
  ↓
NavigatorPanel shows empty TasksNavigatorPanel
  ↓
MainContentPanel shows Empty state:
  ┌──────────────────────────────────┐
  │      [KanbanSquare icon]         │
  │                                  │
  │   No epics yet                   │
  │   Create your first epic to      │
  │   group related tasks.           │
  │                                  │
  │   [Initialize flow-next]         │
  └──────────────────────────────────┘
  ↓
User clicks "Initialize flow-next"
  ↓
IPC → execFile(`flowctl init`) in workspace root
  ↓
FlowWatcher detects `.flow/` creation → FLOW_CHANGED event
  ↓
UI transitions to empty epics state (Flow 2)
```

### Flow 2: Create First Epic

```
TasksNavigatorPanel header:
  ┌──────────────────────────────┐
  │  Tasks            [+] [⚙]   │
  ├──────────────────────────────┤
  │                              │
  │  No epics yet.               │
  │  [+ New Epic]                │
  │                              │
  └──────────────────────────────┘
  ↓
User clicks [+] or "New Epic"
  ↓
CreateEpicDialog (shadcn Dialog, centered modal):
  ┌──────────────────────────────┐
  │  Create Epic                 │
  │                              │
  │  Title ________________________│
  │  |Build auth system         |│
  │  |___________________________|│
  │                              │
  │         [Cancel] [Create]    │
  └──────────────────────────────┘
  ↓
Submit → IPC → execFile(`flowctl epic create --title "Build auth system" --json`)
  ↓
FlowWatcher detects new epic JSON → reloads epicsAtom
  ↓
Navigator updates with epic + empty kanban in main content
```

### Flow 3: Navigate Epics & View Kanban

```
Navigator (multiple epics):
  ┌──────────────────────────────┐
  │  Tasks              [+] [⚙] │
  ├──────────────────────────────┤
  │  ▾ fn-1 Build auth system    │  ← selected (variant="default")
  │    ██████░░░░  3/5           │
  │  ▸ fn-2 Payment integration  │  ← ghost
  │    ████░░░░░░  2/6           │
  │  ▸ fn-3 Email templates      │
  │    ██████████  4/4  ✓        │  ← done badge
  └──────────────────────────────┘
  ↓
Click epic → navigate(routes.view.tasks({ epicId: 'fn-1' }))
  ↓
MainContentPanel renders TasksKanbanView:
  ┌─────────┬─────────┬─────────┬─────────┐
  │ Todo (2)│ In Prog │ Blocked │ Done (3)│
  │         │  (1)    │  (0)    │         │
  ├─────────┼─────────┼─────────┼─────────┤
  │┌───────┐│┌───────┐│         │┌───────┐│
  ││JWT gen││││Refresh││         ││Login  ││
  ││fn-1.4 ││││tokens ││         ││page   ││
  │└───────┘│││fn-1.3 ││         ││fn-1.1 ││
  │┌───────┐│└───────┘│         │└───────┘│
  ││OAuth  ││         │         │┌───────┐│
  ││setup  ││         │         ││Signup ││
  ││fn-1.5 ││         │         ││fn-1.2 ││
  │└───────┘│         │         │└───────┘│
  └─────────┴─────────┴─────────┴─────────┘
```

### Flow 4: Drag-Drop Status Change

```
User grabs card "JWT gen" from Todo column
  ↓
@dnd-kit activates (5px threshold)
  ↓
DragOverlay shows floating card clone
  ↓
User drags over "In Progress" column → column header highlights
  ↓
User drops card
  ↓
Card renders at 0.7 opacity + spinner (pending state)
  ↓
IPC → execFile(`flowctl task update fn-1.4 --status in_progress --json`)
  ├─ Success: Clear pending, card at full opacity in new column
  └─ Failure: Card snaps back, error toast with [Retry]
```

### Flow 5: Open Task Detail (Slide-over Drawer)

```
User clicks card "Refresh tokens" (fn-1.3) in kanban
  ↓
Vaul drawer slides in from right (kanban visible underneath):
  ┌──────────────────────────────────────┐
  │  ← Back           fn-1.3    [⋮]     │
  ├──────────────────────────────────────┤
  │  Refresh tokens                      │
  │  Status: [In Progress ▾]            │
  │  Epic: fn-1 Build auth system        │
  │  Assignee: —                         │
  │  Priority: —                         │
  │                                      │
  │  ── Dependencies ──────────────────  │
  │  Blocked by: fn-1.1 Login page ✓     │
  │  Blocks: fn-1.5 OAuth setup          │
  │  [+ Add dependency]                  │
  │                                      │
  │  ── Spec ──────────────────────────  │
  │  (rendered markdown via react-       │
  │   markdown + remark-gfm)            │
  │                                      │
  │  ── Actions ───────────────────────  │
  │  [Complete]  [Block]  [Delete]       │
  └──────────────────────────────────────┘
  ↓
User clicks [Complete] → IPC → flowctl done fn-1.3
  ↓
Card moves to "Done" column behind drawer
Toast: "fn-1.3 marked as done"
```

### Flow 6: Create Task from Kanban

```
User clicks [+ New Task] in kanban header
  ↓
CreateTaskDialog (shadcn Dialog):
  ┌──────────────────────────────────────┐
  │  Create Task                         │
  │                                      │
  │  Title  [________________________]   │
  │  Epic   [fn-1 Build auth system  ▾]  │
  │  Priority  [— ▾]                     │
  │  Dependencies  [multi-select ▾]      │
  │                                      │
  │            [Cancel] [Create]         │
  └──────────────────────────────────────┘
  ↓
Submit → IPC → execFile(`flowctl task create --title "..." --epic fn-1 --json`)
  ↓
FlowWatcher → new card appears in "Todo" column
```

### Flow 7: Dependency Graph View

```
View switcher in kanban header: [Kanban] [List] [Graph]
  ↓
User clicks [Graph]
  ↓
DependencyGraphView renders DAG (dagre layout):
  ┌──────────────────────────────────────────────┐
  │  ┌──────────┐                                │
  │  │ fn-1.1   │──────┐                         │
  │  │ Login    │      ▼                         │
  │  │ ✓ done   │   ┌──────────┐  ┌──────────┐  │
  │  └──────────┘   │ fn-1.3   │──▸│ fn-1.5   │  │
  │                 │ Refresh  │  │ OAuth    │  │
  │  ┌──────────┐  │ ● in_prog│  │ ○ todo   │  │
  │  │ fn-1.2   │  └──────────┘  └──────────┘  │
  │  │ Signup   │                               │
  │  │ ✓ done   │   ┌──────────┐                │
  │  └──────────┘   │ fn-1.4   │                │
  │                 │ JWT gen  │                │
  │                 │ ○ todo   │                │
  │                 └──────────┘                │
  │  [Pan: click+drag]  [Zoom: scroll]          │
  └──────────────────────────────────────────────┘
  ↓
Click node → TaskDetailPanel drawer (Flow 5)
Graph stays rendered underneath (no dagre relayout)
```

### Flow 8: External CLI Change Detection

```
PM has kanban open. Dev runs in terminal:
  $ flowctl start fn-1.4
  ↓
FlowWatcher detects task JSON change → 100ms debounce
  ↓
IPC FLOW_CHANGED { epicId: 'fn-1', taskId: 'fn-1.4' }
  ↓
Renderer reloads taskAtomFamily('fn-1.4')
  ↓
Jotai structural equality → data changed → card moves to "In Progress"
  ↓
Toast (sonner): "fn-1.4 was updated externally"
```

### Flow 9: Epic Detail View

```
User clicks epic name in navigator (not expand chevron)
  ↓
EpicDetailView in MainContentPanel:
  ┌──────────────────────────────────────────────┐
  │  fn-1 Build auth system          [Edit] [⋮]  │
  │  Status: open                                │
  │  Progress: ██████░░░░ 3/5 (60%)             │
  │  Todo: 2  In Progress: 1  Blocked: 0  Done: 3│
  │                                              │
  │  ── Tasks (@tanstack/react-table) ─────────  │
  │  ┌────────┬──────────────────┬────────┬─────┐│
  │  │ ID     │ Title            │ Status │ Deps││
  │  ├────────┼──────────────────┼────────┼─────┤│
  │  │ fn-1.1 │ Login page       │ ✓ done │  0  ││
  │  │ fn-1.2 │ Signup           │ ✓ done │  0  ││
  │  │ fn-1.3 │ Refresh tokens   │ ● prog │  1  ││
  │  │ fn-1.4 │ JWT gen          │ ○ todo │  0  ││
  │  │ fn-1.5 │ OAuth setup      │ ○ todo │  1  ││
  │  └────────┴──────────────────┴────────┴─────┘│
  │                                              │
  │  [+ New Task]  [View Kanban]  [View Graph]   │
  │                                              │
  │  ── Spec (rendered markdown) ──────────────  │
  └──────────────────────────────────────────────┘
  ↓
Click task row → TaskDetailPanel drawer (Flow 5)
Click [View Kanban] → switches to kanban (Flow 3)
```

### Flow 10: Keyboard Navigation

```
Tasks navigator focused:
  E         → CreateEpicDialog
  ↑/↓       → Navigate epic list
  Enter     → Select epic, show kanban

Kanban view focused:
  N         → CreateTaskDialog (pre-filled epic)
  ↑/↓/←/→  → Navigate cards across columns
  Enter     → Open TaskDetailPanel drawer
  1/2/3/4   → Filter to single column
  Escape    → Clear filter or close drawer

Task detail drawer:
  Escape    → Close drawer
  Cmd+K     → Command palette search (global)
```

### Navigation State Machine

```
LeftSidebar "Tasks" click
  ↓
TasksNavigatorPanel (epic list)
  ├─ Click epic expand chevron → show task count breakdown
  ├─ Click epic name → EpicDetailView (table + spec)
  │   ├─ Click task row → TaskDetailPanel (drawer)
  │   ├─ [View Kanban] → TasksKanbanView
  │   └─ [View Graph] → DependencyGraphView
  └─ Click epic → TasksKanbanView (default)
      ├─ Click card → TaskDetailPanel (drawer)
      ├─ Drag card → status change (pending → confirm/revert)
      ├─ Toggle [Graph] → DependencyGraphView
      │   └─ Click node → TaskDetailPanel (drawer)
      └─ [+ New Task] → CreateTaskDialog
```

### Flow 11: Corrupt File Recovery

```
FlowWatcher detects change to `.flow/epics/fn-2.json`
  ↓
Main process reads file → Zod .safeParse() fails
  ↓
IPC sends FLOW_CHANGED with error payload:
  { epicId: 'fn-2', error: 'Zod validation failed', raw: '<file contents>' }
  ↓
Navigator shows error state on epic:
  ┌──────────────────────────────┐
  │  Tasks              [+] [⚙] │
  ├──────────────────────────────┤
  │  ▾ fn-1 Build auth system    │  ← normal
  │    ██████░░░░  3/5           │
  │  ⚠ fn-2 Payments             │  ← red warning icon, red text
  │    Parse error               │
  └──────────────────────────────┘
  ↓
User clicks fn-2 in navigator
  ↓
MainContentPanel shows recovery view (centered):
  ┌──────────────────────────────────────────────┐
  │          ⚠ Corrupt Epic File Detected        │
  │                                              │
  │  fn-2.spec.md failed to parse.               │
  │  The file may have been edited outside the   │
  │  app or corrupted during a sync.             │
  │                                              │
  │  Validation error:                           │
  │  ┌────────────────────────────────────────┐  │
  │  │ Expected string for field "title",     │  │
  │  │ received undefined at path .title      │  │
  │  └────────────────────────────────────────┘  │
  │                                              │
  │  [View Raw JSON]  [Edit & Fix]  [Revert]     │
  │                                              │
  │  "Revert" restores the last valid version    │
  │  from .git/flow-state/ backup.               │
  └──────────────────────────────────────────────┘
  ↓
Option A: [View Raw JSON]
  → Modal dialog shows raw file contents (read-only, monospace)
  → User copies to clipboard or diagnoses issue

Option B: [Edit & Fix]
  → Modal dialog with editable JSON textarea + live Zod validation
  → Submit → write corrected JSON → FlowWatcher reloads
  → If validation still fails, show inline errors, don't close dialog

Option C: [Revert from Git]
  → IPC → main process runs:
    git show HEAD:.flow/epics/fn-2.json > .flow/epics/fn-2.json
  → FlowWatcher detects restored file → reloads
  → Toast: "fn-2 restored from git backup"
  → If no git backup exists, button disabled with tooltip:
    "No git history found for this file"
```

### Flow 12: Cross-Epic Dependencies

```
User has multiple epics with inter-epic task dependencies:
  fn-1.3 (Auth: Token Refresh) blocks fn-2.1 (Payments: Checkout Flow)
  fn-1.3 also soft-depends on fn-3.2 (Notifications: Email Templates)
  ↓
User navigates to Tasks → clicks "Dependencies" view toggle
(new view option alongside Kanban / List / Graph):
  [Kanban] [List] [Graph] [Cross-Epic]
  ↓
CrossEpicDependencyView renders:
  ┌──────────────────────────────────────────────────────┐
  │  Cross-Epic Dependencies              [3 cross-links]│
  ├──────────────────────────────────────────────────────┤
  │                                                      │
  │  ┌─────────────────┐     ━━━▶     ┌─────────────────┐│
  │  │ fn-1 Auth System │              │ fn-2 Payments   ││
  │  │─────────────────│              │─────────────────││
  │  │ fn-1.3 Token    │──[blocks]──▸│ fn-2.1 Checkout ││
  │  │ Refresh         │              │ Flow            ││
  │  └─────────────────┘              └─────────────────┘│
  │         │                                            │
  │         │ ┈┈[soft dep]┈┈▸                            │
  │         ▼                                            │
  │  ┌─────────────────┐                                 │
  │  │ fn-3 Notifs      │                                 │
  │  │─────────────────│                                 │
  │  │ fn-3.2 Email    │                                 │
  │  │ Templates       │                                 │
  │  └─────────────────┘                                 │
  │                                                      │
  │  Legend:                                              │
  │  ━━ Hard dependency (blocks)                         │
  │  ┈┈ Soft dependency (depends_on_epics)               │
  │                                                      │
  │  Filter: [All epics ▾]  [Show: Hard+Soft ▾]         │
  └──────────────────────────────────────────────────────┘

Layout: dagre with epic-level grouping
  - Each epic is a bordered group box containing its relevant tasks
  - Edges connect task-to-task (hard deps) or epic-to-epic (soft deps)
  - Color coding: hard deps = accent purple, soft deps = destructive red dashed
  - Click any task node → TaskDetailPanel drawer
  - Click any epic group → EpicDetailView

Edge cases:
  - 0 cross-epic deps → show empty state:
    "No cross-epic dependencies found.
     All task dependencies are within their own epics."
  - Circular cross-epic deps → highlight cycle in red,
    show warning banner: "Circular dependency detected between fn-1 and fn-2"
```

### Flow 13: flowctl Not Found

```
User clicks "Tasks" in sidebar for the first time
  ↓
Main process attempts to locate flowctl binary:
  1. Check PATH via `which flowctl`
  2. Check configured custom path from settings
  3. Check bundled location
  ↓
All checks fail → IPC returns:
  { ok: false, error: 'flowctl_not_found' }
  ↓
MainContentPanel shows setup state (centered):
  ┌──────────────────────────────────────────────┐
  │            [Terminal icon]                    │
  │                                              │
  │         flowctl Not Found                    │
  │                                              │
  │  The flowctl CLI binary could not be         │
  │  located. Tasks GUI requires flowctl to      │
  │  read and manage .flow/ data.                │
  │                                              │
  │  Install via npm:                            │
  │  ┌────────────────────────────────────────┐  │
  │  │ $ npm install -g @anthropic/flowctl    │  │
  │  │                              [Copy]    │  │
  │  └────────────────────────────────────────┘  │
  │                                              │
  │  Or specify a custom binary path:            │
  │  ┌────────────────────────────────────────┐  │
  │  │ /usr/local/bin/flowctl           [📁]  │  │
  │  └────────────────────────────────────────┘  │
  │                                              │
  │     [Install Now]    [Set Custom Path]       │
  │                                              │
  │  ℹ Read-only file access works without       │
  │    flowctl. Install is only needed for       │
  │    creating/updating tasks and epics.        │
  └──────────────────────────────────────────────┘
  ↓
Option A: [Install Now]
  → IPC → main process runs: npm install -g @anthropic/flowctl
  → Progress spinner on button
  → Success → Toast: "flowctl installed successfully"
  → Re-check PATH → transition to normal Tasks view
  → Failure → inline error: "Installation failed: <stderr>"

Option B: [Set Custom Path]
  → Native file picker dialog (electron dialog.showOpenDialog)
  → Validate selected binary: execFile(path, ['--version'])
  → Success → save path to settings, transition to Tasks view
  → Failure → inline error: "Selected binary is not a valid flowctl"

Degraded mode (no flowctl, .flow/ exists):
  → Navigator and kanban load read-only (direct JSON reads work)
  → All write actions (drag-drop, create, status change) show:
    "flowctl required. Install flowctl to modify tasks."
  → Banner at top of Tasks view:
    "Read-only mode — flowctl not found. [Install]"
```

### Flow 14: Task Claiming (Multi-Agent)

```
Context: Multiple agents/users can claim tasks.
Task ownership is tracked via `assignee` field in task JSON.
  ↓
Kanban board shows ownership state on cards:
  ┌─────────────────────────────────────────────────┐
  │  Todo (2)        │  In Progress (2)             │
  ├──────────────────┼──────────────────────────────┤
  │ ┌──────────────┐ │ ┌──────────────────────────┐ │
  │ │ fn-1.2 OAuth │ │ │ fn-1.3 Token Refresh     │ │
  │ │              │ │ │ ┌──┐                      │ │
  │ │ unclaimed    │ │ │ │🟣│ agent-1 (you)        │ │
  │ └──────────────┘ │ │ └──┘                      │ │
  │ ┌──────────────┐ │ └──────────────────────────┘ │
  │ │ fn-1.4 JWT   │ │ ┌──────────────────────────┐ │
  │ │              │ │ │ fn-1.5 OAuth setup        │ │
  │ │ unclaimed    │ │ │ ┌──┐                      │ │
  │ └──────────────┘ │ │ │🔵│ agent-2              │ │
  │                  │ │ └──┘                      │ │
  │                  │ └──────────────────────────┘ │
  └──────────────────┴──────────────────────────────┘

Claim flow (drag to claim):
  ↓
User drags unclaimed card from Todo → In Progress
  ↓
Tooltip appears on drag:
  ┌────────────────────────────────────────┐
  │  Claim this task?                      │
  │  Drag to In Progress to claim          │
  │  and start working on fn-1.2           │
  └────────────────────────────────────────┘
  ↓
Drop in In Progress column
  ↓
IPC → execFile(`flowctl start fn-1.2 --json`)
  → flowctl sets status=in_progress + assignee=current-agent
  ↓
Card updates: shows current user avatar + name, accent border

Conflict handling:
  → User drags card that was claimed by another agent (stale state)
  → flowctl returns error: "Task fn-1.2 is already claimed by agent-2"
  → Card snaps back to original position
  → Error toast: "fn-1.2 is already claimed by agent-2. Reload to see latest."
  → [Reload] button refreshes task state

Unclaim flow:
  → User drags own card from In Progress → Todo
  → Confirmation dialog: "Release fn-1.3? This will unclaim the task."
  → Confirm → IPC → flowctl unclaim fn-1.3
  → Card moves back to Todo, assignee cleared

Visual indicators:
  - Unclaimed cards: plain border, "unclaimed" label in muted text
  - Self-claimed: accent border (purple), avatar + "(you)" label
  - Other-claimed: default border, other agent avatar + name
  - Claimed cards have subtle background tint matching agent color
```

### Flow 15: Epic Completion

```
Last task in epic fn-1 is moved to Done (via drag or action button)
  ↓
flowctl detects all tasks done → sets epic status = done
  ↓
FlowWatcher detects epic JSON change
  ↓
UI transitions to completion celebration:

Navigator update:
  ┌──────────────────────────────┐
  │  ✓ fn-1 Build auth system    │  ← green check, strikethrough
  │    ██████████  5/5  ✓        │
  └──────────────────────────────┘

MainContentPanel shows completion state:
  ┌──────────────────────────────────────────────┐
  │                                              │
  │             🎉 Epic Complete!                │
  │                                              │
  │        fn-1 Build auth system                │
  │          all 5 tasks done                    │
  │                                              │
  │    ┌─────────┬─────────┬─────────┐           │
  │    │    5    │   3d    │   12    │           │
  │    │ Tasks   │Duration │ Commits │           │
  │    │ Done    │         │         │           │
  │    └─────────┴─────────┴─────────┘           │
  │                                              │
  │    [Archive Epic]     [View Summary]         │
  │                                              │
  │    Completed tasks:                          │
  │    ✓ fn-1.1 Login page                      │
  │    ✓ fn-1.2 Signup flow                     │
  │    ✓ fn-1.3 Token refresh                   │
  │    ✓ fn-1.4 JWT generation                  │
  │    ✓ fn-1.5 OAuth provider setup            │
  │                                              │
  └──────────────────────────────────────────────┘

Stats calculation:
  - Tasks Done: count of tasks with status=done
  - Duration: difference between epic creation date and last task completion
  - Commits: count of git commits between epic branch creation and completion
    (via `git log --oneline <branch>` if branch_name is set)

[Archive Epic]:
  → Confirmation dialog: "Archive fn-1? Archived epics are hidden from
    the navigator but preserved in .flow/epics/"
  → IPC → flowctl epic archive fn-1
  → Epic removed from navigator, toast: "fn-1 archived"
  → Undo available for 10s via toast action button

[View Summary]:
  → Transitions to EpicDetailView (Flow 9) in read-only mode
  → All tasks shown with completion timestamps
  → Spec still viewable

Auto-detection edge cases:
  - Epic has 0 tasks → cannot auto-complete, show:
    "Add tasks to this epic before it can be completed."
  - Some tasks are blocked → show:
    "2 tasks are still blocked. Resolve dependencies before completing."
  - Epic manually marked done via CLI while tasks remain →
    Show warning banner: "Epic marked done but 2 tasks are incomplete."
    [Reopen Epic] button to set status back to open
```

### Flow 16: Blocked Drag Rejection

```
User attempts to drag a blocked task to another column
  ↓
@dnd-kit drag starts (5px threshold)
  ↓
Client-side validation checks:
  - Task has unresolved dependencies (depends_on tasks not in 'done' status)
  ↓
DragOverlay shows card with red border + lock icon:
  ┌────────────────────────────┐
  │ 🔒 fn-1.5 OAuth setup     │
  │ Blocked by: fn-1.3        │
  │                            │
  │ Cannot move — resolve      │
  │ dependencies first         │
  └────────────────────────────┘
  ↓
All drop targets show "not-allowed" cursor
Column headers do NOT highlight (no valid drop zone)
  ↓
User releases → card snaps back to Blocked column
No IPC call made (client-side prevention)
  ↓
Toast: "fn-1.5 is blocked by fn-1.3 (in progress).
        Complete fn-1.3 first, or remove the dependency."
        [View Dependencies →]

[View Dependencies] → opens TaskDetailPanel for fn-1.5,
  scrolled to Dependencies section
```

### Flow 17: Ready Tasks Indicator (Sidebar Badge)

```
Navigator sidebar shows badge for actionable tasks:
  ┌──────────────────────────────┐
  │  Tasks              [3] [+]  │  ← [3] = ready tasks badge
  ├──────────────────────────────┤
  │  ▾ fn-1 Build auth system    │
  │    ██████░░░░  3/5      [2]  │  ← 2 tasks ready in this epic
  │  ▸ fn-2 Payment integration  │
  │    ████░░░░░░  2/6      [1]  │  ← 1 task ready
  └──────────────────────────────┘

"Ready" = status is 'todo' AND all depends_on tasks are 'done'
  (unblocked tasks that can be started immediately)

Badge behavior:
  - Badge shows count of ready tasks (todo + all deps satisfied)
  - Badge color: accent purple
  - Global badge (next to "Tasks" header) = sum of all epic ready counts
  - Per-epic badge = ready count within that epic
  - 0 ready → no badge shown
  - Badge updates in real-time via FlowWatcher

Tooltip on hover over badge:
  "2 tasks are ready to start:
   • fn-1.4 JWT generation
   • fn-1.5 OAuth provider setup"

Click badge → filters kanban to show only ready tasks
  (new filter state in TasksNavigationState: filter.readyOnly: true)
```

### Flow 18: Task Spec Full-Width View

```
User opens TaskDetailPanel (Flow 5) for a task with a long spec
  ↓
Spec section shows truncated preview (max 20 lines)
  ↓
User clicks [Expand] or "View full spec" link
  ↓
TaskSpecFullView replaces kanban in MainContentPanel:
  ┌──────────────────────────────────────────────────────┐
  │  ← Back to Kanban    fn-1.3 Refresh Tokens    [⋮]   │
  ├──────────────────────────────────────────────────────┤
  │                                                      │
  │  ## Overview                                         │
  │                                                      │
  │  Implement automatic token refresh for OAuth2        │
  │  sessions. When an access token expires, the         │
  │  system should transparently request a new token     │
  │  using the stored refresh token.                     │
  │                                                      │
  │  ## Requirements                                     │
  │                                                      │
  │  - [x] Detect token expiry from 401 responses       │
  │  - [x] Store refresh token securely in keychain     │
  │  - [ ] Implement token refresh interceptor          │
  │  - [ ] Handle refresh token rotation                │
  │  - [ ] Add retry logic for failed refreshes         │
  │                                                      │
  │  ## Implementation Notes                             │
  │                                                      │
  │  Use axios interceptor pattern. On 401:             │
  │  1. Check if refresh token exists                   │
  │  2. POST /oauth/token with grant_type=refresh_token │
  │  3. Update stored tokens                            │
  │  4. Retry original request with new access token    │
  │  5. If refresh fails, redirect to login             │
  │                                                      │
  │  ## Acceptance Criteria                              │
  │  ...                                                 │
  └──────────────────────────────────────────────────────┘

Features:
  - Full-width markdown rendering (react-markdown + remark-gfm)
  - Checklist items rendered as interactive checkboxes (read-only in v1)
  - Code blocks with syntax highlighting (rehype-highlight)
  - Sticky header with task ID, title, back navigation
  - Scroll position preserved when returning to kanban
  - Cmd+F browser find works within spec content

Back navigation:
  - [← Back to Kanban] → restores previous kanban state
  - Browser back button → same behavior
  - Escape key → same behavior
```

### Flow 19: External CLI Sync Toast

```
PM has Tasks GUI open with kanban showing fn-1 tasks
  ↓
Developer runs CLI commands in terminal:
  $ flowctl start fn-1.4        # claims and starts task
  $ flowctl done fn-1.4 ...     # completes task with summary
  ↓
FlowWatcher detects two rapid changes (within debounce window)
  ↓
100ms debounce → single FLOW_CHANGED event:
  { epicId: 'fn-1', taskId: 'fn-1.4' }
  ↓
Renderer reloads task → card moves Todo → Done (skips In Progress
  because both changes collapsed into one update)
  ↓
Toast notification (sonner, bottom-right):
  ┌────────────────────────────────────────┐
  │  ↻ External change detected            │
  │                                        │
  │  fn-1.4 "JWT generation" was updated   │
  │  via CLI. Status: done                 │
  │                                        │
  │  [Dismiss]              [View Task →]  │
  └────────────────────────────────────────┘

Toast behavior:
  - Auto-dismiss after 5s
  - Multiple rapid changes → batch into single toast:
    "3 tasks updated externally. [View Changes]"
  - [View Task →] opens TaskDetailPanel
  - [View Changes] opens a transient diff view showing what changed

Conflict scenario:
  PM is editing task detail (e.g., has unsaved form state)
  + external CLI change arrives for same task
  ↓
  Banner appears in TaskDetailPanel:
  ┌────────────────────────────────────────────────────┐
  │  ⚠ This task was modified externally.              │
  │  [Reload] to see latest changes.                   │
  │  Warning: unsaved changes will be lost.            │
  └────────────────────────────────────────────────────┘
```

### Wireframes

Visual wireframes for all flows are maintained in `pencil-new.pen` using the Pencil MCP design tool, following the existing app's OKLCH design system with hex equivalents:
- Background: `#FAF9FB` / Foreground: `#26242A`
- Accent (purple): `#7B4EAD` / Success (green): `#2A8040` / Destructive (red): `#C84032`
- Font: Inter (UI), JetBrains Mono (code)
- Border radius: 0rem (sharp corners, matching existing app)

## References

- Navigation system: `apps/electron/src/shared/types.ts:1128-1192`
- Route registry: `apps/electron/src/shared/routes.ts:1-167`
- IPC preload: `apps/electron/src/preload/index.ts`
- IPC handlers: `apps/electron/src/main/ipc.ts`
- ConfigWatcher (file watch pattern): `apps/electron/src/main/lib/config-watcher.ts`
- SortableList (DnD pattern): `apps/electron/src/renderer/components/ui/sortable-list.tsx`
- Data table: `apps/electron/src/renderer/components/ui/data-table.tsx`
- UI state atoms: `apps/electron/src/renderer/atoms/ui-state.ts`
- LeftSidebar: `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx:55-80`
- MainContentPanel: `apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx:1-60`
- Dagre adapter: `packages/mermaid/src/dagre-adapter.ts`
- Markdown rendering: `packages/ui/src/components/markdown/`
- Settings components: `apps/electron/src/renderer/components/settings/`
- WindowManager (multi-window broadcast): `apps/electron/src/main/window-manager.ts`
