# Real AI Epic Chat with Project-Aware Context

## Overview

The epic chat panel currently has `/plan` wired to a real planning agent (Anthropic SDK), but `/interview`, `/review`, and free-form chat all use `simulateAIResponse()` which returns hardcoded template strings. The empty state is minimal (icon + two lines of text). There is no project awareness or cross-project knowledge.

This epic replaces the mock responses with real streaming LLM calls, adds a smart project-aware empty state with dynamic starter prompts, and injects cross-project learnings into the chat context.

## Scope

**In scope:**
- New `epic-chat-agent.ts` module in main process with streaming Anthropic SDK calls
- New IPC channel(s) for epic chat streaming (send, status events, abort)
- Replace `simulateAIResponse()` with real IPC→agent calls for all command types
- Streaming rendering via existing `updateLastMessage` hook
- Stop/cancel button with AbortController
- Conversation history sent to LLM for multi-turn context
- Smart empty state with dynamic starters based on epic state
- Project context injection (learnings.md, .flow/memory/, project metadata)
- Cross-project knowledge from registered flow projects
- Error handling UI with retry affordance (rate limit, network, auth)
- Epic-switch mid-stream abort + cleanup

**Out of scope:**
- Tool use capability for chat agent (future enhancement)
- AISuggestionSidebar LLM upgrade (separate epic)
- Image/file attachments in chat (epic chat input should not render attachment buttons)
- Token usage display in chat UI
- `/plan` streaming upgrade (already works, different architecture)

## Approach

Follow the existing `planning-agent.ts` pattern for the new agent but add streaming. Use the app's credential manager (not raw env var) and the `DEFAULT_MODEL` constant from `packages/shared/src/config/models.ts` (not hardcoded model string). Single IPC channel with type discriminator for all chat commands. Renderer owns conversation history (IndexedDB), sends recent N messages over IPC per request.

### Architecture

```
Renderer (EpicChatPanel)              Main Process
┌──────────────────────┐    IPC     ┌──────────────────────┐
│ handleSend()         │───────────>│ FLOW_EPIC_CHAT_SEND  │
│                      │            │  ├─ epic-chat-agent   │
│ onChatStatus()       │<───────────│  │  ├─ buildPrompt()  │
│  ├─ text_delta       │  stream    │  │  ├─ getApiKey()    │
│  ├─ text_complete    │  events    │  │  └─ stream call    │
│  ├─ error            │            │  └─ webContents.send  │
│  └─ abort            │            └──────────────────────┘
│                      │    IPC     ┌──────────────────────┐
│ abortChat()          │───────────>│ FLOW_EPIC_CHAT_ABORT │
└──────────────────────┘            └──────────────────────┘
```

### Key decisions
- **Single channel with type field** (not per-command channels) — simpler, all commands share streaming infrastructure
- **Renderer owns history** — IndexedDB in renderer, sends last 20 messages over IPC. Main process is stateless per request
- **Streaming from V1** — `updateLastMessage` hook is already wired, streaming is essential for chat UX
- **Credential manager** — `import { getCredentialManager } from '@craft-agent/shared/credentials'` then `await getCredentialManager().getApiKey()`. NOT `new Anthropic()` with env var
- **DEFAULT_MODEL constant** — `import { DEFAULT_MODEL } from '@craft-agent/shared/config'` — not hardcoded model string
- **No tool use V1** — text-in/text-out, tools can be added later
- **Rule-based starters + LLM context** — empty state starters are rule-based (instant), but the agent's system prompt includes rich project context
- **Modular system prompt builder** — Task 1 creates `buildSystemPrompt()` with extension point for cross-project context (Task 4)
- **Error recovery** — on error, keep user message in history, show error bubble with retry button

## Quick commands

```bash
# Dev server
cd apps/electron && bun run dev

# Type check
cd apps/electron && bun run typecheck

# Verify IPC channels compile
cd apps/electron && bunx tsc --noEmit src/shared/types.ts
```

## Testing

Manual test checklist per command:
1. **Free-form**: Type "What is this epic about?" → verify real LLM response (not hardcoded template), verify streaming renders token-by-token
2. **/interview**: Type "/interview" → verify LLM generates context-aware questions about the epic
3. **/review**: Type "/review" → verify LLM analyzes epic spec and task state
4. **/plan**: Type "/plan" → verify still routes to existing planning agent (unchanged)
5. **Stop**: Start any command → click Stop → verify stream aborts, partial response preserved
6. **Epic switch**: Start a response → switch epics → verify stream aborted, no ghost messages
7. **Empty state**: Open chat on epic with no tasks → verify /plan and /interview starters shown
8. **Error**: Disconnect network → send message → verify error bubble with retry button
9. **Multi-turn**: Send follow-up question → verify LLM has context from previous messages

## Acceptance

- [ ] `/interview`, `/review`, and free-form chat return real LLM responses (not hardcoded)
- [ ] Responses stream token-by-token in the chat UI
- [ ] Stop button cancels in-flight LLM requests
- [ ] Switching epics aborts in-flight stream and cleans up
- [ ] Conversation history (last 20 messages) is sent to LLM for multi-turn context
- [ ] Empty chat shows project-aware starter prompts based on epic state
- [ ] Clicking a starter prompt sends the message
- [ ] System prompt includes epic spec, task state, project metadata, and learnings
- [ ] Cross-project learnings from registered projects are included in context
- [ ] Error states (rate limit, network, auth) show actionable UI with retry
- [ ] No API keys exposed in renderer process (verified: IPC payloads don't include credentials)
- [ ] TypeScript compiles with no errors

## References

- `apps/electron/src/main/lib/planning-agent.ts` — existing real agent pattern
- `apps/electron/src/renderer/components/tasks/EpicChatPanel.tsx:620-674` — `simulateAIResponse()` to replace
- `apps/electron/src/renderer/components/tasks/EpicChatHistory.tsx:266-279` — `updateLastMessage` for streaming
- `apps/electron/src/shared/types.ts:782-784` — existing IPC channel pattern
- `apps/electron/src/main/ipc.ts:2686-2726` — existing plan IPC handler
- `apps/electron/src/preload/index.ts:509-521` — existing preload bindings
- `packages/shared/src/agent/learnings.ts` — workspace learnings system
- `packages/shared/src/credentials/backends/secure-storage.ts` — credential manager
- `packages/shared/src/config/models.ts` — model configuration (DEFAULT_MODEL constant)
