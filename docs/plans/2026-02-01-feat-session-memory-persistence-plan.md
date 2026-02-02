---
title: "feat: Session & memory persistence"
type: feat
date: 2026-02-01
deepened: 2026-02-01
---

# Session & Memory Persistence

## Enhancement Summary

**Deepened on:** 2026-02-01
**Research agents used:** architecture-strategist, performance-oracle, security-sentinel, code-simplicity-reviewer, Context7 (idb-keyval, Zustand, AI SDK)
**Institutional learnings applied:** 3 (partialize type safety, frozen snapshot rules, race condition guards)

### Key Changes from Deepening

1. **Replaced IndexedDB with localStorage** — eliminates async loading, the `idb-keyval` dependency, and the entire `useChat` mount timing problem
2. **Collapsed 6 phases into 3** — removed YAGNI phases (cross-tab, eviction policy, store versioning)
3. **Replaced resume modal with auto-resume** — simpler UX, fewer components
4. **Added `key={projectPath}` on PlanPhase** — critical bug prevention from architecture review
5. **Added throttle+debounce hybrid** for crash-safe streaming saves
6. **Tightened Zod schema** — max lengths on id/text, max array size, explicit role enum

### Review Agent Findings Incorporated

| Agent | Key Finding | Action |
|---|---|---|
| Architecture | Missing `key={projectPath}` causes stale `useChat` on project switch | Added to Phase 1 |
| Architecture | Extract `useSessionPersistence` hook | Added to Phase 1 |
| Architecture | Session schema needs version field for message format evolution | Added `schemaVersion: 1` |
| Performance | 300ms debounce never fires during streaming — use throttle hybrid | Changed save strategy |
| Performance | Preload session before PlanPhase mount to eliminate waterfall | Adopted (localStorage makes this synchronous) |
| Performance | Batch `hasSession` checks via `keys()` not per-card | N/A — cut the indicator feature |
| Security | Constrain Zod schema — max lengths, max array size | Added to schema spec |
| Security | Verify `useChat` rejects `system` role in initialMessages | Added to Phase 1 checklist |
| Security | `storage` event doesn't cover IndexedDB cross-tab | N/A — switched to localStorage |
| Simplicity | IndexedDB unnecessary — localStorage fits 25+ sessions | **Adopted** — major simplification |
| Simplicity | Resume modal overdesigned for v1 — auto-resume instead | **Adopted** |
| Simplicity | Cross-tab + eviction are YAGNI | **Cut** |

---

## Overview

Add session persistence so brainstorm conversations survive page refresh, users can resume where they left off, and the app supports multi-project workflows without data loss. This is foundational — Phases 4-7 all depend on having a persistence layer.

## Problem Statement

The app currently loses most state on page refresh:

| State | Survives refresh? |
|---|---|
| Handoff decisions/files/risks/summary | Yes (Zustand persist → localStorage) |
| Recent projects | Yes (manual localStorage) |
| Brainstorm chat messages | **No** (useChat React state) |
| Opening step (question/brainstorm/etc) | **No** (useState) |
| Selected project path | **No** (useState) |
| Active phase (plan/work/review/compound) | **No** (useState) |
| Frozen payload | **No** (excluded from partialize) |

Additionally, switching projects destroys all handoff data (`reset()` called unconditionally) because there's no project-scoping on the storage key.

## Proposed Solution

### Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Message storage | **localStorage** | 200KB per session × 25 sessions = 5MB, well within quota. Synchronous read eliminates async `useChat` mount timing issue. Zero dependencies. |
| Small state storage | **Zustand persist → localStorage** | Phase state, projectPath, activePhase are tiny. Keep existing pattern. |
| Session keying | **One session per `projectPath`** | Simplest model. Key: `compound-session:{projectPath}`. |
| Message serialization | **`{id, role, text}` flattened** | Flatten `parts` to single `text` string on serialize. No parts array needed — only text parts exist. Validate with Zod on deserialize. |
| Resume UX | **Auto-resume** | If session data exists for selected project, load it. "Clear session" button in brainstorm view for fresh start. |
| frozenPayload | **Persist it** | Remove from partialize exclusion. Re-derive from store if null but decisions exist. |

### Research Insights: Storage Choice

**Why localStorage over IndexedDB:**
- 5MB quota accommodates ~25 sessions of 200KB each — sufficient for a single-user dev tool
- Synchronous `JSON.parse` in `useState(() => ...)` initializer eliminates the async loading problem entirely
- No new dependency (`idb-keyval`) needed
- The original research doc recommended SQLite for production; localStorage is the right intermediate step before that

**When to upgrade to IndexedDB:**
- If sessions regularly exceed 500KB (100+ messages with long responses)
- If the app needs to store binary data (screenshots, files)
- If >50 concurrent projects are common

**AI SDK `useChat` `initialMessages` constraint** (from [Context7 docs](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)):
- `messages` prop (formerly `initialMessages`) is read on mount — must be available synchronously
- The `messages` prop accepts `UIMessage[]` with `id`, `role`, and `parts` array
- Restored messages must be converted to `UIMessage` format with `parts: [{ type: 'text', text }]`

**Zustand persist patterns** (from [Context7 docs](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)):
- `partialize` controls which state fields are persisted — use explicit typed return
- `version` + `migrate` handles schema evolution — add when needed, not preemptively
- `createJSONStorage` wraps custom storage adapters for async stores
- Custom `storage` object with `getItem`/`setItem`/`removeItem` for non-JSON types

### Storage layout

```
localStorage:
  "handoff-storage"            → Zustand persisted state (with projectPath field for scoping)
  "compound-recent-projects"   → Recent projects list (unchanged)
  "compound-app-state"         → { projectPath, activePhase }
  "compound-session:{path}"    → { schemaVersion, openingStep, messages: [{id, role, text}] }
```

### Institutional Learnings Applied

**From `p1-p2-review-findings-handoff-system.md`:**
- `partialize` must use explicit `PersistedState` type — no `Object.entries` erasure (P2-7)
- Frozen snapshot must be synced in same `set()` call as live state (P2-5) — relevant when persisting `frozenPayload`
- Dedup by content on merge operations (P2-4)

**From `p1-p2-review-findings-ai-sdk-brainstorm.md`:**
- Use `useRef` for synchronous guards, not `useState` (P1-2 extraction race condition) — same pattern applies to session save guards
- Cleanup `AbortController` on unmount (P2-5) — session save debounce timer needs same cleanup
- Depend on `messages.length` not `messages` for effects (P2-3) — save effect should use same approach

**From `parallel-code-review-resolve-pattern.md`:**
- `addDecision` must not mutate `frozenPayload` (P1) — persist code must respect this invariant

## Technical Approach

### New dependencies

None. localStorage only.

### New files

| File | Purpose |
|---|---|
| `src/lib/sessionStorage.ts` | localStorage session CRUD: `saveSession`, `loadSession`, `deleteSession` |
| `src/hooks/useSessionPersistence.ts` | Hook encapsulating load/save/debounce logic — keeps PlanPhase focused on rendering |
| `src/stores/appStore.ts` | Zustand store for app-level state: `projectPath`, `activePhase`. Persisted to localStorage. |

### Modified files

| File | Changes |
|---|---|
| `src/stores/handoffStore.ts` | Persist `frozenPayload`. Add `projectPath` field for scoping. |
| `src/components/PlanPhase.tsx` | Use `useSessionPersistence` hook. Accept `initialSession` prop. Add "Clear session" button. |
| `src/App.tsx` | Use `appStore` for `projectPath` and `activePhase`. Add `key={projectPath}` on PlanPhase. Auto-resume on project select. |
| `src/components/ProjectSelector.tsx` | No changes needed (cut session indicators for v1). |

### Implementation phases

#### Phase 1: Foundation + session storage + message persistence

This is the atomic unit — persistence is useless until wired end-to-end.

- [ ] Create `src/stores/appStore.ts` — Zustand store with persist middleware for `projectPath` and `activePhase`
  - Encode `activePhase` reset inside a `selectProject(path)` action (not component-level useEffect)
- [ ] Migrate `App.tsx` from `useState` to `appStore` for `projectPath` and `activePhase`
- [ ] Include `frozenPayload` in `partialize` (remove exclusion from `PersistedState`)
  - Apply `Object.freeze` in `onRehydrateStorage` to maintain readonly contract at runtime
- [ ] Create `src/lib/sessionStorage.ts` with localStorage CRUD:
  ```typescript
  const key = (path: string) => `compound-session:${path}`;

  interface SessionData {
    schemaVersion: 1;
    openingStep: string;
    messages: { id: string; role: 'user' | 'assistant'; text: string }[];
  }

  export function saveSession(path: string, data: SessionData): void
  export function loadSession(path: string): SessionData | null
  export function deleteSession(path: string): void
  ```
  - Zod schema for validation: `id: z.string().max(64)`, `role: z.enum(['user', 'assistant'])`, `text: z.string().max(100_000)`, `messages: z.array(...).max(500)`
  - On parse failure: return `null` (discard corrupted session entirely)
  - Wrap `setItem` in try/catch for `QuotaExceededError` — log warning to console
  - Filter out `role: 'system'` on load (defense against storage tampering — verified that `useChat` `messages` prop could accept system role)
- [ ] Create `src/hooks/useSessionPersistence.ts`:
  - On mount: synchronous `loadSession(projectPath)` via `useState` lazy initializer
  - On `messages` change: throttle-save at 2s during streaming + debounce-save at 300ms trailing
  - Flush immediately on unmount (cleanup return in useEffect)
  - Persist `openingStep` alongside messages
  - Serialize: flatten `parts` to single `text` string via `extractMessageText`
  - Deserialize: expand `text` back to `parts: [{ type: 'text', text }]` for `useChat` format
- [ ] Wire into `PlanPhase.tsx`:
  - Use `useSessionPersistence(projectPath)` hook
  - Pass restored messages as `messages` prop to `useChat({ transport, messages: initialMessages })`
  - No loading state needed — localStorage read is synchronous
  - Add "Clear session" button in brainstorm bottom bar
- [ ] **Critical:** Add `key={projectPath}` on `<PlanPhase />` in `App.tsx` to guarantee `useChat` remount on project switch
- [ ] On `handleBack` to question step or completing planning: call `deleteSession(projectPath)`
- [ ] Verify: refresh mid-brainstorm restores messages and openingStep

#### Phase 2: Project-scoped handoff store + auto-resume

- [ ] Add `projectPath` field to handoff store state
- [ ] In `selectProject(path)` action on appStore: if `projectPath` differs from current, call `handoffStore.reset()` then set new path
- [ ] Auto-resume: in `App.tsx` `handleProjectSelect`, call `loadSession(path)` — if data exists, proceed directly with it (no modal)
  - The `key={projectPath}` on PlanPhase guarantees fresh `useChat` with restored `initialMessages`
- [ ] Remove the unconditional `reset()` from `handleProjectSelect`
- [ ] Add `QuotaExceededError` handler to Zustand persist (custom storage adapter wrapping `localStorage`)
- [ ] Verify: project A's handoff data survives switching to B and back

#### Phase 3: Polish

- [ ] Add per-session message cap (200 messages) — truncate oldest on save if exceeded
- [ ] Add session size guard (2MB max) — truncate oldest messages if serialized size exceeds limit
- [ ] Verify `npx vite build` passes
- [ ] Verify no visual regressions

## Edge Cases and Risks

### useChat messages prop timing

**Problem:** `messages` prop (initialMessages) is only read on mount.

**Solution:** With localStorage, this is solved trivially — synchronous read in a `useState` lazy initializer provides data before first render. No loading state, no async gating.

```tsx
// In useSessionPersistence hook:
const [initialMessages] = useState(() => {
  const session = loadSession(projectPath);
  if (!session) return undefined;
  return session.messages.map(m => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: m.text }],
  }));
});
```

### Research Insight: `key={projectPath}` is mandatory

**Source:** Architecture review agent

When `projectPath` changes, React must fully remount `PlanPhase` so `useChat` reads new `initialMessages`. Without `key={projectPath}`, React reuses the component instance and `useChat` keeps stale messages from the previous project. This is a **real bug**, not a theoretical concern.

```tsx
// In App.tsx:
{activePhase === 0 && <PlanPhase key={projectPath} />}
```

### Agent context gap

After rehydration, `useChat` passes restored messages to the `DirectChatTransport` / `ToolLoopAgent`. The model sees the conversation history, but the agent's internal tool state is fresh. This is acceptable degradation — the model's context window contains enough information to continue coherently. Document this as a known limitation.

### React Strict Mode double-mount

`useState(() => createBrainstormTransport())` already handles single initialization. The `initialMessages` passed to `useChat` will be stable because it's derived from session state loaded synchronously before mount. No duplication risk.

### Streaming save strategy

**Problem:** During AI streaming, `messages` updates on every SSE chunk. A 300ms debounce resets on each chunk and never fires until streaming stops — no crash safety during long streams.

**Solution:** Throttle+debounce hybrid:

```typescript
// Throttle: saves at most once per 2s during streaming (crash safety)
// Debounce: catches the final save 300ms after streaming stops
const throttledSave = useRef(throttle(doSave, 2000, { leading: false, trailing: true }));
const debouncedSave = useRef(debounce(doSave, 300));

useEffect(() => {
  if (isStreaming) {
    throttledSave.current(projectPath, buildSessionData());
  } else {
    debouncedSave.current(projectPath, buildSessionData());
  }
  return () => {
    throttledSave.current.cancel();
    debouncedSave.current.cancel();
  };
}, [messages.length]); // Not [messages] — avoid chunk-level triggers

// Flush on unmount
useEffect(() => {
  return () => { debouncedSave.current.flush(); };
}, []);
```

### Storage migration

Existing `handoff-storage` in localStorage has no `version` field. When we add `projectPath` to the store, Zustand's rehydration will set it to `undefined`. The `selectProject` action handles this — if `projectPath` doesn't match, it resets. No explicit migration function needed for v1.

### Frozen payload persistence

`HandoffSnapshot` contains `readonly` arrays. JSON serialization strips `readonly`. After rehydration, the snapshot is mutable at runtime despite TypeScript types. Apply `Object.freeze` in `onRehydrateStorage` if the readonly contract matters at runtime.

### Security: restored message role validation

The Zod schema constrains `role` to `z.enum(['user', 'assistant'])`. This prevents storage tampering from injecting `system` role messages into the conversation. `loadSession` should additionally filter any messages that don't pass validation rather than rejecting the entire session.

## Acceptance Criteria

- [ ] Page refresh mid-brainstorm restores messages and openingStep
- [ ] Page refresh preserves selected project and active phase
- [ ] Switching projects and returning restores that project's session
- [ ] "Clear session" button in brainstorm view starts fresh
- [ ] frozenPayload survives refresh (planning phase works across refresh)
- [ ] No data loss on `QuotaExceededError` (graceful handling with console warning)
- [ ] Per-session message cap (200) prevents unbounded growth
- [ ] `npx vite build` passes
- [ ] Visual output identical to current state (no UI regressions)

## Dependencies

None. localStorage only — zero new packages.

## What Was Cut (and Why)

| Cut Item | Original Phase | Reason |
|---|---|---|
| `idb-keyval` dependency | B | localStorage sufficient for single-user dev tool |
| Resume/Start Fresh modal | D | Auto-resume is simpler; "Clear session" button covers fresh start |
| Session indicators on project cards | D | YAGNI for v1 — adds `hasSession` checks and UI complexity |
| Cross-tab `storage` event listener | F | YAGNI — single-user dev tool |
| Session eviction policy | F | 25 sessions fit in localStorage; catch QuotaExceeded is enough |
| Store `version: 1` + `migrate` | A | Premature — add when schema actually changes |
| `hasSession()` / `listSessionKeys()` API | B | Only needed for cut modal/indicators |
| `lastUpdatedAt` / `createdAt` fields | B | Only needed for cut modal display text |

## References

- Conversation persistence research: `docs/research/conversation-persistence.md`
- Roadmap: `plans/intelligent-planning-layer.md` Phase 3
- AI SDK useChat message persistence: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- AI SDK useChat reference: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- Zustand persist middleware: https://zustand.docs.pmnd.rs/integrations/persisting-store-data
- idb-keyval custom stores (deferred): https://github.com/jakearchibald/idb-keyval/blob/main/custom-stores.md
- Institutional learnings: `docs/solutions/code-quality/p1-p2-review-findings-handoff-system.md`
- Institutional learnings: `docs/solutions/code-quality/p1-p2-review-findings-ai-sdk-brainstorm.md`
- Institutional learnings: `docs/solutions/code-quality/parallel-code-review-resolve-pattern.md`
