# Handoff Design Brainstorm

> **Date:** 2026-02-01
> **Status:** Complete
> **Parent plan:** plans/intelligent-planning-layer.md (Phase 6)

## What We're Building

A handoff system that bridges the brainstorm dialogue and the in-app plan agent. It extracts decisions, file references, and risks from brainstorm conversation, presents them on a review screen for user confirmation, and delivers them to the plan agent via a tool call.

## Why This Approach

### Stateful Handoff Store (Zustand)

A dedicated Zustand store (`useHandoffStore`) accumulates context throughout the brainstorm phase. At handoff time, AI extraction merges with user-pinned items. The plan agent pulls context on demand via a `getHandoffContext` tool.

**Chosen over alternatives:**
- **Message-derived payload** — simpler but can't persist user edits/pins and has extraction cost on every call.
- **Dual-layer (store + messages)** — most flexible but merge logic adds unnecessary complexity.

The stateful store is the single source of truth, naturally supports round-trips, and survives phase transitions.

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Consumer: in-app ToolLoopAgent** | Plan generation happens inside the Tauri app, not via CLI export |
| 2 | **Hybrid extraction** | AI proposes decisions at handoff, user confirms/edits on review screen before passing to plan agent |
| 3 | **Review screen UX** | Dedicated screen with editable cards showing decisions, files, risks — not inline or side panel |
| 4 | **Tool-based delivery** | Plan agent calls `getHandoffContext` tool to pull payload on demand — most agent-native pattern |
| 5 | **Round-trip capable** | Plan agent can send user back to brainstorm; handoff store accumulates across trips |
| 6 | **Zustand store as single source** | Accumulates during brainstorm, read at handoff, persists through round-trips |

## Handoff Payload Shape

```typescript
interface HandoffPayload {
  sessionId: string;
  projectPath: string;
  intent: {
    category: 'feature' | 'fix' | 'continue' | 'explore' | 'lost';
    description: string;
  };

  decisions: {
    id: string;
    content: string;
    source: 'ai-extracted' | 'user-pinned';
    confirmed: boolean;
  }[];

  filesReferenced: {
    path: string;
    relevance: 'high' | 'medium' | 'low';
    context: string; // why this file matters
  }[];

  risks: {
    id: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
  }[];

  brainstormSummary: string; // AI-generated digest of conversation
  turnCount: number;
  roundTripCount: number; // how many brainstorm<->plan cycles
}
```

## Handoff Flow

```
Brainstorm (useChat)
  │
  ├── During: AI extraction via onFinish populates store
  ├── During: User can pin decisions explicitly
  │
  ▼
Review Screen (reads useHandoffStore)
  │
  ├── Shows: decisions (editable), files, risks
  ├── Actions: confirm/edit/remove items
  │
  ▼
Plan Agent (ToolLoopAgent)
  │
  ├── Calls: getHandoffContext tool → reads store
  ├── Can: request more brainstorming → back to brainstorm
  │
  ▼
Plan Output
```

## Open Questions

1. How granular should decision extraction be? (per-message vs per-topic)
2. Should the review screen show the raw brainstorm messages alongside extracted items?
3. What triggers the plan agent to request a round-trip back to brainstorm?
4. How does the handoff store persist to SQLite for session resume?

## Related Files

- `src/App.jsx` — current opening state flow
- `plans/intelligent-planning-layer.md` — parent plan
- `docs/research/ai-sdk-integration.md` — useChat/ToolLoopAgent patterns
- `docs/research/conversation-persistence.md` — SQLite schema
