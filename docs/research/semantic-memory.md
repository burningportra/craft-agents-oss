# Research: Claude Code Semantic Memory

> **Source:** https://github.com/zacdcook/claude-code-semantic-memory  
> **Status:** Research Complete  
> **Date:** 2026-02-01

## Summary

A persistent memory system for Claude Code that extracts learnings from past sessions and injects relevant context on every prompt using vector embeddings.

## The Problem It Solves

Claude Code sessions are stateless. Every context compaction or new session loses:
- Solutions you discovered
- Gotchas and traps identified
- Infrastructure details and preferences
- Decisions made and why

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Your Prompt    │───►│   Hook Fires    │───►│  Query Daemon   │
│                 │    │  (mechanical)   │    │  (cosine sim)   │
└─────────────────┘    └─────────────────┘    └────────┬────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Claude sees    │◄───│  Inject as XML  │◄───│  Top 3 memories │
│  context + mem  │    │   in context    │    │   (≥0.45 sim)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Embedding | nomic-embed-text (local) | Vector embeddings |
| Storage | SQLite | Learnings database |
| Retrieval | Cosine similarity | Find relevant memories |
| Injection | Claude Code hooks | Auto-inject on every prompt |
| Extraction | Sub-agents | Extract learnings on compaction |

## Hook Lifecycle

```
SESSION START
├── SessionStart → Check daemon health

ACTIVE WORK (each user message)
├── UserPromptSubmit → Embed prompt → Query daemon → Inject top 3
├── PreToolUse → Extract thinking → Query if drifted → Inject

CONTEXT COMPACTION
├── PreCompact → Export transcript → Convert to markdown
└── Sub-Agent → Read transcript → Extract learnings → Store
```

## Learning Types

| Type | Example |
|------|---------|
| `WORKING_SOLUTION` | "Use Import-Clixml for credential caching" |
| `GOTCHA` | "$ must be escaped in template literals" |
| `PATTERN` | "Always check file existence before reading" |
| `DECISION` | "Chose SQLite over Postgres for local-first" |
| `FAILURE` | "Redux overkill for this scope, use Zustand" |
| `PREFERENCE` | "User prefers explicit error messages" |

## Database Schema

```sql
CREATE TABLE learnings (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  context TEXT,
  embedding BLOB NOT NULL,
  confidence REAL DEFAULT 0.9,
  session_source TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_learnings_type ON learnings(type);
```

## Integration with FloatPrompt

| Semantic Memory | FloatPrompt Equivalent |
|-----------------|----------------------|
| `learnings` table | `buoy` table |
| Learning types | Could enrich buoy entries |
| Vector embeddings | Add to `float.db` |
| Cosine retrieval | Query `float.db` with embeddings |
| Hook injection | `/float start` logic |
| Sub-agent extraction | `/float-log` logic |

## Proposed Integration

Combine the best of both systems:

```
┌─────────────────────────────────────────────────────────────┐
│                    float.db Schema                           │
├─────────────────────────────────────────────────────────────┤
│  sessions        (transcripts, micro-sessions)              │
│  messages        (conversation history)                      │
│  relationships   (code-code, code-decision, etc.)           │
│  learnings       (with embeddings!) ← From semantic memory  │
│  buoys           (cross-session important info)             │
└─────────────────────────────────────────────────────────────┘
```

### Enhanced Learning Query

```sql
-- Query with embedding similarity (using sqlite-vec)
SELECT content, type, 
       vec_distance(embedding, ?) as similarity
FROM learnings
WHERE similarity >= 0.45
ORDER BY similarity DESC
LIMIT 3;
```

## What This Means for Our UI

1. **Opening State**: Query learnings for relevant context
2. **Brainstorm**: Surface GOTCHAs and PATTERNS automatically
3. **Review → Compound**: Extract new learnings with types
4. **Micro-sessions**: Capture DECISIONS and PREFERENCES continuously

## Dependencies

- `nomic-embed-text` - Local embedding model (via Ollama)
- `sqlite-vec` - Vector similarity in SQLite
- Claude Code hooks - For automatic injection
