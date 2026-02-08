# fn-4-real-ai-epic-chat-with-project-aware.4 Cross-Project Knowledge Context

## Description
Enhance the epic chat agent's `buildSystemPrompt()` with cross-project knowledge. Read learnings and patterns from all registered flow projects and include them as context so the AI can suggest improvements based on what's worked in other projects.

**Size:** S
**Files:**
- `apps/electron/src/main/lib/epic-chat-agent.ts` (enhance `buildSystemPrompt()` — fill in the extension point from Task 1)
- `apps/electron/src/main/ipc.ts` (minor: add helper to read registered projects list)

## Approach

- In `epic-chat-agent.ts`, add a `gatherCrossProjectContext(currentWorkspaceRoot: string)` function that:
  1. Gets list of registered flow projects: use the existing `FLOW_PROJECT_LIST` IPC method (see `types.ts:1197`) by reading from the cached FlowBridge instances in `ipc.ts`, OR maintain a simple cache populated when `FLOW_PROJECT_REGISTER` is called. The simplest approach: read the registered projects config file directly from disk if it exists at a known path, or accept the list as a parameter passed from the IPC handler.
  2. For each project (excluding current): read `{projectRoot}/learnings.md` if it exists (via `fs.readFile`), read `.flow/memory/*.md` files if they exist
  3. Aggregate learnings into a structured context block: project name, key learnings/decisions, patterns
  4. Cap total cross-project context to ~6000 chars (conservative estimate for ~2000 tokens including code snippets) — prioritize projects with more learnings, truncate individual entries
- Fill in the `extraContext` parameter of `buildSystemPrompt()` (created in Task 1) with the gathered cross-project context
- Format the context block:
  ```
  ## Patterns from other projects
  These learnings come from other projects in this workspace. Suggest relevant improvements where applicable:
  [aggregated learnings]
  ```
- Also include current project's `.flow/memory/` entries under "Current Project Context" (in addition to `learnings.md` already included by Task 1)
- Handle missing files gracefully (many projects won't have learnings.md yet) — just skip
- Cache cross-project context with 30-minute TTL (learnings files rarely change during active development): simple `Map<string, { context: string, timestamp: number }>`, invalidate if older than 30 minutes

## Key context

- `learnings.ts` at `packages/shared/src/agent/learnings.ts` has `readLearnings(workspaceRoot)` function — reuse for current project's learnings
- `.flow/memory/` directory may contain topic-specific memory files (e.g., `electron-titlebar-clickability.md`)
- Task 1 creates `buildSystemPrompt()` with `extraContext?` parameter — this task fills that parameter
- `RegisteredFlowProject` type at `shared/types.ts:827-831` has `{ name, path, active }`
- The simplest approach for getting registered projects in main process: accept project list as parameter from the IPC handler (renderer sends it alongside the chat request since it has access to `registeredFlowProjectsAtom`)
## Approach

- In `epic-chat-agent.ts`, add a `gatherCrossProjectContext()` function that:
  1. Gets list of registered flow projects from `registeredFlowProjectsAtom` (or via IPC from the FlowBridge instances cached per workspace in `ipc.ts`)
  2. For each project (excluding current): read `{projectRoot}/learnings.md` if it exists (via `fs.readFile`), read `.flow/memory/*.md` files if they exist
  3. Aggregate learnings into a structured context block: project name, key learnings/decisions, patterns
  4. Cap total cross-project context to ~2000 tokens (roughly 8000 chars) to avoid token bloat — prioritize projects with more learnings, truncate individual entries
- Add this context to the system prompt under a "Cross-Project Knowledge" section:
  ```
  ## Patterns from other projects
  These learnings come from other projects in this workspace. Suggest relevant improvements where applicable:
  [aggregated learnings]
  ```
- Also include current project's `learnings.md` and `.flow/memory/` entries under "Current Project Context"
- Use `RegisteredFlowProject` type at `shared/types.ts:827-831` which has `{ name, path, active }` — iterate over all registered projects
- Handle missing files gracefully (many projects won't have learnings.md yet)
- Cache cross-project context per session (don't re-read on every message) — use a simple `Map<workspaceRoot, { context, timestamp }>` with 5-minute TTL

## Key context

- `learnings.ts` at `packages/shared/src/agent/learnings.ts` extracts decisions/patterns from agent sessions — these get written to `{workspaceRoot}/learnings.md`
- `registeredFlowProjectsAtom` stores all known projects — but this is a renderer atom. In the main process, registered projects are accessed via `flow-bridge.ts` instances cached in `ipc.ts`
- `.flow/memory/` directory may contain topic-specific memory files (e.g., `electron-titlebar-clickability.md`)
- The `FLOW_READ_PROJECT_CONTEXT` handler at `ipc.ts:2882-2919` already reads package.json name + README — extend or follow this pattern
## Acceptance
- [ ] `gatherCrossProjectContext()` function reads learnings from registered projects
- [ ] System prompt includes learnings from current project's `.flow/memory/` files
- [ ] System prompt includes learnings from other registered flow projects (excluding current)
- [ ] Cross-project context capped at ~6000 chars with prioritization
- [ ] Missing files handled gracefully (no errors if learnings.md doesn't exist)
- [ ] Context cached with 30-minute TTL (not re-read on every message)
- [ ] `buildSystemPrompt()` receives cross-project context via `extraContext` parameter
- [ ] TypeScript compiles with no errors
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
