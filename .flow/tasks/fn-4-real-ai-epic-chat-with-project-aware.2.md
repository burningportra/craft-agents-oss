# fn-4-real-ai-epic-chat-with-project-aware.2 Wire Chat UI to Streaming Agent

## Description
Replace `simulateAIResponse()` in `EpicChatPanel.tsx` with real IPC calls to the new epic chat agent. Implement streaming rendering, stop button, conversation history management, epic-switch abort, error handling with retry, and auto-scroll behavior.

**Size:** M
**Files:**
- `apps/electron/src/renderer/components/tasks/EpicChatPanel.tsx` (major changes)
- `apps/electron/src/renderer/components/tasks/EpicChatHistory.tsx` (wire `updateLastMessage`)
- `apps/electron/src/renderer/components/tasks/ChatActionButtons.tsx` (minor: remove client-side system prompts)

## Approach

- Delete `simulateAIResponse()` function at `EpicChatPanel.tsx:620-674`
- In `handleSend()` at `EpicChatPanel.tsx:250-310`:
  - For ALL commands (interview, review, chat): call `window.electronAPI.flowEpicChatSend(workspaceRoot, epicId, commandType, message, history)` where `history` is the last 20 messages from `messages` state (truncate before sending over IPC)
  <!-- Updated by plan-sync: fn-4-real-ai-epic-chat-with-project-aware.1 uses separate parameters for workspaceRoot instead of object parameter -->
  - Remove the branching at L281-283 that only routes `/plan` to real IPC
  - Keep `/plan` routing to existing `FLOW_EPIC_PLAN` channel (don't change that)
  - Do NOT render attachment buttons in the epic chat input (unlike main session chat)
- Set up streaming listener: `window.electronAPI.onFlowEpicChatStatus((event) => { ... })` in `useEffect`, following the pattern at `EpicChatPanel.tsx:166-190` for plan status events
  - On `text_delta`: use a `useRef` to track accumulated content during streaming. Call `updateLastMessage(contentRef.current + event.text)` and update `contentRef.current`
  - On `text_complete`: call `setMessages((prev) => [...prev])` to trigger re-render with final content, then call `saveMessages()` in a `setTimeout(0)` to ensure state has flushed. Set `isProcessing(false)`
  - On `error`: keep user's message in history, add an assistant error message bubble with a "Retry" button. The retry button should re-send the same user message with the same history. Show actionable error info (e.g., "Rate limited — retry in 30s", "Check API key in Settings")
- **Stale closure fix**: Use `useRef` to track latest messages during streaming. In `saveMessages`, read from the ref instead of relying on closure. Alternatively, refactor `saveMessages` in `EpicChatHistory.tsx` to accept messages as a parameter: `saveMessages(messagesToSave)`.
- Add a "Stop" button visible during `isProcessing` — calls `window.electronAPI.flowEpicChatAbort(workspaceRoot, epicId)`. Apply `titlebar-no-drag` class if button is in the top 50px (per `.flow/memory/electron-titlebar-clickability.md`)
  <!-- Updated by plan-sync: fn-4-real-ai-epic-chat-with-project-aware.1 implementation requires workspaceRoot parameter -->
- Handle epic switching: in `useEffect` cleanup or when `epicId` changes, call abort if `isProcessing`
- Auto-scroll: only scroll to bottom when user is near bottom (within 100px). When user is scrolled up >100px and new messages arrive, show a "scroll to bottom" button in the bottom-right corner of the ScrollArea (small circular button with ChevronDown icon). Click scrolls to bottom.

## Key context

- `updateLastMessage` at `EpicChatHistory.tsx:266-279` is already wired but never called — this is the streaming hook
- `saveMessages` at `EpicChatHistory.tsx:280-285` captures `messages` state in closure — use useRef or pass messages parameter to avoid stale data
- `isProcessing` state at `EpicChatPanel.tsx:65` already disables input — extend it to show stop button
- The `StreamingMarkdown` component at `renderer/components/markdown/StreamingMarkdown.tsx` uses block-memoization for efficient streaming render — reuse it for chat message rendering
- `titlebar-no-drag` class must be applied to the stop button if it's in the top 50px (per `.flow/memory/electron-titlebar-clickability.md`)
- `FileAttachment` types exist at `types.ts:13-24` but should NOT be used in epic chat (out of scope)
## Approach

- Delete `simulateAIResponse()` function at `EpicChatPanel.tsx:620-674`
- In `handleSend()` at `EpicChatPanel.tsx:250-310`:
  - For ALL commands (interview, review, chat): call `window.electronAPI.flowEpicChatSend(workspaceRoot, epicId, commandType, message, history)` where `history` is the last 20 messages from `messages` state
  - Remove the branching at L281-283 that only routes `/plan` to real IPC
  - Keep `/plan` routing to existing `FLOW_EPIC_PLAN` channel (don't change that)
- Set up streaming listener: `window.electronAPI.onFlowEpicChatStatus((event) => { ... })` in `useEffect`, following the pattern at `EpicChatPanel.tsx:166-190` for plan status events
  - On `text_delta`: call `updateLastMessage(prevContent + event.text)` from `useEpicChatHistory`
  - On `text_complete`: call `saveMessages()`, set `isProcessing(false)`
  - On `error`: show error in chat as a special error message bubble with retry button
- Add a "Stop" button visible during `isProcessing` — calls `window.electronAPI.flowEpicChatAbort(workspaceRoot, epicId)`
- Handle epic switching: in `useEffect` cleanup or when `epicId` changes, call abort if `isProcessing`
- Auto-scroll: only scroll to bottom when user is near bottom (within 100px), show "scroll to bottom" indicator when new messages arrive and user is scrolled up
- Before sending history over IPC, truncate to last 20 messages to stay within token budget

## Key context

- `updateLastMessage` at `EpicChatHistory.tsx:266-279` is already wired but never called — this is the streaming hook
- `saveMessages` has a stale closure issue — it captures `messages` state. Call it AFTER the final `setMessages` that includes the completed assistant message, or use the `messages` ref pattern
- `isProcessing` state at `EpicChatPanel.tsx:65` already disables input — extend it to show stop button
- The `StreamingMarkdown` component at `renderer/components/markdown/StreamingMarkdown.tsx` uses block-memoization for efficient streaming render — reuse it for chat message rendering
- `titlebar-no-drag` class must be applied to the stop button if it's in the top 50px (per `.flow/memory/electron-titlebar-clickability.md`)
## Acceptance
- [ ] `simulateAIResponse()` function deleted from EpicChatPanel.tsx
- [ ] `/interview`, `/review`, and free-form messages route to real agent via `flowEpicChatSend`
- [ ] `/plan` still routes to existing `FLOW_EPIC_PLAN` channel (unchanged)
- [ ] Conversation history (last 20 messages) truncated in renderer before sending over IPC
- [ ] Streaming text renders token-by-token via `updateLastMessage` using useRef accumulation
- [ ] Stop button appears during processing and aborts the in-flight stream
- [ ] Switching epics aborts any in-flight stream for the previous epic
- [ ] Error states display as error message bubbles with retry button and actionable info
- [ ] User message preserved in history on error (retry re-sends same message)
- [ ] Auto-scroll only when user is near bottom; "scroll to bottom" button shown when scrolled up
- [ ] No stale closure issues with message persistence (useRef or parameter-based save)
- [ ] No attachment buttons rendered in epic chat input
- [ ] TypeScript compiles with no errors
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
