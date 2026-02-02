# Research: The Intent Layer

> **Source:** https://www.intent-systems.com/blog/intent-layer  
> **Status:** Research Complete  
> **Date:** 2026-02-01

## Core Insight

> "The ceiling on AI results isn't model intelligence—it's what the model sees before it acts."

Same model, same week: skilled task on complex codebase succeeded, simple task on smaller codebase failed. The difference? **Context**.

## What Is The Intent Layer?

A thin, hierarchical context system embedded in your codebase:
- **Intent Nodes** = AGENTS.md, CLAUDE.md files at semantic boundaries
- **Auto-loading** = Loaded automatically when agent works in that area
- **Hierarchical** = Ancestors always included (T-shaped context)

```
repo/
├── AGENTS.md                  ← Root node (always loaded)
├── services/
│   ├── AGENTS.md              ← Loads with root
│   └── payment/
│       ├── AGENTS.md          ← Loads with parent + root
│       └── validators/        ← Covered by parent node
└── docs/
```

## Two Jobs of Intent Nodes

1. **Compress context** - Distill large code areas into minimal tokens
2. **Surface hidden context** - Invariants, decisions, "why things are this way"

> "If your node is 10k tokens for 20k tokens of code, you're adding weight, not compressing."

## What's In a Node

| Section | Content |
|---------|---------|
| Purpose & Scope | What this area does, what it doesn't |
| Entry Points | Main APIs, invariants, contracts |
| Usage Patterns | "To add a rule, follow this pattern..." |
| Anti-patterns | "Never call this directly..." |
| Dependencies | Related areas, downlinks |
| Pitfalls | Gotchas, sharp edges |

## Hierarchical Loading

```
When agent enters /services/payment/validators/:

  ┌─────────────────────┐
  │  repo/AGENTS.md     │  ← High-level picture
  └──────────┬──────────┘
             │
  ┌──────────▼──────────┐
  │ services/AGENTS.md  │  ← Service context
  └──────────┬──────────┘
             │
  ┌──────────▼──────────┐
  │ payment/AGENTS.md   │  ← Payment specifics
  └─────────────────────┘

  T-shaped: broad at top, specific where working
```

## Downlinks: Progressive Disclosure

```markdown
## Related Context
- Payment validation rules: `./validators/AGENTS.md`
- Settlement engine: `./settlement/AGENTS.md`

## Architecture Decisions
- Why eventual consistency: `/docs/adrs/004-eventual-consistency.md`
```

Don't load everything upfront. Point to related context agents can follow if needed.

## Hierarchical Summarization (Fractal Compression)

```
Raw Code (200k tokens)
    ↓ summarize
Leaf Intent Node (2-3k tokens)
    ↓ summarize
Parent Node (2k tokens)
    ↓ summarize
Root Node (1k tokens)

Each layer compresses the layer below.
```

## Maintenance Flywheel

On every merge:
1. Detect changed files
2. Identify affected Intent Nodes
3. Re-summarize if behavior changed
4. Propose updates (human reviews)

**Reinforcement learning:** Agents surface what's missing → updates feed back → future agents start from better baseline.

## Mapping to FloatPrompt + Semantic Memory

| Intent Layer | Our System |
|--------------|------------|
| Intent Nodes | `.float/` files, `agents.md` |
| Hierarchical loading | Auto-loaded on `/float start` |
| Downlinks | Relationship graph in `float.db` |
| Compression | Semantic embeddings |
| Maintenance flywheel | `/float-log` + agent extraction |
| Reinforcement learning | Learning types (GOTCHA, PATTERN, etc.) |

## Key Takeaways for Our UI

1. **agents.md already exists** - We're doing this! Enhance it.
2. **Hierarchy matters** - Place nodes at semantic boundaries
3. **Compress, don't bloat** - Intent should be smaller than code
4. **Progressive disclosure** - Downlinks, not upfront loading
5. **Maintenance is automated** - Agents propose updates

## Integration Proposal

Enhance `agents.md` to be a proper Intent Node:
- Add downlinks to subsystem docs
- Include invariants and anti-patterns
- Keep it small (target 1-2k tokens)

Add Intent Nodes at semantic boundaries:
```
.float/
├── agents.md           ← Root Intent Node
├── src/
│   └── AGENTS.md       ← Component context
└── docs/
    └── AGENTS.md       ← Documentation context
```
