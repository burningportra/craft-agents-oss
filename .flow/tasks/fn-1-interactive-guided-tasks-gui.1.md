# fn-1-interactive-guided-tasks-gui.1 Navigation foundation: TasksNavigationState, routes, sidebar item

## Description
Add `TasksNavigationState` to the app's navigation system, enabling the Tasks view as a first-class navigator alongside Chats, Sources, Settings, and Skills.

**Size:** M
**Files:**
- `apps/electron/src/shared/types.ts` — add TasksNavigationState to NavigationState union, type guard, IPC channel stubs
- `apps/electron/src/shared/routes.ts` — add routes.view.tasks(), routes.view.taskDetail(), routes.view.epicDetail(), routes.view.taskGraph()
- `apps/electron/src/shared/route-parser.ts` — add tasks branch to parseRouteToNavigationState()
- `apps/electron/src/renderer/components/app-shell/AppShell.tsx` — add Tasks LinkItem (~L2082-2095, after Skills)
- `apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx` — add isTasksNavigation() branch (render placeholder)

## Approach

- Follow exact `ChatsNavigationState` pattern at `shared/types.ts:L1128-1212`:
  ```typescript
  interface TasksNavigationState {
    navigator: 'tasks'
    filter?: { epicId?: string }
    details: { type: 'epic'; epicId: string } | { type: 'task'; epicId: string; taskId: string } | { type: 'graph'; epicId: string } | null
    rightSidebar?: RightSidebarPanel
  }
  ```
- Type guard: `isTasksNavigation(state): state is TasksNavigationState => state.navigator === 'tasks'`
- Route pattern: `/tasks`, `/tasks/:epicId`, `/tasks/:epicId/:taskId`, `/tasks/:epicId/graph`
- Sidebar icon: Lucide `KanbanSquare`, placed between Skills and Settings separator (~L2082-2095 in AppShell)
- MainContentPanel: render a `<TasksPage />` placeholder component (actual content in later tasks)
- Note: fn-1.4 will also modify AppShell.tsx to wire up navigator panel content — coordinate via sequential dependency

## Key context

- NavigationContext at `renderer/contexts/NavigationContext.tsx` manages history stack + route restoration. New routes auto-integrate via parseRouteToNavigationState.
- AppShell.tsx is ~2300 lines. The LinkItem array is around L2082-2095.
- Reuse `springTransition` from `AppShell.tsx:L363` for any animations.
## Approach

- Follow `ChatsNavigationState` pattern at `shared/types.ts:L1128-1212`
- `TasksNavigationState` interface: `{ navigator: 'tasks', filter?: { epicId?: string; status?: TaskStatus }, details?: { type: 'epic' | 'task' | 'graph'; epicId: string; taskId?: string } | null }`
- Type guard: `isTasksNavigation(state): state is TasksNavigationState`
- Route pattern: `/tasks`, `/tasks/:epicId`, `/tasks/:epicId/:taskId`, `/tasks/:epicId/graph`
- Sidebar icon: Lucide `KanbanSquare`, placed between Skills and Settings separator
- MainContentPanel: render a `<TasksPage />` placeholder component (actual content in later tasks)
- Add `sidebar-types.ts` update for tasks mode if needed

## Key context

- NavigationContext at `renderer/contexts/NavigationContext.tsx` manages history stack + route restoration. New routes auto-integrate via parseRouteToNavigationState.
- AppShell.tsx is ~2300 lines. The LinkItem array is around L2082-2095.
## Acceptance
- [ ] `TasksNavigationState` type added to `NavigationState` union matching `ChatsNavigationState` pattern exactly (navigator, filter, details, rightSidebar)
- [ ] `isTasksNavigation()` type guard exported
- [ ] Route builders: `routes.view.tasks()`, `routes.view.epicDetail(epicId)`, `routes.view.taskDetail(epicId, taskId)`, `routes.view.taskGraph(epicId)`
- [ ] Route parser handles all task routes correctly
- [ ] "Tasks" nav item visible in LeftSidebar with KanbanSquare icon
- [ ] Clicking Tasks nav item navigates to tasks view
- [ ] MainContentPanel renders TasksPage placeholder when tasks navigation active
- [ ] TypeScript compiles without errors
## Done summary
Added TasksNavigationState to the NavigationState union with full route builder/parser support, Tasks sidebar nav item with KanbanSquare icon, and TasksPage placeholder rendered from MainContentPanel.
## Evidence
- Commits: 01d238dcc32ff2fbc37ce072d1625490b522ccf1
- Tests: bun typecheck (no new errors)
- PRs: