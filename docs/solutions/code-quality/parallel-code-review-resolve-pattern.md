---
title: "Parallel multi-agent code review and resolution pattern"
category: code-quality
tags: [code-review, parallel-agents, tailwind, react, zustand, typescript]
module: compound-engineering-ui
date: 2026-02-01
symptoms:
  - Large PR with 160+ inline style migrations needs comprehensive review
  - Multiple concern domains (security, architecture, performance, types, patterns, simplicity)
  - 16 findings across P1-P3 severity need resolution without serial bottleneck
---

# Parallel multi-agent code review and resolution pattern

## Problem

A 2300+ line PR (21 files, AI SDK brainstorm + Tailwind v4 migration) needed exhaustive review across 6 domains, then all findings resolved and committed. Serial review + serial resolution would be prohibitively slow.

## Solution

### Phase 1: Parallel review (6 agents simultaneously)

Launched all review agents in a single message:

1. `security-sentinel` — API key exposure, XSS, localStorage trust
2. `architecture-strategist` — component structure, state coherence, data flow
3. `performance-oracle` — re-renders, bundle size, scroll behavior
4. `code-simplicity-reviewer` — dead code, redundant state, YAGNI
5. `pattern-recognition-specialist` — consistency, button variants, radius vocabulary
6. `kieran-typescript-reviewer` — type safety, `any` usage, return types

### Phase 2: Synthesize and deduplicate

Agents returned overlapping findings (e.g., 4 agents flagged duplicate Anthropic client). Deduplication reduced raw findings to 16 unique issues with proper severity:

- **P1 (4):** Frozen payload mutation, store leak on project switch, extraction race condition, invalid CSS variable
- **P2 (7):** Shared client, localStorage validation, hoveredCard CSS migration, error banner tokens, redundant disabled overrides, unsafe `any`, useMemo→useState
- **P3 (5):** Unused imports, unused CSS classes, radius vocabulary, ARIA semantics, type=button

### Phase 3: Dependency-aware parallel resolution

Analyzed cross-file dependencies to determine execution order:

- **Wave 1 (blocking):** Extract shared Anthropic client (005) — changes imports that other todos also touch
- **Wave 2 (all remaining 15 in parallel):** No remaining cross-dependencies after wave 1

Each todo resolved by a `pr-comment-resolver` agent with precise instructions.

### Phase 4: Verify and commit

Single `vite build` verification, then one atomic commit with all 16 fixes.

## Key findings resolved

### P1: Frozen payload mutation (handoffStore)
`addDecision` was mutating `frozenPayload` after `freezeForPlanning()`, breaking the immutability contract. Fix: remove the frozen sync from `addDecision`.

### P1: Store leak on project switch
Switching projects didn't reset the handoff store. Decisions from project A leaked into project B. Fix: `useHandoffStore.getState().reset()` in `handleProjectSelect`.

### P1: Extraction race condition
`handleReadyToPlan` used `useState` for `isExtracting` guard — async batching allowed rapid double-clicks through. Fix: `useRef` for synchronous guard, derive UI state from `openingStep`.

### P1: Invalid CSS variable
Risk border used `var(--color-sentiment-tertiary)` which doesn't exist. Fix: lookup map with correct token `var(--color-content-tertiary)` for low severity.

### P2: hoveredCard → CSS group-hover
ProjectSelector still used JS state for hover effects despite the Tailwind migration. Fix: CSS custom properties (`--accent-bg`) + `group-hover:` utilities. Zero re-renders on hover.

## Prevention

1. **Zustand frozen snapshots:** After calling a freeze/snapshot method, grep for any action that modifies the frozen field. Frozen means sealed.
2. **State reset on context switch:** Any time a selector/picker changes the active entity, audit all stores for stale state.
3. **Race guards on async actions:** Use `useRef` for synchronous guards, not `useState`. React batches state updates.
4. **CSS variable construction:** Never interpolate token names with template literals. Use explicit lookup maps — catches typos at write time.
5. **Tailwind migration completeness:** After migrating to Tailwind, grep for remaining `onMouseEnter`/`onMouseLeave` + `useState` hover patterns. All should be CSS `hover:` or `group-hover:`.

## Metrics

- **Review:** 6 agents, ~2 min wall clock (parallel)
- **Resolution:** 16 agents (1 serial + 15 parallel), ~3 min wall clock
- **Net code change:** -81 lines (87 insertions, 168 deletions)
- **Bundle:** 579.6KB (unchanged)
