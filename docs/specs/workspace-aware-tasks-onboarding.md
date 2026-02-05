# Workspace-Aware Tasks & Onboarding Flow

## Problem

The Tasks view currently resolves the project directory via `process.cwd()` with fallback to `workspace.rootPath`, meaning it looks at the app's own repo instead of letting the user select which workspace/directory to manage tasks for. Users need to:
1. Select which workspace's `.flow/` to use (from registered workspaces)
2. Get a polished onboarding experience when no `.flow/` exists
3. Have per-workspace state persistence and instant switching

## Key Decisions

- **1:1 workspace mapping**: Each app workspace maps to exactly one flow-next project directory
- **Active workspace only**: Tasks navigator shows epics only from the currently selected workspace
- **Sidebar workspace switcher**: Workspace selection lives in the main sidebar menu
- **Full onboarding wizard**: 5-step modal wizard when `.flow/` doesn't exist
- **UI state in `.flow/`**: Persist open tabs and view mode in `.flow/ui-state.json` (gitignored)
- **Instance-per-workspace FlowBridge**: Cache FlowBridge instances in a Map, no eviction limit
- **Native OS folder picker**: Use `dialog.showOpenDialog` for adding new workspaces
- **Jotai atom for project state**: Single atom holding `{ path, flowStatus, gitInfo? }`
- **Incremental delivery**: Single epic with ordered tasks for incremental delivery

## Architecture

### Workspace Resolution

```
activeWorkspaceAtom → { path: string, flowStatus: 'initialized' | 'needs-setup' | 'error', gitInfo?: { branch, remote, lastCommit } }
```

- Replace `process.cwd()` / `workspace.rootPath` pattern in `TasksPage.tsx`
- Derive from app's existing active workspace concept
- Lazily fetch git info when workspace is selected (not on list load)

### FlowBridge Cache

```
flowBridgeCache: Map<string, FlowBridge>  // keyed by workspace path
getFlowBridge(path) → cached or new FlowBridge instance
```

- No limit on cached instances (lightweight: path + write queue)
- No eviction needed

### Per-Workspace State Persistence

**File**: `.flow/ui-state.json` (auto-gitignored)

**Shape**:
```json
{
  "openTabs": ["fn-1-my-epic", "fn-2-other"],
  "activeTab": "fn-1-my-epic",
  "viewModePerEpic": {
    "fn-1-my-epic": "kanban",
    "fn-2-other": "list"
  }
}
```

**Save trigger**: Debounced write on every state change (tab open/close, view switch)
**First open (no ui-state.json)**: Auto-open the epic with the most in-progress tasks

## Sidebar Workspace Switcher

**Location**: Main sidebar menu, alongside other navigation items

**Workspace list item shows**:
- Auto-generated colored avatar (initials + color hash from name)
- Workspace name
- Directory path (truncated)
- Health badge:
  - Green check: `.flow/` exists, N epics count
  - Yellow warning: needs setup (no `.flow/`)
  - Stale counts for inactive workspaces (only live-update active workspace via file watcher)

**Actions**:
- Click to switch workspace (instant swap - load cached state, refresh in background)
- `+ Add Workspace` button → native OS folder picker
- On add: auto-detect git root, suggest using it if selected dir is a subdirectory of a git repo

**Remove workspace**: Unregister only (`.flow/` stays on disk)

## Onboarding Wizard (5-Step Modal)

Triggers when Tasks view loads for a workspace with no `.flow/` directory.

### Step 1: Welcome
- Explain the full flow-next methodology: plan → work → review cycle with scouts
- Include interactive demo with clickable walkthrough
- Demo uses repo-aware content: analyze README + package.json to generate contextual example
- AI-generated demo content (with graceful fallback to templates if AI unavailable)

### Step 2: Interactive Demo
- Show the plan → work → review cycle with sample data relevant to the user's project
- Clickable elements showing how epics, tasks, kanban, and AI features work

### Step 3: Configure Options
- Whether to gitignore `ui-state.json` (default: yes)
- Default view mode preference (list/kanban)
- Sidebar preferences

### Step 4: Initialize
- Run `flowctl init` to create `.flow/` directory
- Show progress/result
- On error: detailed modal dialog with full error details, troubleshooting steps, retry/cancel

### Step 5: Create First Epic + Celebrate
- Opens the existing `EpicCreationWizard` (Quick/Standard/Complex)
- On completion: confetti animation, summary of what was created
- "Get Started" button closes wizard and navigates to new epic's kanban view

**Skip behavior**: Must complete steps 1-2 (explain + init). Steps 3-5 are skippable.

## Brief Welcome (Existing .flow/)

When a workspace has `.flow/` but user opens it for the first time (e.g. cloned repo):
- Show project overview: project name, number of epics/tasks, in-progress work summary
- Auto-open the most active epic
- Dismissible, non-blocking

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No workspaces registered at all | Polished empty state explaining workspace concept with CTA to add one |
| `.flow/` deleted while app running | File watcher detects deletion, show banner: ".flow/ was removed. Re-initialize?" |
| Monorepo | Only look for `.flow/` at workspace root. If not there, prompt to init |
| Workspace switch | Instant swap: show cached state immediately, refresh data in background |
| Git info display | Lazy fetch on workspace select: branch, remote URL, last commit |
| Add workspace → git subdirectory | Auto-detect git root, suggest using repo root instead of selected subdir |

## Acceptance Criteria

- [ ] Tasks view uses active workspace's `rootPath` instead of `process.cwd()`
- [ ] Jotai atom tracks active project path + flow status + git info
- [ ] FlowBridge instances cached per workspace path
- [ ] Sidebar menu shows workspace list with auto-generated avatars and health badges
- [ ] `+ Add Workspace` opens native OS folder picker with git root auto-detection
- [ ] Switching workspaces is instant (cached state swap, background refresh)
- [ ] 5-step onboarding wizard shown when `.flow/` doesn't exist
- [ ] Onboarding includes repo-aware AI-generated interactive demo
- [ ] Configuration step offers gitignore + default view preferences
- [ ] Onboarding steps 1-2 required, 3-5 skippable
- [ ] Step 5 reuses EpicCreationWizard, ends with confetti + summary
- [ ] UI state persisted to `.flow/ui-state.json` (debounced, gitignored)
- [ ] Per-workspace state restored on switch (open tabs, active tab, view mode)
- [ ] First open of cloned repo shows brief project overview welcome
- [ ] `.flow/` deletion detected, user prompted to re-initialize
- [ ] No workspace state shows polished empty state with add workspace CTA
- [ ] Error during init shows detailed dialog with troubleshooting + retry
