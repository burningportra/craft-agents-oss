# fn-3-workspace-aware-tasks-onboarding-flow.3 Sidebar Project Switcher

## Description
Add a project switcher component to the sidebar that shows registered projects with colored avatars, health badges, and actions for adding/removing projects.

**Size:** M
**Files:** new `apps/electron/src/renderer/components/app-shell/ProjectSwitcher.tsx`, `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx`, `apps/electron/src/renderer/components/app-shell/AppShell.tsx`

## Approach

- Create `ProjectSwitcher` component following existing sidebar patterns in `LeftSidebar.tsx`
- Place it in the sidebar area near the Tasks navigation item
- Each project item renders:
  - Auto-generated colored avatar: 2-letter initials from project name + deterministic color from name hash (similar to pastanaga-angular's `hashCode % colorPalette.length` pattern)
  - Project name: priority is (1) `name` field from `package.json`, (2) directory basename
  - Directory path (truncated with tooltip for full path)
  - Health badge: green check if `.flow/` exists (show epic count), yellow warning if needs setup
- Click switches `activeFlowProjectAtom` — should feel instant (cached state swap, background refresh)
- `+ Add Project` button triggers existing `OPEN_FOLDER_DIALOG` IPC at `types.ts:631`
  - After folder selection: run `git rev-parse --show-toplevel` to detect git root
  - If git command fails (not a git repo, no git binary, corrupted repo): proceed with selected directory without error. Log warning.
  - If selected dir ≠ git root: show dialog suggesting git root instead
  - Register project to `registeredFlowProjectsAtom`
- Remove project: context menu → unregister from atom (`.flow/` stays on disk)
- Health badges: stale counts for inactive projects (only live-update active project via FlowWatcher)

## Key context

- `LeftSidebar.tsx` uses `SidebarItem` array pattern with expandable items and context menus — follow this
- Existing Radix `DropdownMenu` and `ContextMenu` are already in dependencies
- IPC channel types for project management already defined by Task 1 in `types.ts`
- `useActiveWorkspace()` at `AppShellContext.tsx:179-183` is the existing auth workspace concept — project switcher is parallel to it
## Approach

- Create `ProjectSwitcher` component following existing sidebar patterns in `LeftSidebar.tsx`
- Place it in the sidebar area near the Tasks navigation item
- Each project item renders:
  - Auto-generated colored avatar: 2-letter initials from project name + deterministic color from name hash (similar to pastanaga-angular's `hashCode % colorPalette.length` pattern)
  - Project name (derived from directory name or package.json name)
  - Directory path (truncated with tooltip for full path)
  - Health badge: green check if `.flow/` exists (show epic count), yellow warning if needs setup
- Click switches `activeProjectAtom` — should feel instant (cached state swap, background refresh)
- `+ Add Project` button triggers existing `OPEN_FOLDER_DIALOG` IPC at `types.ts:631`
  - After folder selection: run `git rev-parse --show-toplevel` to detect git root
  - If selected dir ≠ git root, show dialog suggesting git root instead
  - Register project to `registeredProjectsAtom`
- Remove project: context menu or button → unregister from atom (`.flow/` stays on disk)
- Health badges: stale counts for inactive projects (only live-update active project via FlowWatcher)

## Key context

- `LeftSidebar.tsx` uses `SidebarItem` array pattern with expandable items and context menus — follow this
- Existing Radix `DropdownMenu` and `ContextMenu` are already in dependencies
- `OPEN_FOLDER_DIALOG` handler exists in `ipc.ts` — may need to extract project name from `package.json` in the selected directory
- `useActiveWorkspace()` at `AppShellContext.tsx:179-183` is the existing auth workspace concept — project switcher is parallel to it
## Acceptance
- [ ] `ProjectSwitcher` component renders in sidebar
- [ ] Each project shows colored avatar with initials + deterministic color
- [ ] Project name priority: package.json name → directory basename
- [ ] Each project shows name, truncated path, and health badge
- [ ] Health badge shows green (initialized + epic count) or yellow (needs setup)
- [ ] Clicking a project switches `activeFlowProjectAtom` instantly
- [ ] `+ Add Project` opens native folder picker
- [ ] Git root auto-detection suggests repo root if subdirectory selected
- [ ] Git command failure handled gracefully (proceed with selected directory, no error dialog)
- [ ] Remove project unregisters without deleting `.flow/`
- [ ] Only active project's epic count is live-updated
- [ ] Component follows existing sidebar patterns
- [ ] App typechecks and lints clean
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
