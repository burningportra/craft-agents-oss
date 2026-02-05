# fn-3-workspace-aware-tasks-onboarding-flow.2 Per-Project UI State Persistence

## Description
Migrate per-project UI state (open tabs, active tab, view mode) from global localStorage atoms to `.flow/ui-state.json` files. Each project gets its own persisted UI state that's always gitignored.

**Size:** M
**Files:** `apps/electron/src/renderer/atoms/tasks-state.ts`, `apps/electron/src/main/lib/flow-bridge.ts`, `apps/electron/src/main/ipc.ts`, `apps/electron/src/preload/index.ts`

## Approach

- Add `readUiState` and `writeUiState` methods to `FlowBridge` class at `flow-bridge.ts` for reading/writing `.flow/ui-state.json`
- Implement IPC handlers for `FLOW_UI_STATE_READ` and `FLOW_UI_STATE_WRITE` (channel constants and types already defined in Task 1)
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
- IPC channel types already defined by Task 1 in `types.ts` — just implement handlers
- FlowBridge's write queue pattern at `flow-bridge.ts:36-44` ensures serialized writes — debounce on the renderer side, FlowBridge queues on the main side
## Approach

- Add `readUiState` and `writeUiState` methods to `FlowBridge` class at `flow-bridge.ts` for reading/writing `.flow/ui-state.json`
- Add IPC channels: `FLOW_UI_STATE_READ`, `FLOW_UI_STATE_WRITE`
- Replace these global localStorage atoms in `tasks-state.ts` with project-scoped state:
  - `selectedEpicIdAtom` (L66) → `activeTab` in ui-state.json
  - `openTabsAtom` (L78) → `openTabs` in ui-state.json
  - `activeTabAtom` (L87) → `activeTab` in ui-state.json
  - `viewModePerEpicAtomFamily` (L96) → `viewModePerEpic` in ui-state.json
- Debounce writes at 500ms — follow the pattern from `sessions/persistence-queue.ts:` (debounced async writes)
- On project switch: read `.flow/ui-state.json` for new project, hydrate atoms
- When no `ui-state.json` exists (first open): auto-open the epic with the most in-progress tasks (query via FlowBridge)
- Ensure `flowctl init` adds `ui-state.json` to `.flow/.gitignore`
- Migration: on first load, if localStorage has values but `ui-state.json` doesn't exist, seed `ui-state.json` from localStorage then clear localStorage keys

## Key context

- `.flow/ui-state.json` shape: `{ "openTabs": ["fn-1-my-epic"], "activeTab": "fn-1-my-epic", "viewModePerEpic": { "fn-1-my-epic": "kanban" } }`
- The `suggestionSidebarOpenAtom` (L538), `dismissedSuggestionsAtomFamily` (L548), `epicReviewPromptShownAtomFamily` (L560) can stay in localStorage — they're not per-project critical state
- FlowBridge's write queue pattern at `flow-bridge.ts:36-44` ensures serialized writes — debounce on the renderer side, FlowBridge queues on the main side
## Acceptance
- [ ] `FlowBridge` has `readUiState()` and `writeUiState(state)` methods
- [ ] IPC handlers for `FLOW_UI_STATE_READ` and `FLOW_UI_STATE_WRITE` implemented
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
