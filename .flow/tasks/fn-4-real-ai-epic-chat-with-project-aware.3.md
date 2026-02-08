# fn-4-real-ai-epic-chat-with-project-aware.3 Smart Empty State + Starter Prompts

## Description
Replace the minimal empty chat state with a rich, project-aware experience. Show dynamic starter prompts based on epic state that users can click to immediately start a conversation.

**Size:** S
**Files:**
- `apps/electron/src/renderer/components/tasks/EpicChatPanel.tsx` (empty state section at L415-422)

## Approach

- Replace the static empty state at `EpicChatPanel.tsx:415-422` with dynamic starter prompts
- Determine starter prompts based on epic state:
  - **No tasks**: "Break down this epic into tasks" (→ /plan via `handleInsertCommand`), "What questions should I answer first?" (→ /interview via `handleInsertCommand`)
  - **Has tasks, none done**: "Review the task breakdown" (→ /review via `handleInsertCommand`), "What should I tackle first?" (→ free-form, send immediately via `handleSend`)
  - **Has stuck tasks**: "Help me get unstuck on [task title]" (→ free-form, send immediately), "What's blocking progress?" (→ free-form, send immediately)
  - **All tasks done**: "What could we improve?" (→ free-form, send immediately), "Generate a retrospective" (→ free-form, send immediately)
- **Click behavior**:
  - Slash command starters (/plan, /review, /interview): use `handleInsertCommand` to populate input (let user edit/confirm)
  - Free-form starters: populate input and immediately call `handleSend()`
- Include epic title in the greeting: "What would you like to know about {epicTitle}?"
- Render starters as clickable pill buttons (follow pattern from `AISuggestionSidebar.tsx:60-161` for epic state detection)
- Staggered fade-in animation using `motion.div` with `delay: index * 0.05`
- Wrap entire empty state in `AnimatePresence` (already imported) so it animates out when `messages.length > 0`
- Keep the empty state lightweight — no LLM calls at render time

## Key context

- Current empty state at `EpicChatPanel.tsx:415-422` is a simple centered message with icon
- `AISuggestionSidebar.tsx:60-161` already has rule-based epic state detection logic — reuse the same conditions
- `handleInsertCommand` callback exists for populating input with slash commands
- `ListView.tsx:39-85` has a separate `EmptyTasksState` with "Open Chat & Run /plan" button — these should be consistent
- Use `motion/react` for animations (already imported). `AnimatePresence` is already imported — use for exit animation
## Approach

- Replace the static empty state at `EpicChatPanel.tsx:415-422` with dynamic starter prompts
- Determine starter prompts based on epic state:
  - **No tasks**: "Break down this epic into tasks" (→ /plan), "What questions should I answer first?" (→ /interview)
  - **Has tasks, none done**: "Review the task breakdown" (→ /review), "What should I tackle first?"
  - **Has stuck tasks**: "Help me get unstuck on [task title]", "What's blocking progress?"
  - **All tasks done**: "What could we improve?", "Generate a retrospective"
- Include project name from epic context (already available via `epicsAtom`) in the greeting: "What would you like to know about {epicTitle}?"
- Render starters as clickable pill buttons (follow pattern from `AISuggestionSidebar.tsx:60-161` for epic state detection)
- On click: populate input draft and immediately call `handleSend()` (or use existing `handleInsertCommand` callback for slash commands)
- Staggered fade-in animation using `motion.div` with `delay: index * 0.05` (standard pattern per GitHub scout findings)
- Keep the empty state lightweight — no LLM calls at render time

## Key context

- Current empty state at `EpicChatPanel.tsx:415-422` is a simple centered message with icon
- `AISuggestionSidebar.tsx:60-161` already has rule-based epic state detection logic — reuse the same conditions
- `handleInsertCommand` callback exists for populating input with slash commands
- `ListView.tsx:39-85` has a separate `EmptyTasksState` with "Open Chat & Run /plan" button — these should be consistent
- Use `motion/react` for animations (already imported in the component)
## Acceptance
- [ ] Empty chat shows project-aware greeting with epic title
- [ ] 2-4 dynamic starter prompts shown based on epic state (no tasks, has tasks, stuck, all done)
- [ ] Slash command starters use `handleInsertCommand` (user can edit before sending)
- [ ] Free-form starters populate input and immediately send
- [ ] Starter prompts use staggered fade-in animation
- [ ] Empty state wrapped in AnimatePresence for exit animation
- [ ] No LLM call at render time (pure rule-based)
- [ ] Empty state disappears after first message is sent
## Done summary
Replaced the static empty chat state with a smart, project-aware empty state featuring dynamic starter prompts. The prompts adapt to epic state (no tasks, has tasks/none done, stuck/blocked tasks, all done, partial progress) and use staggered fade-in animation with AnimatePresence for exit transitions.
## Evidence
- Commits: 6987e8816f3fbce76ea50dfe61f91df6223090dc
- Tests: cd apps/electron && bun run typecheck
- PRs: