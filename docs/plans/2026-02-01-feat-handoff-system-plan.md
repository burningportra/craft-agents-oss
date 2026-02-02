---
title: "feat: Implement handoff system between brainstorm and plan agent"
type: feat
date: 2026-02-01
brainstorm: docs/brainstorms/2026-02-01-handoff-design-brainstorm.md
---

# Implement handoff system between brainstorm and plan agent

## Overview

Pass structured context from the brainstorm conversation to the plan agent. User clicks "Ready to plan" → AI extracts decisions/files/risks → user reviews/edits on a simple screen → payload delivered to plan agent via system prompt + tools.

Forward-only flow for v1. No round-trips, no drag-and-drop, no incremental extraction.

## Architecture

```
Brainstorm (useChat)
  │
  ├─ User pins decisions via message action → store
  ├─ "Ready to plan" click → extractHandoff() → store
  │
  ▼
Review Screen (reads store)
  │
  ├─ Simple list: decisions (editable), files, risks
  ├─ User can edit/remove items
  ├─ "Start planning" → snapshot → plan agent
  │
  ▼
Plan Agent
  │
  ├─ System prompt has full handoff context
  ├─ 3 tools: getHandoffContext, addDecision, completePlanning
  ├─ stopWhen: step limit or completePlanning called
```

## Data Model

```typescript
// src/stores/handoffStore.ts
import { z } from 'zod';

const relevanceSchema = z.enum(['high', 'medium', 'low']);
const severitySchema = z.enum(['high', 'medium', 'low']);

const decisionSchema = z.object({
  id: z.string(),
  content: z.string(),
  source: z.enum(['ai-extracted', 'user-pinned', 'user-edited']),
});
type HandoffDecision = z.infer<typeof decisionSchema>;

const fileRefSchema = z.object({
  id: z.string(),
  path: z.string(),
  relevance: relevanceSchema,
  context: z.string(),
});
type HandoffFileRef = z.infer<typeof fileRefSchema>;

const riskSchema = z.object({
  id: z.string(),
  description: z.string(),
  severity: severitySchema,
});
type HandoffRisk = z.infer<typeof riskSchema>;

// What AI extraction returns (no id, no source)
const extractionResultSchema = z.object({
  decisions: z.array(z.object({
    content: z.string().describe('A single actionable decision, phrased as a declarative statement'),
    confidence: z.number().min(0).max(1).describe('How explicitly this was agreed upon (1.0 = explicit, 0.5 = implied)'),
  })).describe('Distinct decisions agreed upon during the brainstorm'),
  filesReferenced: z.array(z.object({
    path: z.string().describe('Relative file path from project root (e.g., src/App.jsx)'),
    relevance: relevanceSchema.describe('How central this file is to the planned work'),
    context: z.string().describe('One sentence explaining why this file matters'),
  })).describe('Source files mentioned or implied as needing changes'),
  risks: z.array(z.object({
    description: z.string().describe('A specific risk or concern raised during brainstorming'),
    severity: severitySchema.describe('Impact if this risk materializes'),
  })).describe('Technical risks, unknowns, or concerns identified'),
  summary: z.string().describe('2-3 sentence digest of what was decided and what the next step is'),
});
type ExtractionResult = z.infer<typeof extractionResultSchema>;

// Frozen snapshot for plan agent — readonly to prevent leaking mutable store
interface HandoffSnapshot {
  readonly decisions: readonly HandoffDecision[];
  readonly filesReferenced: readonly HandoffFileRef[];
  readonly risks: readonly HandoffRisk[];
  readonly brainstormSummary: string;
}

// Persisted state — exclude transient keys; new fields persisted by default
type TransientKeys = 'frozenPayload';
```

## Phase 1: Store + Extraction

**Files:**
- `src/stores/handoffStore.ts` (new)
- `src/lib/extractHandoff.ts` (new)
- `tsconfig.json` (new) — minimal, for editor type-checking only
- `package.json` — add `zustand`

### Store

```typescript
// src/stores/handoffStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface HandoffStore {
  decisions: HandoffDecision[];
  filesReferenced: HandoffFileRef[];
  risks: HandoffRisk[];
  brainstormSummary: string;
  frozenPayload: HandoffSnapshot | null;

  mergeExtraction: (result: ExtractionResult) => void;
  addDecision: (content: string, source?: HandoffDecision['source']) => void;
  updateDecision: (id: string, content: string) => void;
  removeDecision: (id: string) => void;
  removeFileRef: (id: string) => void;
  removeRisk: (id: string) => void;
  freezeForPlanning: () => void;
  reset: () => void;
}

const initialState = {
  decisions: [],
  filesReferenced: [],
  risks: [],
  brainstormSummary: '',
  frozenPayload: null,
};

export const useHandoffStore = create<HandoffStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        mergeExtraction: (result) => set((s) => ({
          decisions: [
            ...s.decisions,
            ...result.decisions.map(d => ({
              id: crypto.randomUUID(),
              content: d.content,
              source: 'ai-extracted' as const,
            })),
          ],
          filesReferenced: [
            ...s.filesReferenced,
            ...result.filesReferenced.map(f => ({
              id: crypto.randomUUID(), ...f,
            })),
          ],
          risks: [
            ...s.risks,
            ...result.risks.map(r => ({
              id: crypto.randomUUID(), ...r,
            })),
          ],
          brainstormSummary: result.summary,
        }), false, 'mergeExtraction'),

        addDecision: (content, source = 'user-pinned') => set((s) => ({
          decisions: [...s.decisions, { id: crypto.randomUUID(), content, source }],
        }), false, 'addDecision'),

        updateDecision: (id, content) => set((s) => ({
          decisions: s.decisions.map(d =>
            d.id === id ? { ...d, content, source: 'user-edited' as const } : d
          ),
        }), false, 'updateDecision'),

        removeDecision: (id) => set((s) => ({
          decisions: s.decisions.filter(d => d.id !== id),
        }), false, 'removeDecision'),

        removeFileRef: (id) => set((s) => ({
          filesReferenced: s.filesReferenced.filter(f => f.id !== id),
        }), false, 'removeFileRef'),

        removeRisk: (id) => set((s) => ({
          risks: s.risks.filter(r => r.id !== id),
        }), false, 'removeRisk'),

        freezeForPlanning: () => set((s) => ({
          frozenPayload: {
            decisions: s.decisions,
            filesReferenced: s.filesReferenced,
            risks: s.risks,
            brainstormSummary: s.brainstormSummary,
          },
        }), false, 'freezeForPlanning'),

        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'handoff-storage',
        partialize: ({ frozenPayload, ...data }) =>
          Object.fromEntries(
            Object.entries(data).filter(([, v]) => typeof v !== 'function')
          ),
      }
    ),
    { name: 'HandoffStore', enabled: process.env.NODE_ENV === 'development' }
  )
);
```

### Extraction

```typescript
// src/lib/extractHandoff.ts
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function extractHandoff(
  messages: Message[],
  signal: AbortSignal
): Promise<ExtractionResult> {
  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-5-20250514'),
    schema: extractionResultSchema,
    system: 'Extract decisions, file references, and risks from this brainstorm conversation. Only extract information explicitly stated. File paths must be relative to project root.',
    prompt: formatMessages(messages.slice(-50)), // hard cap at 50 messages
    abortSignal: signal,
  });

  // Don't mutate SDK result — use spread
  return {
    ...object,
    filesReferenced: object.filesReferenced.filter(
      f => !f.path.startsWith('/') && !f.path.includes('..')
    ),
  };
}

function formatMessages(messages: Message[]): string {
  return messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');
}
```

**Acceptance criteria:**
- [x] Store initialises with empty state
- [x] `addDecision` adds with specified source
- [x] `updateDecision` changes content + sets `source: 'user-edited'`
- [x] `removeDecision` / `removeFileRef` / `removeRisk` hard-delete
- [x] `mergeExtraction` appends AI items without clobbering pins
- [x] `freezeForPlanning` creates readonly snapshot
- [x] Extraction cancellable via AbortController
- [x] Extraction rejects absolute paths and `..` traversal
- [x] Store persists to localStorage via Zustand `persist`

---

## Phase 2: Review Screen + Pin UI

**Files:**
- `src/components/HandoffReview.jsx` (new)
- `src/App.jsx` — add `extracting` and `handoff` phases, pin UI in brainstorm

### Review Screen

Simple stacked layout — decisions list, then files, then risks. No grid, no sidebar.

```
┌─────────────────────────────────────────────┐
│ DECISIONS (3)                               │
│                                             │
│  ▎ Use Zustand for state          [Edit] [✕]│
│    PINNED                                   │
│                                             │
│  ▎ Build review screen            [Edit] [✕]│
│    AI                                       │
│                                             │
│  ▎ Support round-trips            [Edit] [✕]│
│    AI                                       │
│                                             │
│ FILES (2)                                   │
│  src/App.jsx — Main component               │
│  src/stores/handoffStore.ts — State         │
│                                             │
│ RISKS (1)                                   │
│  ⚠ Extraction may miss implicit decisions   │
│                                             │
├─────────────────────────────────────────────┤
│ [Back to brainstorm]    [Start planning →]  │
└─────────────────────────────────────────────┘
```

**Inline edit** — local draft state so concurrent store updates don't blow away edits:

```tsx
function DecisionCard({ decision }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(decision.content);
  const updateDecision = useHandoffStore(s => s.updateDecision);

  useEffect(() => {
    if (!isEditing) setDraft(decision.content);
  }, [decision.content, isEditing]);

  const save = () => {
    updateDecision(decision.id, draft);
    setIsEditing(false);
  };
  // Enter to save, Escape to cancel
}
```

**Pin UI:** Pin icon on hover of assistant messages. Click → `addDecision(content, 'user-pinned')`. Pin count badge near "Ready to plan" button.

**Empty state:** Text "Nothing to hand off yet" + "Back to brainstorm" button. Hide "Start planning".

**Phase flow in App.jsx:**
- `isExtracting` boolean (not a formal state machine — just a flag)
- "Ready to plan" disabled while `isExtracting`
- AbortController ref — abort on back navigation
- On extraction success → show review screen
- "Start planning" → `freezeForPlanning()` → transition to plan agent

**Acceptance criteria:**
- [x] Review screen shows decisions, files, risks in stacked lists
- [x] Cards show content, source label, edit + remove actions
- [x] Edit uses local draft state
- [x] Remove hard-deletes from store
- [x] "Start planning" calls `freezeForPlanning()` then transitions to planning
- [x] "Start planning" hidden when zero decisions
- [x] "Back to brainstorm" navigates back
- [x] Pin icon on assistant messages during brainstorm
- [x] Pin count badge near "Ready to plan"
- [x] "Ready to plan" disabled during extraction
- [x] Back navigation aborts in-flight extraction
- [x] Keyboard: Tab through cards, Enter to save edit, Escape to cancel

---

## Phase 3: Agent Tools + Plan Agent Wiring

**Files:**
- `src/tools/handoffTools.ts` (new)
- Plan agent configuration wiring

### 3 Tools

```typescript
// src/tools/handoffTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import { useHandoffStore } from '../stores/handoffStore';

export const getHandoffContext = tool({
  description: 'Get the full handoff context: decisions, files, risks, and summary',
  parameters: z.object({}),
  execute: async () => {
    const frozen = useHandoffStore.getState().frozenPayload;
    if (!frozen) return { error: 'No handoff context available' };
    return frozen;
  },
});

export const addDecision = tool({
  description: 'Add a new decision discovered during planning',
  parameters: z.object({
    content: z.string().describe('The decision statement'),
  }),
  execute: async ({ content }) => {
    useHandoffStore.getState().addDecision(content, 'ai-extracted');
    return { added: true };
  },
});

export const completePlanning = tool({
  description: 'Signal that planning is complete',
  parameters: z.object({
    summary: z.string().describe('Summary of the generated plan'),
  }),
  execute: async ({ summary }) => {
    return { complete: true, summary };
  },
});
```

### System Prompt Injection

```typescript
function buildPlanAgentSystemPrompt(): string {
  const s = useHandoffStore.getState().frozenPayload;
  if (!s) return 'No handoff context available.';
  return `
## Handoff Context

### Decisions
${s.decisions.map(d => `- ${d.content}`).join('\n')}

### Files
${s.filesReferenced.map(f => `- ${f.path} (${f.relevance}): ${f.context}`).join('\n')}

### Risks
${s.risks.map(r => `- [${r.severity}] ${r.description}`).join('\n')}

### Summary
${s.brainstormSummary}

Use getHandoffContext for structured data. Use addDecision if you discover new decisions. Use completePlanning when done.
`;
}
```

### Agent Configuration

```typescript
import { stopWhen, stepCountIs, hasToolCall } from 'ai';

const result = await agent.run({
  system: buildPlanAgentSystemPrompt(),
  tools: { getHandoffContext, addDecision, completePlanning },
  stopWhen: [
    stepCountIs(20),
    hasToolCall('completePlanning'),
  ],
});
```

**Acceptance criteria:**
- [x] `getHandoffContext` returns frozen snapshot (not live store)
- [x] `addDecision` adds to live store
- [x] `completePlanning` signals termination
- [x] System prompt includes handoff summary at agent construction
- [x] Agent terminates at 20 steps or on `completePlanning` (configured in plan, runtime requires `ai` package)
- [x] All tools return explicit types (no store internals leaked)

---

## Dependencies

- `zustand` — add to package.json
- `ai`, `@ai-sdk/anthropic`, `zod` — already planned for parent project

No new UI dependencies. No `@dnd-kit`. No `nanoid`.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Handoff trigger | "Ready to plan" button | User controls timing |
| Extraction | Batch on trigger, last 50 messages | Simple, no rolling summaries |
| Review layout | Stacked list | Simpler than grid; ship fast |
| Delete model | Hard-delete | Re-extraction is the undo |
| Agent tools | 3 (get, add, complete) | Minimum viable; expand if needed |
| State management | `isExtracting` boolean | No formal state machine for v1 |
| Sticky footer | `position: sticky` | No IntersectionObserver needed |
| Persistence | Zustand `persist` | Built-in, zero config |

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Extraction misses implicit decisions | Medium | User pins complement AI extraction |
| Double-click extraction | Medium | `isExtracting` flag disables button |
| Store mutation during agent run | Medium | `freezeForPlanning()` snapshot |
| Inline edit blown away by store update | Medium | Local draft state in component |

## Success Metrics

- User reaches plan agent with context from brainstorm end
- Plan agent's first output references handoff decisions (zero re-asking)
- Review screen edits reflected in plan agent context

## References

- Brainstorm: `docs/brainstorms/2026-02-01-handoff-design-brainstorm.md`
- Parent plan: `plans/intelligent-planning-layer.md` (Phase 6)
- AI SDK: `docs/research/ai-sdk-integration.md`

---

## V2 Candidates (Deferred)

Items cut from the deepened plan. Implement only if v1 usage reveals the need:

- Round-trip flow (agent sends user back to brainstorm)
- `@dnd-kit/sortable` drag-and-drop reordering
- Granular CRUD tools (11 tools → currently 3)
- `prepareStep` phased tool access
- `needsApproval` on destructive tools
- Per-tool rate limiting
- Canary tokens / nonce-delimited prompts
- Generation counter for stale responses
- Haiku/Sonnet model selection
- Rolling summary / incremental extraction
- Formal state machine with transition table
- `IntersectionObserver` sticky footer
- CSS stagger animations
- Asymmetric grid layout
- Source-colored left borders + badges
- `aria-live` region + focus management after delete
- 24h stale state discard
- `beforeunload` flush
