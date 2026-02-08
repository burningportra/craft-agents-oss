# fn-4-real-ai-epic-chat-with-project-aware.1 Epic Chat Agent + IPC Streaming Layer

## Description
Create a new `epic-chat-agent.ts` module in the main process that handles all epic chat LLM calls (free-form, `/interview`, `/review`) with streaming responses. Add the corresponding IPC channels following the established 3-file pattern. Create a modular `buildSystemPrompt()` function with an extension point for cross-project context (Task 4 will enhance it).

**Size:** M
**Files:**
- `apps/electron/src/main/lib/epic-chat-agent.ts` (NEW)
- `apps/electron/src/shared/types.ts` (add IPC channels + ElectronAPI methods)
- `apps/electron/src/main/ipc.ts` (add handler)
- `apps/electron/src/preload/index.ts` (add bridge methods)

## Approach

- Follow `planning-agent.ts` pattern at `apps/electron/src/main/lib/planning-agent.ts:242-297` for Anthropic SDK usage but fix its anti-patterns
- Add two IPC channels: `FLOW_EPIC_CHAT_SEND` (renderer→main, invoke) and `FLOW_EPIC_CHAT_STATUS` (main→renderer, streaming events via `webContents.send`)
- Add `FLOW_EPIC_CHAT_ABORT` channel for cancellation
- Agent function signature: `executeChat(params: { epicId, commandType, message, history, workspaceRoot, window })` where `commandType` is `'interview' | 'review' | 'chat'`
- Create a `buildSystemPrompt(params: { commandType, epicSpec, taskContext, projectMetadata, extraContext? })` function that:
  - Varies prompt by commandType (interview=requirements elicitation, review=epic analysis, chat=general assistance)
  - Includes epic spec (via `readEpicSpec`), task list with statuses, project metadata
  - Accepts optional `extraContext` string for cross-project knowledge (Task 4 will provide this)
  - Has a `// Task 4: Cross-project context injected here` comment at the extension point
- **Credential manager**: `import { getCredentialManager } from '@craft-agent/shared/credentials'`, then `const apiKey = await getCredentialManager().getApiKey()`. Create Anthropic client with explicit apiKey parameter: `new Anthropic({ apiKey })`
- **Model**: `import { DEFAULT_MODEL } from '@craft-agent/shared/config'` — use `DEFAULT_MODEL` constant directly (currently `claude-sonnet-4-5-20250929`)
- Use `client.messages.stream({ model: DEFAULT_MODEL, ... })` for streaming — forward `text` events as `{ type: 'text_delta', text }` and `end` as `{ type: 'text_complete' }` via `webContents.send('flow:epic-chat-status', event)`
- Track active streams in `Map<string, AbortController>` keyed by `${workspaceRoot}:${epicId}` to avoid cross-workspace collisions — abort previous stream if new request arrives for same key
- Accept `history: Array<{ role, content }>` parameter (pre-truncated by renderer, expected ~20 messages max)
- Read `learnings.md` from workspace root if it exists (via `readLearnings()` from `packages/shared/src/agent/learnings.ts`), include in system prompt under "Project Learnings"
- Error handling: catch Anthropic API errors, send typed error events:
  - 429 → `{ type: 'error', errorType: 'rate_limit', message: '...' }`
  - 401 → `{ type: 'error', errorType: 'auth', message: '...' }`
  - Network/other → `{ type: 'error', errorType: 'network', message: '...' }`
  - Invalid response → `{ type: 'error', errorType: 'invalid_response', message: '...' }`

## Key context

- Existing IPC channel pattern: `shared/types.ts:766-799` defines channels, `ipc.ts:2686-2726` handles them, `preload/index.ts:509-521` bridges them
- `updateLastMessage` in `EpicChatHistory.tsx:266-279` is already wired for streaming but unused — Task 2 will connect it
- Planning agent hardcodes `claude-sonnet-4-20250514` at `planning-agent.ts:245` — do NOT follow this. Use `DEFAULT_MODEL` from `@craft-agent/shared/config`
- ElectronAPI interface at `shared/types.ts:881` — add `flowEpicChatSend`, `onFlowEpicChatStatus`, `flowEpicChatAbort`
- `getCredentialManager()` is a singleton from `@craft-agent/shared/credentials` — safe to call multiple times
## Approach

- Follow `planning-agent.ts` pattern at `apps/electron/src/main/lib/planning-agent.ts:242-297` for Anthropic SDK usage
- Add two IPC channels: `FLOW_EPIC_CHAT_SEND` (renderer→main, invoke) and `FLOW_EPIC_CHAT_STATUS` (main→renderer, streaming events via `webContents.send`)
- Add `FLOW_EPIC_CHAT_ABORT` channel for cancellation
- Agent function signature: `executeChat(params: { epicId, commandType, message, history, workspaceRoot, window })` where `commandType` is `'interview' | 'review' | 'chat'`
- Build system prompt per command type using `getCommandSystemPrompt()` pattern from `ChatActionButtons.tsx:122-133` but richer — include epic spec (via `readEpicSpec`), task list with statuses, project metadata (package.json name, README first paragraph via `FLOW_READ_PROJECT_CONTEXT` handler at `ipc.ts:2882-2919`)
- Use `client.messages.stream()` (not `.create()`) for streaming — forward `text` events as `{ type: 'text_delta', text }` and `end` as `{ type: 'text_complete' }` via `webContents.send('flow:epic-chat-status', event)`
- Track active streams in `Map<string, AbortController>` keyed by epicId — abort previous stream if new request arrives for same epic
- Use app's credential path: get API key from credential manager (follow pattern in `sessions.ts` for Anthropic client creation), NOT raw `new Anthropic()` with env var
- Use user's configured model from `packages/shared/src/config/models.ts` — `getDefaultModel()` or similar
- Accept `history: Array<{ role, content }>` parameter — last 20 messages max, renderer truncates before sending
- Read `learnings.md` from workspace root if it exists, include in system prompt under "Project Learnings" section

## Key context

- Existing IPC channel pattern: `shared/types.ts:766-799` defines channels, `ipc.ts:2686-2726` handles them, `preload/index.ts:509-521` bridges them
- `updateLastMessage` in `EpicChatHistory.tsx:266-279` is already wired for streaming but unused — Task 2 will connect it
- Planning agent hardcodes `claude-sonnet-4-20250514` at `planning-agent.ts:245` — do NOT follow this pattern, use model config
- ElectronAPI interface at `shared/types.ts:881` — add `flowEpicChatSend`, `onFlowEpicChatStatus`, `flowEpicChatAbort`
## Acceptance
- [ ] `epic-chat-agent.ts` exists with `executeChat()` function accepting epicId, commandType, message, history, workspaceRoot
- [ ] `buildSystemPrompt()` function is modular with `extraContext?` parameter for Task 4 extension
- [ ] Three IPC channels added: `FLOW_EPIC_CHAT_SEND`, `FLOW_EPIC_CHAT_STATUS`, `FLOW_EPIC_CHAT_ABORT`
- [ ] Preload exposes `flowEpicChatSend()`, `onFlowEpicChatStatus()`, `flowEpicChatAbort()`
- [ ] Agent streams text deltas via `webContents.send` (not request-response)
- [ ] AbortController tracked per `${workspaceRoot}:${epicId}`; new request aborts previous stream
- [ ] System prompt varies by commandType (interview=requirements elicitation, review=epic analysis, chat=general assistance)
- [ ] System prompt includes epic spec, task list with statuses, project name from package.json
- [ ] Uses `getCredentialManager().getApiKey()` for API key (not env var, not raw `new Anthropic()`)
- [ ] Uses `DEFAULT_MODEL` constant from `@craft-agent/shared/config` (not hardcoded model string)
- [ ] Accepts conversation history array for multi-turn context
- [ ] Error events sent for common failures (rate limit, auth, network, invalid response) with typed error codes
- [ ] API key never sent to renderer process (IPC payloads verified to not include credentials)
- [ ] TypeScript compiles with no errors (`bun run typecheck`)
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
