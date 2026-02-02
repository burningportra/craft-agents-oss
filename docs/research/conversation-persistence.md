# Research: Conversation Persistence

> **Status:** Research Complete  
> **Date:** 2026-02-01

## Summary

For persisting AI chat conversations, **SQLite** is recommended over localStorage.

## Comparison: SQLite vs localStorage

| Aspect | SQLite | localStorage |
|--------|--------|--------------|
| Reliability | High (file-based) | Low (browser-controlled) |
| Capacity | Up to 281 TB | ~5-10 MB |
| Structure | Relational tables | Key-value only |
| Cross-device | No (local file) | No (browser-specific) |
| Security | Can encrypt | Plain text |
| Queryability | Full SQL | None |

## Why SQLite

1. **Reliable** - Data won't disappear when browser clears cache
2. **Structured** - Proper schema for messages, sessions, relationships
3. **AI-friendly** - `sqlite-vec` extension supports vector embeddings
4. **Local-first** - Single file, no server needed
5. **Tauri integration** - First-class SQLite plugin available

## Schema Design

```sql
-- Sessions (conversations)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  project_path TEXT NOT NULL,
  title TEXT,
  last_message_at TIMESTAMP
);
CREATE INDEX idx_sessions_project ON sessions(project_path);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- Relationship Graph (for compound knowledge)
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  type TEXT NOT NULL CHECK (type IN ('code_code', 'code_decision', 'decision_prior_art', 'intent_implementation')),
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);
CREATE INDEX idx_relationships_type ON relationships(type);
CREATE INDEX idx_relationships_source ON relationships(source_path);

-- Learnings (from /compound reviews)
CREATE TABLE learnings (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  related_files JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Tauri SQLite Plugin

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-sql = { git = "https://github.com/tauri-apps/plugins-workspace" }
```

```typescript
// Frontend usage
import Database from '@tauri-apps/plugin-sql';

const db = await Database.load('sqlite:planning.db');
await db.execute(
  'INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)',
  [id, sessionId, 'user', content]
);
```

## Alternative: Hybrid Approach

Use localStorage as a write-through cache for recent messages:
1. Write to localStorage immediately (fast UX)
2. Sync to SQLite in background (reliable persistence)
3. On startup, load from SQLite (source of truth)

## Resources

- [Tauri SQL Plugin](https://v2.tauri.app/plugin/sql/)
- [sqlite-vec for embeddings](https://github.com/asg017/sqlite-vec)
