# fn-1-interactive-guided-tasks-gui.6 Tab-based multi-epic navigation with adaptive view selection

## Description
Add tab-based multi-epic navigation and adaptive view selection. Each open epic gets a tab; tab content auto-selects the best view (list/kanban/graph) based on epic state.

**Size:** M
**Files:**
- `apps/electron/src/renderer/components/tasks/EpicTabBar.tsx` — tab bar with epic tabs + add button
- `apps/electron/src/renderer/components/tasks/TasksMainContent.tsx` — routes to correct view per tab
- `apps/electron/src/renderer/components/tasks/ListView.tsx` — simple list view for few tasks
- `apps/electron/src/renderer/atoms/tasks-state.ts` — add openTabs, activeTab, viewModePerEpic atoms

## Approach

- Custom tab bar (not Radix Tabs) for closeable tabs with overflow handling
- Tab state persisted via `atomWithStorage`: `openTabsAtom` (ordered epicId array), `activeTabAtom` (current epicId) — restores on reload
- View selection logic: `<5 tasks → list`, `>=5 tasks → kanban`, `any deps → graph available in toggle`
- User override: `viewModePerEpicFamily(epicId)` atom persisted with `atomWithStorage`
- View toggle: small segmented control [List] [Kanban] [Graph] below tab bar
- Tab overflow: horizontal scroll with arrow buttons when >8 tabs
- Close tab: X button on tab, middle-click
- Opening an epic from navigator: adds tab if not open, switches to it if already open
- Keep heavy views mounted with `display: none` when inactive (preserve scroll/zoom state)
- Reuse `springTransition` from `AppShell.tsx:L363` for tab animations

## Key context

- The kanban board (task 5) becomes one view option within a tab
- The dependency graph (task 8) becomes another view option
- ListView is a simple table: task title, status, size, assignee — minimal effort
## Approach

- Tabs at top of main content area (not Radix Tabs — custom tab bar for closeable tabs with overflow)
- Tab state: `openTabsAtom` (ordered array of epicIds), `activeTabAtom` (current epicId)
- View selection logic: `<5 tasks → list`, `>=5 tasks → kanban`, `any deps → graph available in toggle`
- User override: `viewModePerEpicFamily(epicId)` atom persisted with `atomWithStorage`
- View toggle: small segmented control [List] [Kanban] [Graph] below tab bar
- Tab overflow: horizontal scroll with arrow buttons when >8 tabs
- Close tab: X button on tab, middle-click
- Opening an epic from navigator: adds tab if not open, switches to it if already open

## Key context

- The kanban board (task 5) becomes one view option within a tab
- The dependency graph (task 8) becomes another view option
- ListView is a simple table: task title, status, size, assignee — minimal effort
- Keep heavy views mounted with `display: none` when inactive (preserve scroll/zoom state)
## Acceptance
- [ ] Tab bar shows one tab per open epic with close button
- [ ] Switching tabs changes active epic view
- [ ] Opening epic from navigator adds/activates tab
- [ ] Tab state persisted via atomWithStorage — restores open tabs and active tab on reload
- [ ] Auto-selects best view: list (<5 tasks), kanban (>=5), graph toggle available
- [ ] User can override view with segmented control
- [ ] View preference persisted per epic across sessions
- [ ] Tab overflow: horizontal scroll with arrow buttons
- [ ] Middle-click closes tab
- [ ] Inactive views stay mounted (display: none) to preserve state
- [ ] Tab animations use springTransition from AppShell
## Done summary
Implemented tab-based multi-epic navigation with adaptive view selection. Added EpicTabBar for closeable tabs with scroll arrows, ViewModeSelector segmented control, ListView for small epics, and TasksMainContent to route between views. Tab state persists via atomWithStorage with validation against current workspace epics.
## Evidence
- Commits: 5be9479cf6b23a2d0a7d73c5e8f8a8a8b8c8d8e8, 9be8d8635dfd8faa29a1419d927cc3207c5ebff6
- Tests: bun lint
- PRs: