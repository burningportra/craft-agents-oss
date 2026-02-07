# PRD-002: `/plan` Command Execution in craft-agents-oss

**Author:** Computer + Kevin  
**Date:** 2026-02-07  
**Repo:** `burningportra/craft-agents-oss`  
**Status:** Draft

---

## Problem

The epic creation wizard works — users can create epics and get a "run /plan to break this into tasks" prompt. But `/plan` doesn't do anything yet. The entire value prop of craft-agents (AI-driven project planning → task breakdown → execution) dead-ends at epic creation.

## Goal

Wire `/plan` so it takes an epic, runs an AI planning agent, and produces a structured task list that the user can review, edit, and approve before execution begins.

## Non-Goals

- Auto-execution of tasks (future — plan first, execute later)
- Multi-epic dependency graphs
- External tool integrations (Jira, Linear sync)

## User Flow

```
1. User creates epic via wizard → epic saved with title + description
2. User runs /plan (or clicks "Plan" button on epic)
3. Planning agent:
   a. Reads epic description + any attached context
   b. Analyzes codebase (if repo is linked) for relevant files/patterns
   c. Produces task breakdown: ordered list of tasks with:
      - Title
      - Description (what to do, not how)
      - Estimated complexity (S/M/L)
      - File targets (which files likely touched)
      - Dependencies (which tasks block this one)
4. Tasks appear in ListView under the epic
5. User can: reorder, edit, delete, add tasks, or approve the plan
6. Approved plan locks tasks for execution phase (future PRD)
```

## Architecture

### IPC Channels (Electron)
- `FLOW_EPIC_PLAN` — triggers planning for a given epicId
- `FLOW_EPIC_PLAN_STATUS` — streams planning progress back to renderer
- `FLOW_EPIC_PLAN_APPROVE` — user approves the generated plan

### Planning Agent
- Reuse the existing agent infrastructure (DirectChatTransport + ToolLoopAgent pattern from compound-engineering-ui's brainstorm agent — **port this over**)
- System prompt tailored for project planning:
  - Input: epic title, description, codebase context (file tree, key files)
  - Output: structured JSON task list
- Tools available to the agent:
  - `read_file` — read specific files for context
  - `list_directory` — explore project structure
  - `search_codebase` — grep/ripgrep for patterns
  - `emit_plan` — structured output tool that produces the task list

### Data Model

```typescript
interface Task {
  id: string
  epicId: string
  title: string
  description: string
  complexity: 'S' | 'M' | 'L'
  fileTargets: string[]
  dependsOn: string[]  // task ids
  status: 'planned' | 'approved' | 'in_progress' | 'done'
  order: number
}

interface PlanResult {
  epicId: string
  tasks: Task[]
  reasoning: string  // agent's explanation of the breakdown
  estimatedTotal: string  // "~4 hours" or "2-3 sessions"
}
```

### Storage
- Tasks stored via flowctl (same as epics) — extend the Flow data model
- Plan reasoning stored as a note on the epic

### UI Components
1. **PlanningView** — shows streaming progress while agent thinks ("Analyzing codebase…", "Breaking down into tasks…", "Estimating complexity…")
2. **TaskListView** — ordered list of generated tasks with drag-to-reorder, inline edit, delete
3. **PlanApprovalBar** — sticky bottom bar: "Approve Plan (N tasks)" / "Re-plan" / "Edit manually"
4. **TaskCard** — title, description, complexity badge, file targets as chips, dependency arrows

## Implementation Phases

| Phase | Scope | Estimate |
|-------|-------|----------|
| 1 | Data model: Task schema + flowctl integration | 2h |
| 2 | Planning agent: system prompt + tools + structured output | 3–4h |
| 3 | IPC wiring: FLOW_EPIC_PLAN + streaming progress | 2h |
| 4 | UI: PlanningView + TaskListView + approval flow | 3–4h |
| 5 | Polish: drag reorder, inline edit, dependency visualization | 2–3h |
| **Total** | | **~12–15h** |

## Success Criteria

- `/plan` produces a sensible task breakdown for any epic in <30 seconds
- Tasks have accurate file targets (agent actually reads the codebase)
- User can modify the plan before approving
- Approved tasks persist and show in the epic's ListView

## Risks

- **Agent quality** — planning quality depends heavily on system prompt engineering. Budget time for prompt iteration.
- **Codebase context window** — large repos may exceed context. Need smart file selection (file tree + targeted reads, not dump-everything).
- **Port from compound-engineering-ui** — the brainstorm agent pattern exists there. Since we're abandoning that repo, extract the agent infra cleanly into craft-agents-oss.

## Open Questions

1. Should `/plan` auto-run on epic creation, or always be manual?
2. Do we want a "plan diff" view when re-planning (show what changed)?
3. Should the planning agent have access to git history (recent commits) for better context?

## Pattern Note

This is essentially the same loop as Cursor's composer or Devin's planning phase: **context gather → AI breakdown → human review → execute**. The differentiator is that craft-agents makes this a first-class desktop experience with epic/task hierarchy, not a chat-embedded flow. Lean into that.
