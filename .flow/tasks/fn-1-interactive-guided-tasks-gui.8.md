# fn-1-interactive-guided-tasks-gui.8 Read-only dependency graph: dagre layout, click-to-navigate

## Description
Build the read-only dependency graph visualization using @xyflow/react and @dagrejs/dagre. Click nodes to navigate to tasks. Viewport state (zoom/pan) preserved when switching views.

**Size:** M
**Files:**
- `apps/electron/src/renderer/components/tasks/DependencyGraph.tsx` — React Flow canvas with dagre layout
- `apps/electron/src/renderer/components/tasks/TaskNode.tsx` — custom node component for graph

## Approach

- Install `@xyflow/react` and `@dagrejs/dagre` as new dependencies
- Build nodes from tasks array, edges from `depends_on` arrays
- Run dagre layout with `rankdir: 'TB'`, `nodesep: 50`, `ranksep: 50`
- Layout after nodes are measured: use `useNodesInitialized()` hook, then apply dagre positions
- Custom TaskNode: shows task title, status color-coded border, size badge
- Read-only: `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable={false}`
- Keep `panOnDrag` and `zoomOnScroll` enabled
- `onNodeClick`: open slide-over detail panel (preserves graph state since panel is overlay)
- Viewport state (zoom, pan position) stored in Jotai atom per epic, restored when switching back from other views
- `fitView` on initial layout only (not on every re-render)
- Can reuse dagre utilities from `packages/mermaid/src/dagre-adapter.ts` (centerToTopLeft, snapToOrthogonal)
- Memoize dagre computation — only re-run when node/edge arrays change by reference

## Key context

- React Flow v12+ rebranded as @xyflow/react — import from `@xyflow/react`
- Common bug: hardcoding node dimensions breaks with variable content. Must measure first.
- This view is one of the adaptive view options in the tab content (task 6)
- Graph stays mounted with `display: none` when tab switches to kanban/list (task 6)
## Approach

- Install `@xyflow/react` and `@dagrejs/dagre` as new dependencies
- Build nodes from tasks array, edges from `depends_on` arrays
- Run dagre layout with `rankdir: 'TB'`, `nodesep: 50`, `ranksep: 50`
- Layout after nodes are measured: use `useNodesInitialized()` hook, then apply dagre positions
- Custom TaskNode: shows task title, status color-coded border, size badge
- Read-only: `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable={false}`
- Keep `panOnDrag` and `zoomOnScroll` enabled
- `onNodeClick`: navigate to task (update TasksNavigationState details)
- `fitView` after layout completes
- Can reuse dagre utilities from `packages/mermaid/src/dagre-adapter.ts` (centerToTopLeft, snapToOrthogonal)

## Key context

- React Flow v12+ was rebranded as @xyflow/react — import from `@xyflow/react`
- Common bug: hardcoding node dimensions breaks with variable content. Must measure first.
- This view is one of the adaptive view options in the tab content (task 6)
## Acceptance
- [ ] @xyflow/react and @dagrejs/dagre installed
- [ ] Graph renders all tasks as nodes with dependency edges
- [ ] Dagre auto-layout positions nodes (top-to-bottom)
- [ ] Custom TaskNode shows title, status color, size badge
- [ ] Graph is read-only (no drag nodes, no connect edges)
- [ ] Pan and zoom enabled
- [ ] Click node opens slide-over task detail (graph preserved behind overlay)
- [ ] Viewport state (zoom, pan) persisted in Jotai atom per epic
- [ ] fitView on initial layout only
- [ ] Dagre computation memoized (re-runs only on node/edge change)
- [ ] Empty state when epic has no dependencies
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
