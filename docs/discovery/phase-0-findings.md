# Phase 0: Discovery & Validation Findings

**Date:** 2026-02-01
**Status:** Go
**Repo:** `/Users/kevtrinh/Code/craft-agents-oss` (cloned from `lukilabs/craft-agents-oss`)

---

## Open Questions — Resolved

### 1. License: Apache 2.0 — Go

Fork, modify, and use commercially. Retain LICENSE and NOTICE files, mark modified files.

### 2. React 18 vs 19 — No blockers

| | Current app | Craft Agents |
|---|---|---|
| React | 19.2.0 | 18.3.1 |
| @types/react | 19.2.5 | 18.3.0 |

**Finding:** Our codebase uses zero React 19-specific features. No `use()`, `useFormStatus`, `useActionState`, `useOptimistic`, server actions, or ref-as-prop. All components use only `useState`, `useEffect`, `useRef`, `createRoot` — fully compatible with React 18. No code changes required.

### 3. Tailwind — Already aligned

Both repos are on **Tailwind v4** (`@tailwindcss/vite ^4.1.18`). No v3→v4 reconciliation needed, just token merging if we bring any design tokens over.

### 4. State management — Use pure Jotai

**Finding:** Craft Agents uses **Jotai exclusively**. Zero Zustand.

**Key patterns:**
- `atomFamily` for per-session isolation (prevents cross-session re-renders)
- Write-only action atoms for complex state updates (`updateSessionAtom`, `appendMessageAtom`)
- Async atoms with IPC integration (`ensureSessionMessagesLoadedAtom`)
- `sessionMetaMapAtom` as lightweight metadata (excludes messages to save memory)
- Direct `store.get()`/`store.set()` for non-React contexts (background task handlers)

**Decision:** Migrate handoff store to Jotai atoms. Keep the same shape (decisions, files, risks, frozenPayload) but use Jotai `atom()` + action atoms instead of Zustand `create()`. This avoids mixing two state libraries and follows their established patterns.

**Proposed atoms:**
```
handoffAtomFamily(sessionId) → { decisions, files, risks, brainstormSummary, frozenPayload }
updateHandoffAtom → write-only action atom
freezeHandoffAtom → write-only, sets frozenPayload
```

### 5. extractHandoff — Session-scoped tool (not MCP)

**Finding:** Craft Agents defines tools using the SDK's `tool()` function and registers them via `createSdkMcpServer()`. Existing session-scoped tools include SubmitPlan, config_validate, source_test, OAuth triggers, and mermaid_validate.

**Decision:** Implement `extractHandoff` as a session-scoped tool following the same pattern as `createSubmitPlanTool()`. This means:
- Defined in `packages/shared/src/agent/session-scoped-tools.ts`
- Registered via `getSessionScopedTools()`
- Uses Anthropic SDK directly (main process, no client-side key exposure)
- Agent can call it like any other tool

**Not MCP** — MCP tools are for external sources. Our extraction is internal to the planning workflow.

---

## Architecture Map

### Monorepo structure

```
craft-agents-oss/
├── apps/electron/src/
│   ├── main/           # Electron main process
│   │   ├── sessions.ts    # SessionManager (3773 lines) — agent orchestration
│   │   ├── ipc.ts         # IPC handlers (2491 lines)
│   │   ├── window-manager.ts
│   │   ├── index.ts       # App entry
│   │   └── ...
│   ├── preload/        # IPC bridge
│   ├── renderer/       # React UI
│   │   ├── atoms/         # Jotai state (sessions, sources, skills, overlay)
│   │   ├── components/
│   │   │   ├── app-shell/ChatDisplay.tsx  # Main chat renderer
│   │   │   └── chat/AuthRequestCard.tsx   # Precedent for our cards
│   │   ├── context/       # AppShellContext, NavigationContext
│   │   ├── event-processor/
│   │   │   ├── processor.ts    # Pure event→state transformer
│   │   │   └── handlers/       # Per-event-type handlers
│   │   └── hooks/
│   └── shared/types.ts    # SessionEvent, IPC_CHANNELS, SessionCommand
├── packages/core/src/types/
│   └── message.ts         # MessageRole, Message, AuthRequestType
├── packages/ui/src/components/chat/
│   └── turn-utils.ts      # groupMessagesByTurn, Turn types
└── packages/shared/src/agent/
    ├── craft-agent.ts     # CraftAgent class (3600+ lines)
    └── session-scoped-tools.ts  # Tool definitions (2009 lines)
```

### MessageRole type (packages/core/src/types/message.ts)

```typescript
export type MessageRole =
  | 'user' | 'assistant' | 'tool' | 'error'
  | 'status' | 'info' | 'warning' | 'plan'
  | 'auth-request'   // ← Our new roles go here
```

### Turn types (packages/ui/src/components/chat/turn-utils.ts)

```typescript
export type Turn = AssistantTurn | UserTurn | SystemTurn | AuthRequestTurn
```

Auth-request turns are **standalone** (not grouped with assistant turns). Our new turn types will follow the same pattern.

### Event flow

```
Main Process                    IPC                      Renderer
─────────────                   ───                      ────────
CraftAgent.chat()
  ↓ events
SessionManager.handleAgentEvent()
  ↓
window.webContents.send(        →  SESSION_EVENT  →      onSessionEvent()
  'session:event', event)                                  ↓
                                                         processEvent(state, event)
                                                           ↓
                                                         handleAuthRequest() / etc
                                                           ↓
                                                         atom updates → React re-render
                                                           ↓
                                                         ChatDisplay → AuthRequestCard
```

### auth-request precedent — The exact pattern we'll follow

1. **Type:** `MessageRole = 'auth-request'` with rich metadata fields on Message
2. **Event:** `SessionEvent = { type: 'auth_request'; message: CoreMessage; request: SharedAuthRequest }`
3. **Handler:** `handleAuthRequest()` in `event-processor/handlers/session.ts` — appends message, clears streaming
4. **Turn:** Standalone `AuthRequestTurn` — not grouped with assistant messages
5. **Render:** `ChatDisplay.tsx` line 1336 — renders `<MemoizedAuthRequestCard>` for auth-request turns
6. **Component:** `AuthRequestCard.tsx` — handles forms, OAuth, status states

### IPC channels (100+ typed, defined in shared/types.ts)

Key ones for our integration:
- `SESSION_EVENT` — main→renderer event stream (we'll add planning event types)
- `SEND_MESSAGE` — renderer→main message sending
- `SESSION_COMMAND` — consolidated session operations
- We'll add planning-specific commands to `SessionCommand` type

---

## Build verification

- `bun install` — 1351 packages, 27s
- `bun run electron:build` — All 5 stages pass (main, preload, renderer, resources, assets)
- `bun run typecheck:all` — Not tested yet (next step)

---

## Updated plan corrections

Based on discovery, the original brainstorm had some inaccuracies:

| Brainstorm assumption | Reality | Impact |
|---|---|---|
| Tailwind v3 vs v4 conflict | Both on v4 | Removes Phase 8 step 42 entirely |
| shadcn + Tailwind v3 | shadcn is present but with Tailwind v4 | Token merge is simpler |
| Zustand hybrid | Pure Jotai, no Zustand anywhere | Migrate handoff to Jotai atoms |
| Need custom IPC for planning | Can extend existing SessionEvent union + SessionCommand | Less IPC boilerplate |
| auth-request is in packages/core | auth-request type is in core, but rendering is in apps/electron | Integration touches fewer packages |

---

## Next steps

Phase 0 is complete. Ready to proceed with **Phase 1: Fork & Environment Setup** then directly into **Phase 2: Type System Foundation**.
