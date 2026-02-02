# FloatPrompt: Continuous Compounding Context

> **Source:** Kevin's existing system  
> **Status:** Proven in production, manual usage  
> **Goal:** Automate for autonomous agent sessions

## Core Architecture

```
your-project/
├── .float/                    ← Source of truth
│   ├── skills/
│   ├── commands/
│   └── context files
├── float.db                   ← SQLite brain (queryable)
├── agents.md                  ← Auto-generated map (always loaded)
├── buoy.md                    ← Auto-generated from latest buoy
└── src/
```

## Key Concepts

| Component | Purpose |
|-----------|---------|
| `.float/` | All floatprompt files, syncs to `.claude/`, `.cursor/`, `.codex/` |
| `float.db` | Local SQLite brain, all queryable |
| `agents.md` | Auto-generated map, always loaded, no decision point |
| `buoy` table | Cross-session important info |
| `buoy.md` | Auto-generated from latest buoy entry ("it floats") |

## Commands

| Command | What it does |
|---------|--------------|
| `/float start` | Reads git commits + related context files |
| `/float-log` | Commits changes → reviews relationships → enriches float.db → second commit |

## Philosophy: Context That Compounds

```
┌─────────────────────────────────────────────────────────────┐
│              Passive Context > On-Demand Retrieval           │
├─────────────────────────────────────────────────────────────┤
│  • AI sees what exists, retrieves what it needs             │
│  • Database-first, markdown-second                          │
│  • "Prefer retrieval-led reasoning over pre-training-led"   │
└─────────────────────────────────────────────────────────────┘
```

## What Gets Logged

On each `/float-log`:
- Transcript
- Decisions made
- The "why" behind decisions
- Relationship changes
- Cross-session info → buoy table

## Sync Flow

```
.float/* (source of truth)
    │
    ├──► .claude/
    ├──► .cursor/
    └──► .codex/
```

## Next Steps

> "Get agents to do all of this each time they run autonomously, 
>  but also logging micro-session info in-between larger sessions"

### Automation targets:
1. **Session start**: Auto-run `/float start` logic
2. **Session end**: Auto-run `/float-log` logic
3. **Micro-sessions**: Log intermediate context between major efforts
4. **Buoy updates**: Auto-surface cross-session learnings

## How This Maps to Our UI

| FloatPrompt | Our UI Component |
|-------------|------------------|
| `/float start` | Opening State → Scanning → Narrative |
| `agents.md` | Codebase awareness (auto-loaded) |
| `buoy.md` | Cross-session context in brainstorm |
| `/float-log` | Review phase → Compound phase |
| `float.db` | SQLite persistence layer |

## Key Insight

The UI we're building should **visualize and facilitate** what floatprompt does under the hood:

1. **Opening State** = `/float start` with a human-friendly face
2. **Brainstorm** = Retrieval-led reasoning from float.db
3. **Review → Compound** = `/float-log` with decisions captured
4. **Next session** = Picks up exactly where you left off
