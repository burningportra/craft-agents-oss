# fn-3-workspace-aware-tasks-onboarding-flow.2 Per-Project UI State Persistence

## Description
Migrate per-project UI state (open tabs, active tab, view mode) from global localStorage atoms to `.flow/ui-state.json` files. Each project gets its own persisted UI state that's always gitignored.

**Size:** M
**Files:** `apps/electron/src/renderer/atoms/tasks-state.ts` (primary — migrate localStorage atoms to file-backed). IPC handlers + preload bridge already implemented by Task 1 in `ipc.ts` and `preload/index.ts`.

## Approach
<!-- Updated by plan-sync: fn-3...1 implemented FLOW_UI_STATE_READ/WRITE IPC handlers directly in ipc.ts (not via FlowBridge class methods), and all ElectronAPI method signatures use camelCase (flowUiStateRead/flowUiStateWrite). The type is FlowUiState (not UiState). -->

- IPC handlers for `FLOW_UI_STATE_READ` and `FLOW_UI_STATE_WRITE` already exist in `ipc.ts` (implemented in Task 1). Preload bridge methods `flowUiStateRead(projectPath)` and `flowUiStateWrite(projectPath, state)` already exist. The renderer calls `window.electronAPI.flowUiStateRead(path)` / `window.electronAPI.flowUiStateWrite(path, state)` directly -- no FlowBridge class methods needed.
- The return type is `FlowUiState | null` for reads and `{ success: boolean; error?: string }` for writes (types defined in `apps/electron/src/shared/types.ts`).
- Replace these global localStorage atoms in `tasks-state.ts` with project-scoped state:
  - `selectedEpicIdAtom` (L66) → `activeTab` in ui-state.json
  - `openTabsAtom` (L78) → `openTabs` in ui-state.json
  - `activeTabAtom` (L87) → `activeTab` in ui-state.json
  - `viewModePerEpicAtomFamily` (L96) → `viewModePerEpic` in ui-state.json
- Keep `atomFamily` pattern for per-epic reactivity. Change underlying storage from localStorage to `.flow/ui-state.json` via custom read-on-mount, debounce-write-on-change pattern.
- Debounce writes at 500ms — follow the pattern from `sessions/persistence-queue.ts` (debounced async writes)
- On project switch: read `.flow/ui-state.json` for new project, hydrate atoms
- When no `ui-state.json` exists (first open): auto-open the epic with the most in-progress tasks (query via FlowBridge). Tiebreaker: most recently updated epic (`updated_at`). If still tied, first by epic ID.
- `.flow/.gitignore` always includes `ui-state.json` (no toggle — simplifies logic)
- **Migration**: Current localStorage atoms are **global** (not per-project). On first load after migration:
  1. Read global localStorage keys
  2. Write to active project's `.flow/ui-state.json`
  3. Clear global localStorage keys after successful write
  4. Other projects (not yet opened) start fresh with "auto-open most active epic" (no data loss — global state was for one project only)
  5. If `.flow/` doesn't exist yet (needs-setup), skip migration — use in-memory defaults
- The `suggestionSidebarOpenAtom` (L538), `dismissedSuggestionsAtomFamily` (L548), `epicReviewPromptShownAtomFamily` (L560) stay in localStorage — they're not per-project critical state

## Key context

- `.flow/ui-state.json` shape: `{ "openTabs": ["fn-1-my-epic"], "activeTab": "fn-1-my-epic", "viewModePerEpic": { "fn-1-my-epic": "kanban" } }`
- IPC channel types and handlers already defined by Task 1 in `types.ts` and `ipc.ts` — renderer calls `window.electronAPI.flowUiStateRead(path)` / `window.electronAPI.flowUiStateWrite(path, state)` directly
- Debounce writes on the renderer side (500ms); IPC handler writes synchronously to `.flow/ui-state.json`
## Acceptance
- [ ] IPC handlers for `FLOW_UI_STATE_READ` and `FLOW_UI_STATE_WRITE` already exist (Task 1) — verify renderer-side integration via `window.electronAPI.flowUiStateRead(path)` / `window.electronAPI.flowUiStateWrite(path, state: FlowUiState)`
- [ ] `openTabs`, `activeTab`, `viewModePerEpic` are persisted to `.flow/ui-state.json`
- [ ] `atomFamily` pattern preserved for per-epic reactivity with file-backed storage
- [ ] Writes are debounced at 500ms
- [ ] On project switch, UI state is restored from `.flow/ui-state.json`
- [ ] First open with no `ui-state.json`: auto-opens most active epic (in-progress count → updated_at → epic ID)
- [ ] `ui-state.json` is always in `.flow/.gitignore`
- [ ] Migration: global localStorage → active project's ui-state.json on first load, then cleared
- [ ] Migration handles missing `.flow/` gracefully (uses in-memory defaults)
- [ ] App typechecks and lints clean
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
