---
title: "Electron migration via Craft Agents OSS fork"
date: 2026-02-01
status: complete
participants: [user, claude]
---

# Electron Migration via Craft Agents OSS Fork

## What We're Building

Fork [lukilabs/craft-agents-oss](https://github.com/lukilabs/craft-agents-oss) and embed the compound-engineering planning workflow as rich components rendered inline within the existing chat stream. The Craft Agents shell (session inbox, agent sidebar, OAuth, MCP, encrypted storage, IPC) stays as-is. Our UI (intent picker, brainstorm chat, extraction, handoff review, phase navigation) renders as custom message types in the center chat panel.

## Why This Approach

**Fork Craft Agents instead of migrating our web app to Electron because:**

- Get Electron shell, OAuth PKCE, MCP spawning, encrypted credentials, IPC, session management, auto-updates for free
- Only 3 browser API call sites need changing in our current app (localStorage x3, showDirectoryPicker x1) — but by forking Craft Agents, even those are already handled
- Our React components (PlanPhase, HandoffReview) can render directly in their React 18 renderer
- Their `auth-request` role is an exact precedent for inline custom cards in the chat stream

**Embed in chat (not replace the panel) because:**

- Keeps multi-session inbox and agent sidebar intact
- Planning workflow becomes a natural extension of chat conversation
- Each phase artifact (intent card, decision cards, risk cards) is a persistent chat message
- Conversation history includes both chat text AND planning artifacts

## Key Decisions

### 1. Integration pattern: New MessageRole types

Follow Craft Agents' `auth-request` precedent. Add new roles to their `MessageRole` union:

| New Role | Component | Interactive? |
|---|---|---|
| `intent-picker` | Intent selection card (feature/fix/continue/explore/lost) | Yes — clicking sends a message |
| `handoff-review` | Decisions/files/risks cards with edit/remove | Yes — inline editing |
| `extraction-progress` | Spinning extraction indicator | No — replaced by handoff-review when done |
| `phase-indicator` | Current workflow phase badge | No — status display |

The full chain for each: `AgentEvent` → `processEvent` handler → `Message` with custom role → `groupMessagesByTurn` creates new turn variant → `ChatDisplay` renders component.

### 2. Agent model: Hybrid (UI-driven flow, agent-driven chat)

- **UI controls phase transitions** (openingStep state machine: question → brainstorm → extracting → handoff → planning)
- **Brainstorm chat runs through Craft Agents' agent pipeline** in main process — replaces our client-side `DirectChatTransport` with their IPC-based agent execution
- **Extraction (generateObject) runs in main process** — no more client-side API key exposure
- **Handoff review is pure UI** — React components reading from Zustand/Jotai store

### 3. State management: Jotai (adopt theirs) + Zustand (keep ours for handoff)

- Adopt Jotai for session/chat state (matches their architecture)
- Keep Zustand for handoff store (decisions, files, risks, frozenPayload) — it's self-contained and persisted
- Replace localStorage persistence with Craft Agents' encrypted filesystem storage via IPC

### 4. Session persistence: Already solved

Craft Agents has session persistence built in (filesystem-based, encrypted). Our deepened plan for localStorage session persistence becomes unnecessary — we get better persistence for free.

### 5. API key security: Already solved

Craft Agents' OAuth PKCE flow + encrypted credential storage eliminates the `anthropic-dangerous-direct-browser-access` header entirely. API calls happen in main process.

## What We Keep From Current App

| Component | Status | Notes |
|---|---|---|
| PlanPhase workflow logic | Migrate | Adapt to emit custom MessageRole types instead of rendering directly |
| HandoffReview component | Migrate | Render as `handoff-review` message card |
| Handoff Zustand store | Keep | Decisions/files/risks/frozenPayload — works in renderer |
| extractHandoff logic | Migrate to main | Runs via Craft Agents' agent pipeline, not client-side |
| brainstormAgent | Replace | Use Craft Agents' agent execution in main process |
| anthropicClient.ts | Delete | Main process handles all API calls |
| sessionStorage.ts (planned) | Delete | Craft Agents has filesystem persistence |
| appStore.ts (planned) | Delete | Session state managed by Jotai + Craft Agents sessions |
| Wise Design System CSS | Migrate | Apply to forked renderer, reconcile with their shadcn/Tailwind |
| Zod schemas | Keep | Extraction schema, handoff types — used in main process |

## What We Get For Free

- Electron shell + window management
- Anthropic OAuth SSO (PKCE flow)
- AES-256-GCM encrypted credential storage
- MCP server spawning and tool execution
- Multi-session inbox with persistence
- Agent sidebar with configuration
- IPC architecture (typed channels)
- Auto-updates via electron-updater
- macOS/Windows/Linux packaging
- Permission system for tool execution
- Streaming markdown rendering
- Code/diff/terminal overlay previews

## Architecture Overview

```
Craft Agents OSS (forked)
├── apps/electron/
│   ├── main/
│   │   ├── agent-manager.ts          # MODIFY: Add planning agent config
│   │   ├── ipc.ts                    # MODIFY: Add planning-specific IPC channels
│   │   └── tools/
│   │       └── planning-tools.ts     # NEW: extractHandoff, getHandoffContext as MCP tools
│   ├── preload/                      # KEEP AS-IS
│   └── renderer/
│       ├── components/
│       │   ├── app-shell/
│       │   │   └── ChatDisplay.tsx   # MODIFY: Add rendering for new turn types
│       │   ├── chat/
│       │   │   ├── AuthRequestCard   # KEEP (precedent for our cards)
│       │   │   ├── IntentPickerCard  # NEW
│       │   │   ├── HandoffReviewCard # NEW (from our HandoffReview.tsx)
│       │   │   ├── ExtractionCard    # NEW
│       │   │   └── PhaseIndicator    # NEW
│       │   └── ...
│       ├── atoms/
│       │   └── handoff.ts            # NEW: Jotai atoms or keep Zustand
│       └── event-processor/
│           └── handlers/
│               └── planning.ts       # NEW: Handle planning-specific events
├── packages/
│   ├── core/
│   │   └── types/message.ts          # MODIFY: Add new MessageRole values
│   └── ui/
│       └── components/chat/
│           └── turn-utils.ts         # MODIFY: Handle new turn types in groupMessagesByTurn
```

## Open Questions

1. **Craft Agents license** — It's OSS, but what license? Need to verify fork/modify rights.
2. **React 18 vs 19** — Our app uses React 19, Craft Agents uses 18.3. Need to verify our components work on 18 or upgrade theirs.
3. **Tailwind reconciliation** — We use Tailwind v4 with `@theme` directive. They use shadcn/Tailwind. Need to merge design tokens.
4. **Zustand in Jotai world** — Keeping Zustand for handoff store alongside their Jotai. Is this clean or should we migrate handoff to Jotai atoms?
5. **Planning tools as MCP** — Should extractHandoff be exposed as an MCP tool (reusable across agents) or kept as internal main-process logic?

## Implementation Phases

### Phase 1: Fork + Verify Shell
- Fork craft-agents-oss
- Build and run locally
- Verify OAuth flow works
- Understand the codebase structure hands-on

### Phase 2: Add Custom Message Roles
- Add `intent-picker`, `handoff-review`, `extraction-progress`, `phase-indicator` to MessageRole
- Add turn types to `groupMessagesByTurn`
- Add rendering branches to `ChatDisplay.tsx`
- Create stub components that render static content

### Phase 3: Wire Intent Picker
- `IntentPickerCard` renders with clickable options
- Clicking an intent sends a message to the brainstorm agent
- Agent responds in chat, cards interleave with text messages

### Phase 4: Migrate Extraction to Main Process
- Port `extractHandoff` to main process (uses Anthropic SDK directly, no client-side call)
- Emit `extraction-progress` event during extraction
- Emit `handoff-review` event with results
- `HandoffReviewCard` renders decisions/files/risks inline

### Phase 5: Handoff Store + Planning Flow
- Port Zustand handoff store (or convert to Jotai atoms)
- Wire "Ready to plan" → extraction → handoff review flow
- Persist handoff state via Craft Agents' filesystem storage

### Phase 6: Design System Reconciliation
- Merge Wise Design System tokens with their shadcn/Tailwind setup
- Ensure cards match the rest of the UI visually
