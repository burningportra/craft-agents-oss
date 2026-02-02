---
title: "Fix P1+P2 Code Review Findings in AI SDK Brainstorm Integration"
category: code-quality
tags: [ai-sdk, useChat, error-handling, dead-code, auto-scroll, abort-controller, message-extraction, security]
module: brainstorm-chat
symptom: "PR review identified 7 issues: client-side API key without warning, no error feedback on extraction failure, dead code (researchMode, completePlanning, buildPlanAgentSystemPrompt, exported createBrainstormAgent), duplicated message text extraction (3x), auto-scroll firing every streaming chunk, unsafe error cast, missing unmount cleanup"
root_cause: "Rapid prototyping left scaffolding code in place, extraction error path returned silently to brainstorm step without user feedback, and message text extraction was inlined at each call site"
date: 2026-02-01
severity: high
---

# Fix P1+P2 Code Review Findings in AI SDK Brainstorm Integration

## Context

After wiring real AI SDK chat (`useChat` + `DirectChatTransport`) into PlanPhase and replacing all mocked scanning/narrative, a 6-agent parallel review (security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle, pattern-recognition-specialist, kieran-typescript-reviewer) identified 2 P1 and 5 P2 issues.

## Solution

### P1-1: Client-Side API Key Without Security Warning

`brainstormAgent.ts` uses `VITE_ANTHROPIC_API_KEY` which Vite bundles into client JS. No documentation warned about this.

**Fix:** Added JSDoc security warning and made `createBrainstormAgent` private (not exported):

```typescript
/**
 * ⚠️ SECURITY: The API key is bundled into the client JS by Vite.
 * This is acceptable for local prototyping but MUST be replaced with a
 * backend proxy before any public deployment.
 */

// Private — only createBrainstormTransport is exported
function createBrainstormAgent() { ... }
```

### P1-2: No Error Feedback on Extraction Failure

When `extractHandoff` threw (non-abort), the catch block logged to console and silently returned to brainstorm step. User had no idea extraction failed.

**Fix:** Added `extractionError` state and a dismissable inline error banner:

```typescript
const [extractionError, setExtractionError] = useState<string | null>(null);

// In catch:
setExtractionError(err instanceof Error ? err.message : 'Extraction failed');

// Rendered as red banner above chat when non-null
```

### P2-1: Dead Code Removal

Four pieces of dead code from scaffolding:

| Dead Code | Location | Reason |
|-----------|----------|--------|
| `researchMode` state + UI | PlanPhase.tsx | Feature not wired to anything |
| `completePlanning` tool | handoffTools.ts | Plan agent not implemented yet |
| `buildPlanAgentSystemPrompt` | handoffTools.ts | Same — plan agent pending |
| `createBrainstormAgent` export | brainstormAgent.ts | Only used internally |

**Fix:** Removed all four. `handoffTools.ts` went from 3 tools to 2. PlanPhase lost the research mode pill selector.

### P2-2: Duplicated Message Text Extraction

`.parts?.filter(p => p.type === 'text').map(p => p.text).join('')` appeared 3 times in PlanPhase.

**Fix:** Extracted `extractMessageText` utility at module scope:

```typescript
type TextPart = { type: 'text'; text: string };

function extractMessageText(parts: unknown[] | undefined): string {
  return (parts?.filter((p): p is TextPart => (p as TextPart).type === 'text') ?? [])
    .map((p) => p.text)
    .join('');
}
```

All 3 call sites now use this helper.

### P2-3: Auto-Scroll on Every Streaming Chunk

`useEffect` depended on `[messages]` — the array reference changes on every streaming token, causing continuous scroll-into-view calls.

**Fix:** Depend on `[messages.length]` instead — scrolls only when a new message arrives, not on each chunk.

### P2-4: Unsafe Error Cast

`(err as Error).name !== 'AbortError'` would throw if `err` wasn't an Error object.

**Fix:** `err instanceof Error && err.name === 'AbortError'` with early return.

### P2-5: Missing Unmount Cleanup for AbortController

If the component unmounted during extraction, the abort controller was never called, leaving the `generateObject` call dangling.

**Fix:** Added cleanup effect:

```typescript
useEffect(() => {
  return () => { extractAbortRef.current?.abort(); };
}, []);
```

## Prevention

| Issue | Rule | Detection |
|-------|------|-----------|
| Client-side secrets | All client-bundled secrets need JSDoc security warning | Grep for `VITE_` in non-.env files |
| Silent error paths | Every catch block must surface feedback to user | Review: no catch blocks that only `console.error` |
| Dead code | Remove scaffolding before PR; don't commit "coming soon" code | `eslint no-unused-vars`, review for unreachable exports |
| Duplicated logic | Extract helper when pattern appears 2+ times | Review: grep for repeated `.filter().map()` chains |
| Scroll performance | Never depend on mutable array refs in useEffect deps | Depend on `.length` or use `useRef` for last-seen count |
| Unsafe casts | Use `instanceof` before accessing type-specific properties | `@typescript-eslint/no-unsafe-member-access` |
| Unmount cleanup | All AbortControllers/timers must clean up on unmount | Review: every `useRef<AbortController>` needs cleanup effect |

## References

- PR: https://github.com/burningportra/compound-engineering-ui/pull/2
- Previous review (PR #1): `docs/solutions/code-quality/p1-p2-review-findings-handoff-system.md`
- Plan: `docs/plans/2026-02-01-feat-handoff-system-plan.md`
- Brainstorm: `docs/brainstorms/2026-02-01-handoff-design-brainstorm.md`
- AI SDK research: `docs/research/ai-sdk-integration.md`
