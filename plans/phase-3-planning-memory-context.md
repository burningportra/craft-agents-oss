---
title: "feat: Phase 3 - Planning Memory & Context"
type: feat
date: 2026-02-02
status: planned
---

# Phase 3: Planning Memory & Context

## Overview

Enhance the planning workflow with persistent memory and contextual learning extraction. When users complete planning handoff reviews, automatically extract structured knowledge (decisions, file scopes, risks) and make it available for future planning sessions. This creates a compounding knowledge layer that improves planning quality over time.

**Core Goal:** Make planning sessions resumable and learnings actionable.

## Problem Statement

The current planning workflow creates rich structured data through handoff reviews (decisions with confidence scores, file scopes with reasons, risks with mitigations), but this knowledge is lost after the session:

| Current State | Issue |
|---|---|
| Handoff review messages exist | Not extracted into learnings |
| `learnings.ts` uses heuristics | Misses structured planning data (decisions/risks) |
| System prompt includes learnings | Only shows file modifications and error fixes |
| No relationship tracking | Can't query "what decisions affected which files?" |
| Planning sessions aren't resumable | Context resets on new session |

**Example of Lost Knowledge:**

A handoff review might contain:
- **Decision:** "Use JWT tokens" (high confidence)
- **File:** `src/auth/jwt.ts` - JWT token generation
- **Risk:** Security - Token exposure in localStorage → Mitigation: Use httpOnly cookies

Currently, only "Modified files: src/auth/jwt.ts" would be captured. The decision rationale, risk assessment, and file-to-decision relationships are discarded.

## Proposed Solution

### Three-Part Enhancement

#### 1. Enhanced Learning Extraction from Handoffs
Extract structured knowledge from `handoff-review` messages and append to workspace learnings with proper categorization (decisions, scopes, risks).

#### 2. Relationship Graph Storage
Store decision→file→risk relationships in workspace-scoped JSON for querying and context injection.

#### 3. Planning Context Injection
Inject relevant decisions, relationships, and risks into system prompts for future planning sessions.

### Why This Matters

**Compounding Knowledge:**
- Session 1: "Use JWT for auth" → Stored as decision
- Session 2 (weeks later): "Add OAuth login" → System prompt includes: "Previous decision: Use JWT tokens (high confidence). Files: src/auth/jwt.ts"
- Agent builds on existing architecture instead of proposing conflicting approaches

**Traceability:**
- Query: "What decisions affected auth.ts?"
- Answer: JWT token decision, httpOnly cookie decision, refresh token rotation decision

## Technical Approach

### Task 1: Enhanced Learning Extraction from Handoffs

**File:** `packages/shared/src/agent/learnings.ts`

**New Function:**
```typescript
/**
 * Extract learnings from handoff review payloads.
 * Converts decisions/files/risks into structured learning entries.
 */
export function extractLearningsFromHandoff(
  handoffPayload: {
    decisions?: Array<{ id: string; content: string; confidence: 'high' | 'medium' | 'low' }>;
    files?: Array<{ path: string; reason: string }>;
    risks?: Array<{ category: string; description: string; mitigation: string }>;
  }
): string[] {
  const learnings: string[] = [];

  // Extract high/medium confidence decisions (skip low confidence)
  for (const decision of handoffPayload.decisions || []) {
    if (decision.confidence !== 'low') {
      learnings.push(`Decision (${decision.confidence}): ${decision.content}`);
    }
  }

  // Extract file scopes with reasons
  for (const file of handoffPayload.files || []) {
    learnings.push(`Scope: ${file.path} — ${file.reason}`);
  }

  // Extract risks with mitigations
  for (const risk of handoffPayload.risks || []) {
    learnings.push(`Risk (${risk.category}): ${risk.mitigation}`);
  }

  return learnings;
}
```

**Modified Function: `distillLearnings`**

Add two new sections to the distilled output:

```typescript
export function distillLearnings(workspaceRootPath: string): string {
  const raw = readLearnings(workspaceRootPath);
  if (!raw || raw.trim() === '# Learnings') return '';

  const lines = raw.split('\n').filter(l => l.startsWith('- '));
  if (lines.length === 0) return '';

  const fixes: string[] = [];
  const decisions: string[] = [];
  const risks: string[] = [];
  const fileGroups = new Map<string, number>();

  for (const line of lines) {
    const content = line.replace(/^- \[\d{4}-\d{2}-\d{2}\]\s*/, '');

    if (content.startsWith('Fixed:')) {
      fixes.push(content.replace('Fixed: ', '').trim());
    } else if (content.startsWith('Decision')) {
      decisions.push(content);
    } else if (content.startsWith('Risk')) {
      risks.push(content);
    } else if (content.startsWith('Modified files:') || content.startsWith('Scope:')) {
      // Extract file paths...
    }
  }

  const sections: string[] = [];

  // Existing sections
  if (hotFiles.length > 0) {
    sections.push('### Frequently Modified Files\n' + /* ... */);
  }

  if (fixes.length > 0) {
    sections.push('### Gotchas & Fixes\n' + /* ... */);
  }

  // NEW: Key Decisions section
  if (decisions.length > 0) {
    const unique = [...new Set(decisions)].slice(0, 10);
    sections.push('### Key Decisions\n' + unique.map(d => `- ${d}`).join('\n'));
  }

  // NEW: Known Risks section
  if (risks.length > 0) {
    const unique = [...new Set(risks)].slice(0, 10);
    sections.push('### Known Risks\n' + unique.map(r => `- ${r}`).join('\n'));
  }

  return sections.join('\n\n');
}
```

**Wire-up in `apps/electron/src/main/sessions.ts`:**

Modify the `onTurnComplete` callback (currently at line 1686-1691):

```typescript
managed.agent.onTurnComplete = async (messages) => {
  // Existing heuristic extraction
  const learnings = extractLearningsFromMessages(messages);
  if (learnings.length > 0) {
    appendLearnings(managed.workspace.rootPath, learnings);
    sessionLog.info(`Extracted ${learnings.length} learnings for session ${managed.id}`);
  }

  // NEW: Extract from handoff reviews
  const handoffMessages = messages.filter(m => m.role === 'handoff-review');
  for (const msg of handoffMessages) {
    if (msg.handoffPayload) {
      const handoffLearnings = extractLearningsFromHandoff(msg.handoffPayload);
      if (handoffLearnings.length > 0) {
        appendLearnings(managed.workspace.rootPath, handoffLearnings);
        sessionLog.info(`Extracted ${handoffLearnings.length} handoff learnings for session ${managed.id}`);
      }
    }
  }
};
```

**Import Changes:**
```typescript
import { extractLearningsFromMessages, appendLearnings, extractLearningsFromHandoff } from '@craft-agent/shared/agent/learnings'
```

---

### Task 2: Relationship Graph Storage

**New File:** `packages/shared/src/agent/relationships.ts`

```typescript
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { debug } from '../utils/debug.ts';

/**
 * Relationship types for decision/file/risk graph
 */
export type RelationshipType = 'decision_file' | 'file_risk' | 'decision_risk';

/**
 * Relationship entry linking decisions, files, and risks
 */
export interface Relationship {
  type: RelationshipType;
  source: string;       // Decision ID or file path
  target: string;       // File path or risk category
  label?: string;       // Optional relationship description
  sessionId: string;    // Session that created this relationship
  createdAt: string;    // ISO timestamp
}

/** Max relationships to keep (FIFO eviction) */
const MAX_RELATIONSHIPS = 500;

/**
 * Get the path to the workspace relationships file.
 */
export function getRelationshipsPath(workspaceRootPath: string): string {
  return join(workspaceRootPath, 'relationships.json');
}

/**
 * Read all relationships from workspace file.
 * Returns empty array if file doesn't exist.
 */
export function readRelationships(workspaceRootPath: string): Relationship[] {
  const path = getRelationshipsPath(workspaceRootPath);
  try {
    if (!existsSync(path)) return [];
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    debug('[relationships] Failed to read relationships:', error);
    return [];
  }
}

/**
 * Append new relationships to workspace file.
 * Enforces max size via FIFO eviction.
 */
export function appendRelationships(
  workspaceRootPath: string,
  newRelationships: Relationship[]
): void {
  if (newRelationships.length === 0) return;

  const path = getRelationshipsPath(workspaceRootPath);
  try {
    const existing = readRelationships(workspaceRootPath);
    const combined = [...existing, ...newRelationships];

    // Enforce max size (FIFO eviction)
    const kept = combined.slice(-MAX_RELATIONSHIPS);

    writeFileSync(path, JSON.stringify(kept, null, 2), 'utf-8');
    debug(`[relationships] Appended ${newRelationships.length} relationships (total: ${kept.length})`);
  } catch (error) {
    debug('[relationships] Failed to append relationships:', error);
  }
}

/**
 * Query relationships by filters.
 */
export function queryRelationships(
  workspaceRootPath: string,
  filters: { type?: RelationshipType; source?: string; target?: string }
): Relationship[] {
  const all = readRelationships(workspaceRootPath);
  return all.filter(rel => {
    if (filters.type && rel.type !== filters.type) return false;
    if (filters.source && rel.source !== filters.source) return false;
    if (filters.target && rel.target !== filters.target) return false;
    return true;
  });
}

/**
 * Extract relationships from handoff payload.
 * Creates decision→file and file→risk edges.
 */
export function extractRelationshipsFromHandoff(
  handoffPayload: {
    decisions?: Array<{ id: string; content: string; confidence: string }>;
    files?: Array<{ path: string; reason: string }>;
    risks?: Array<{ category: string; description: string }>;
  },
  sessionId: string
): Relationship[] {
  const relationships: Relationship[] = [];
  const timestamp = new Date().toISOString();

  const decisions = handoffPayload.decisions || [];
  const files = handoffPayload.files || [];
  const risks = handoffPayload.risks || [];

  // Create decision→file relationships
  for (const decision of decisions) {
    for (const file of files) {
      relationships.push({
        type: 'decision_file',
        source: decision.id,
        target: file.path,
        label: decision.content,
        sessionId,
        createdAt: timestamp,
      });
    }
  }

  // Create file→risk relationships
  for (const file of files) {
    for (const risk of risks) {
      relationships.push({
        type: 'file_risk',
        source: file.path,
        target: risk.category,
        label: risk.description,
        sessionId,
        createdAt: timestamp,
      });
    }
  }

  return relationships;
}
```

**Wire-up in `apps/electron/src/main/sessions.ts`:**

Modify `onTurnComplete` to also extract relationships:

```typescript
import { appendRelationships, extractRelationshipsFromHandoff } from '@craft-agent/shared/agent/relationships'

managed.agent.onTurnComplete = async (messages) => {
  // ... existing learning extraction ...

  // NEW: Extract relationships from handoff reviews
  const handoffMessages = messages.filter(m => m.role === 'handoff-review');
  for (const msg of handoffMessages) {
    if (msg.handoffPayload) {
      const relationships = extractRelationshipsFromHandoff(msg.handoffPayload, managed.id);
      if (relationships.length > 0) {
        appendRelationships(managed.workspace.rootPath, relationships);
        sessionLog.info(`Extracted ${relationships.length} relationships for session ${managed.id}`);
      }
    }
  }
};
```

---

### Task 3: Planning Context Injection

**File:** `packages/shared/src/prompts/system.ts`

**Modify `getSystemPrompt()` function (currently at lines 307-342):**

Add relationship context injection alongside learnings:

```typescript
export function getSystemPrompt(options: SystemPromptOptions): string {
  const { workspaceRootPath, /* ... other options ... */ } = options;

  // ... existing code ...

  // Existing learnings injection (line 327-331)
  const distilled = workspaceRootPath ? distillLearnings(workspaceRootPath) : '';
  const learningsContext = distilled
    ? `\n\n## Workspace Learnings\n\nPatterns observed from previous sessions in this workspace:\n\n${distilled}\n`
    : '';

  // NEW: Relationship context injection
  const relationshipsContext = workspaceRootPath ? buildRelationshipsContext(workspaceRootPath) : '';

  // Update final prompt assembly (line 337)
  const fullPrompt = `${basePrompt}${preferences}${debugContext}${projectContextFiles}${learningsContext}${relationshipsContext}`;

  return fullPrompt;
}
```

**New Helper Function:**

```typescript
import { readRelationships, type Relationship } from '../agent/relationships.ts';

/**
 * Build relationships context for system prompt.
 * Shows recent decision→file and file→risk links.
 */
function buildRelationshipsContext(workspaceRootPath: string): string {
  const relationships = readRelationships(workspaceRootPath);
  if (relationships.length === 0) return '';

  // Get last 20 relationships (most recent)
  const recent = relationships.slice(-20);

  // Group by type
  const byType = {
    decision_file: recent.filter(r => r.type === 'decision_file'),
    file_risk: recent.filter(r => r.type === 'file_risk'),
  };

  const sections: string[] = [];

  if (byType.decision_file.length > 0) {
    sections.push('### Decisions → Files\n' +
      byType.decision_file.map(r =>
        `- \`${r.target}\` — ${r.label || 'Related to decision'}`
      ).join('\n')
    );
  }

  if (byType.file_risk.length > 0) {
    sections.push('### Files → Risks\n' +
      byType.file_risk.map(r =>
        `- \`${r.source}\` has risk: ${r.label || r.target}`
      ).join('\n')
    );
  }

  if (sections.length === 0) return '';

  return `\n\n## Known Relationships\n\n${sections.join('\n\n')}\n`;
}
```

---

## Implementation Phases

### Phase 1: Enhanced Learning Extraction (2-3 hours)
- [ ] Add `extractLearningsFromHandoff()` function to `learnings.ts`
- [ ] Modify `distillLearnings()` to add Decisions and Risks sections
- [ ] Wire into `sessions.ts` `onTurnComplete` callback
- [ ] Add unit tests for extraction logic
- [ ] Manual test: Create handoff review, verify learnings.md updated

### Phase 2: Relationship Graph (2-3 hours)
- [ ] Create `packages/shared/src/agent/relationships.ts`
- [ ] Implement read/write/query functions with FIFO eviction
- [ ] Add `extractRelationshipsFromHandoff()` function
- [ ] Wire into `sessions.ts` alongside learning extraction
- [ ] Add unit tests for relationship storage
- [ ] Manual test: Create handoff, verify relationships.json created

### Phase 3: Context Injection (1-2 hours)
- [ ] Add `buildRelationshipsContext()` helper to `system.ts`
- [ ] Modify `getSystemPrompt()` to include relationships
- [ ] Test prompt size (ensure within limits)
- [ ] Manual test: Start new planning session, verify relationships in context
- [ ] Verify learnings and relationships don't duplicate

### Phase 4: Integration Testing & Polish (1 hour)
- [ ] Type-check all changes
- [ ] Run existing test suite
- [ ] End-to-end test: Handoff → Extract → New session → Context includes learnings
- [ ] Verify no regressions in planning workflow
- [ ] Document new files in AGENTS.md

**Total Estimated Time:** 6-9 hours

---

## Storage Format Examples

### learnings.md (Enhanced)
```markdown
# Learnings

- [2026-02-02] Decision (high): Use JWT tokens for authentication
- [2026-02-02] Scope: src/auth/jwt.ts — JWT token generation and validation
- [2026-02-02] Scope: src/middleware/auth.ts — Authentication middleware
- [2026-02-02] Risk (Security): Use httpOnly cookies instead of localStorage
- [2026-02-02] Modified files: src/auth/jwt.ts, src/middleware/auth.ts
- [2026-02-02] Fixed: Token expiration not checked on every request
```

### relationships.json
```json
[
  {
    "type": "decision_file",
    "source": "dec-abc123",
    "target": "src/auth/jwt.ts",
    "label": "Use JWT tokens for authentication",
    "sessionId": "260202-happy-tree",
    "createdAt": "2026-02-02T18:30:00.000Z"
  },
  {
    "type": "file_risk",
    "source": "src/auth/jwt.ts",
    "target": "Security",
    "label": "Token exposure in localStorage",
    "sessionId": "260202-happy-tree",
    "createdAt": "2026-02-02T18:30:00.000Z"
  }
]
```

### System Prompt (After Injection)
```
## Workspace Learnings

Patterns observed from previous sessions in this workspace:

### Frequently Modified Files
- `src/auth/jwt.ts` (3x)
- `src/middleware/auth.ts` (2x)

### Gotchas & Fixes
- Token expiration not checked on every request

### Key Decisions
- Decision (high): Use JWT tokens for authentication
- Decision (medium): Store refresh tokens in httpOnly cookies

### Known Risks
- Risk (Security): Use httpOnly cookies instead of localStorage

## Known Relationships

### Decisions → Files
- `src/auth/jwt.ts` — Use JWT tokens for authentication
- `src/middleware/auth.ts` — Use JWT tokens for authentication

### Files → Risks
- `src/auth/jwt.ts` has risk: Token exposure in localStorage
```

---

## Edge Cases & Risks

### 1. Handoff Payload Missing Fields
**Risk:** `handoffPayload.decisions` could be undefined or empty

**Mitigation:** Use optional chaining (`handoffPayload.decisions || []`) in extraction functions

### 2. Duplicate Relationships
**Risk:** Same decision→file edge created multiple times

**Mitigation:** Accept duplicates for now (FIFO eviction handles growth). Future: Add deduplication by `(type, source, target)` tuple.

### 3. Relationship Storage Growth
**Risk:** `relationships.json` grows unbounded

**Mitigation:** Enforce `MAX_RELATIONSHIPS = 500` with FIFO eviction. At ~200 bytes per relationship, max file size is ~100KB.

### 4. Prompt Size Bloat
**Risk:** Injecting all relationships exceeds token limits

**Mitigation:** Only include last 20 relationships (~2KB text). Monitor prompt size in logs.

### 5. Schema Evolution
**Risk:** Relationship structure changes, breaking existing files

**Mitigation:** Add schema version field for future migrations. For v1, accept risk (worst case: delete relationships.json and rebuild).

### 6. Session ID Reference Integrity
**Risk:** Relationship references session that's been deleted

**Mitigation:** Accept stale references for v1 (relationships are for context, not strict FK constraints). Future: Add cleanup on session delete.

---

## Success Criteria

- [ ] Handoff reviews automatically extract decisions/scopes/risks to `learnings.md`
- [ ] New sections appear in distilled learnings: "Key Decisions", "Known Risks"
- [ ] `relationships.json` created with decision→file and file→risk edges
- [ ] System prompts include "Known Relationships" section
- [ ] New planning sessions have context from previous handoffs
- [ ] Type checks pass
- [ ] Existing tests pass
- [ ] No regressions in planning workflow UI
- [ ] File sizes stay under limits (learnings.md < 8KB, relationships.json < 100KB)

---

## Future Enhancements (Out of Scope for Phase 3)

### Phase 3.5: Embeddings & Vector Search
- Add semantic similarity search for learnings
- Use nomic-embed-text for local embeddings
- SQLite + sqlite-vec for vector storage
- Query similar past decisions before planning

### Phase 4: BM25 Lexical Search
- Implement lightweight keyword search (no embeddings)
- Rank learnings by relevance to current planning context
- Combine with recency scoring (recent + relevant)

### Phase 5: Decision ADR Export
- Generate Architecture Decision Record (ADR) files from handoff decisions
- Store in `docs/adr/` following MADR template
- Version control decisions alongside code

### Phase 6: Relationship Graph Queries
- Query API: "What files does decision X affect?"
- Query API: "What risks are associated with file Y?"
- Visualize decision graph in UI

---

## Dependencies

**Zero new dependencies** - uses existing patterns:
- Filesystem operations (fs module)
- JSON storage (existing pattern from learnings.md)
- IPC backend (existing architecture)
- System prompt injection (existing hook)

---

## References

### Internal Code References
- Learnings module: `packages/shared/src/agent/learnings.ts` (lines 22-196)
- Session manager: `apps/electron/src/main/sessions.ts` (lines 1686-1691)
- System prompt: `packages/shared/src/prompts/system.ts` (lines 307-342, 327-331)
- Handoff tool: `packages/shared/src/agent/session-scoped-tools.ts` (lines 2197-2272)
- Message types: `packages/core/src/types/message.ts` (line 19, lines 192-197)
- Session storage: `packages/shared/src/sessions/storage.ts`

### Research Documentation
- Conversation persistence: `docs/research/conversation-persistence.md`
- Semantic memory: `docs/research/semantic-memory.md`
- Electron migration: `docs/brainstorms/2026-02-01-electron-craft-agents-migration-brainstorm.md`
- Intelligent planning layer: `docs/plans/intelligent-planning-layer.md`

### External Best Practices
- [SQLite for GraphRAG](https://stephencollins.tech/posts/how-to-build-lightweight-graphrag-sqlite)
- [Architecture Decision Records (ADR)](https://github.com/joelparkerhenderson/architecture-decision-record)
- [MADR Template](https://github.com/adr/madr)
- [BM25 Lexical Search](https://github.com/xhluca/bm25s)
- [Context Engineering for LLMs](https://aimojo.io/context-engineering/)

### Framework Documentation
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Claude Agent SDK Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [Jotai Persistence](https://jotai.org/docs/guides/persistence)

---

## Compound Engineering Notes

**What was decided:**
- Use workspace-scoped JSON files (not SQLite) for relationships
- Extract from handoff reviews (not generic messages) for high signal-to-noise
- FIFO eviction for bounded storage growth
- Inject last 20 relationships (not all) to manage prompt size

**Why these decisions:**
- JSON files match existing learnings.md pattern (consistency)
- Handoff reviews are explicitly structured for extraction (decisions have confidence scores)
- FIFO is simplest eviction policy (no LRU complexity)
- Prompt size limits require selective injection (relevance > completeness)

**For next iteration:**
- Consider deduplication for relationship storage
- Add BM25 search when learnings exceed manual scan
- Explore embeddings when relationship graph exceeds 1000 entries
