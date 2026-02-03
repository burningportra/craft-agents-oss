# Interactive Guided Tasks GUI

## Overview

Add a "Tasks" navigator (5th nav item) to the Craft Agents Electron app that provides a full guided workflow for flow-next task management. Unlike a passive viewer, this GUI actively guides users through the flow-next lifecycle: idea → interview → plan → work → review → ship.

The GUI serves three personas: solo developers (fast task tracking), PMs/team leads (visual overview), and AI agents (status feedback).

## Scope

### In scope
- Tasks nav item in LeftSidebar (Lucide `KanbanSquare` icon)
- `TasksNavigationState` type + route integration
- `.flow/` file watcher (FlowWatcher, follows ConfigWatcher pattern)
- IPC layer for flowctl operations (`flow:*` channels, `FLOW_*` constants)
- Zod schemas for flow-next data validation
- Tab-based multi-epic navigation with adaptive views (list/kanban/graph)
- '+' button wizard with Quick/Standard/Complex templates
- Kanban board with @dnd-kit drag-drop (pure status change, no intra-column reordering)
- Slide-over task detail panel (tabbed: Spec | Deps | Activity)
- Read-only dependency graph (@xyflow/react + @dagrejs/dagre)
- Split-view epic chat (persistent IndexedDB history, inherits main chat codebase access)
- Collapsible AI suggestion sidebar (client-side rule-based nudges)
- Interactive onboarding tutorial (real data)
- OS notifications (extend existing notification system)
- Agent status badges on task cards
- Guided error recovery (typed FlowBridgeError variants)
- Auto-prompt for epic review when all tasks complete

### Out of scope (v1)
- Inline spec editing (use CLI or text editor)
- Bulk operations (multi-select, batch status)
- WIP limits on kanban columns
- Interactive dependency edge creation
- Offline mode
- Analytics/velocity tracking

## Architecture

### NavigationState Integration

Follow exact pattern of `ChatsNavigationState` at `shared/types.ts:L1128-1212`:

```typescript
interface TasksNavigationState {
  navigator: 'tasks'
  filter?: { epicId?: string }
  details: { type: 'epic'; epicId: string } | { type: 'task'; epicId: string; taskId: string } | { type: 'graph'; epicId: string } | null
  rightSidebar?: RightSidebarPanel
}
```

Type guard: `isTasksNavigation(state): state is TasksNavigationState`

### IPC Channel Naming

Follow existing `SCREAMING_SNAKE_CASE` convention in `IPC_CHANNELS`:
- `FLOW_EPICS_LIST: 'flow:epics-list'`
- `FLOW_TASKS_LIST: 'flow:tasks-list'`
- `FLOW_TASK_UPDATE_STATUS: 'flow:task-update-status'`
- `FLOW_EPIC_CREATE: 'flow:epic-create'`
- `FLOW_TASK_CREATE: 'flow:task-create'`
- `FLOW_EPIC_SHOW: 'flow:epic-show'`
- `FLOW_TASK_SHOW: 'flow:task-show'`
- `FLOW_INIT: 'flow:init'`
- `FLOW_CHANGED: 'flow:changed'` (event, not request/response)

### FlowBridge Error Types

```typescript
type FlowBridgeError =
  | { type: 'flowctl_not_found' }
  | { type: 'invalid_output'; zodError: ZodError }
  | { type: 'command_failed'; stderr: string; exitCode: number }
  | { type: 'timeout'; command: string }
```

### flowctl Binary Resolution

Per-workspace resolution: check `<workspace-root>/.flow/bin/flowctl` first, then global PATH. Each workspace may have its own flowctl version. FlowBridge accepts workspace root path in constructor.

### FlowWatcher Lifecycle

WindowManager owns FlowWatcher instances via `Map<workspaceId, FlowWatcher>`. Created when first window opens a workspace, destroyed when last window for that workspace closes. One FlowWatcher per workspace, shared across windows.

### Chat History IndexedDB Schema

```typescript
// Store: 'epic-chats', key: epicId
interface EpicChatRecord {
  epicId: string
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: number }>
  updatedAt: number
}
// Index: 'by-updated' on updatedAt (for LRU cleanup)
```

Epic chat inherits full codebase access from the main chat infrastructure — no special source selection needed. Chat panel reuses existing AI interaction layer.

### Key patterns to follow
- **NavigationState union**: `shared/types.ts:L1128-1212` — add `TasksNavigationState` variant
- **Route builders**: `shared/routes.ts` — add task routes
- **Route parser**: `shared/route-parser.ts` — add tasks branch
- **App shell nav**: `AppShell.tsx:~L2082-2095` — add Tasks LinkItem
- **IPC 3-file pattern**: define in `shared/types.ts` IPC_CHANNELS, handle in `main/ipc.ts`, expose in `preload/index.ts`
- **File watcher**: Follow `ConfigWatcher` at `main/lib/config-watcher.ts` with `fs.watch()` recursive + per-file-path debounce map
- **Wizard**: Follow `OnboardingWizard.tsx` discriminated-union step pattern
- **State**: Jotai atoms + `atomFamily` with string key equality, `atomWithStorage` for persistence
- **Notifications**: Extend `main/notifications.ts` `showNotification()`
- **Spring transitions**: Reuse `springTransition` from `AppShell.tsx:L363`

### Existing assets to reuse
- `@dnd-kit/core` + `@dnd-kit/sortable` (already installed)
- `react-resizable-panels` (already installed, wrapper at `components/ui/resizable.tsx`)
- `react-markdown` + `remark-gfm` + `rehype-raw` (already installed)
- `motion` (already installed, used throughout app)
- Radix UI: Tabs, Dialog, Collapsible, Tooltip (already installed)
- dagre adapter: `packages/mermaid/src/dagre-adapter.ts`
- Notification hooks: `renderer/hooks/useNotifications.ts`
- UI primitives: `components/ui/` (tabs, dialog, badge, collapsible, scroll-area, sonner, command)

### New dependencies
- `@dagrejs/dagre` — dependency graph layout
- `@xyflow/react` — graph rendering
- `idb` — IndexedDB wrapper for chat persistence

## Quick commands

```bash
# Dev server
bun dev

# Type check
bun typecheck

# Lint
bun lint
```

## Acceptance

- [ ] Tasks nav item visible in LeftSidebar, navigates to Tasks view
- [ ] TasksNavigationState integrated into NavigationState union (matching ChatsNavigationState pattern)
- [ ] FlowWatcher detects .flow/ changes and updates UI in <200ms (per-file-path debounce)
- [ ] IPC channels for all flowctl CRUD operations (FLOW_* constants)
- [ ] '+' button opens wizard with Quick/Standard/Complex selection
- [ ] Kanban board with drag-drop status changes (no intra-column reordering)
- [ ] Tab-based multi-epic with adaptive view selection (persisted per-epic)
- [ ] Slide-over task detail with Spec/Deps/Activity tabs
- [ ] Read-only dependency graph with click-to-navigate (viewport state preserved)
- [ ] Split-view chat per epic with persistent IndexedDB history
- [ ] Collapsible AI sidebar with rule-based contextual suggestions
- [ ] Interactive onboarding for first-time users
- [ ] OS notifications for task completions and reviews
- [ ] Guided error recovery for flowctl failures (typed FlowBridgeError)
- [ ] Agent status badges on active task cards
- [ ] Auto-prompt for epic review when all tasks in epic are done

## References

- Existing plan: `plans/flow-next-tasks-gui.md` (architectural patterns, component specs)
- Wireframes: `pencil-new.pen` (19 screens)
- Navigation types: `apps/electron/src/shared/types.ts:L1128-1212`
- App shell: `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- Config watcher: `apps/electron/src/main/lib/config-watcher.ts`
- Onboarding wizard: `apps/electron/src/renderer/components/onboarding/OnboardingWizard.tsx`
- IPC handlers: `apps/electron/src/main/ipc.ts`
- Notification system: `apps/electron/src/main/notifications.ts`
- Spring transition: `AppShell.tsx:L363`
