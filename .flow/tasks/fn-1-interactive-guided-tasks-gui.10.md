# fn-1-interactive-guided-tasks-gui.10 Split-view epic chat: persistent history, write-with-confirmation

## Description
Build the split-view chat panel scoped to an epic. Persistent chat history (IndexedDB), inherits main chat codebase access, write-with-confirmation for task mutations, slash commands + action buttons.

**Size:** M
**Files:**
- `apps/electron/src/renderer/components/tasks/EpicChatPanel.tsx` — split-view chat container
- `apps/electron/src/renderer/components/tasks/EpicChatHistory.tsx` — IndexedDB persistence layer
- `apps/electron/src/renderer/components/tasks/ChatActionButtons.tsx` — /plan, /interview, /review buttons
- `apps/electron/src/renderer/components/tasks/WriteConfirmation.tsx` — confirmation dialog for mutations

## Approach

- Split-view: use existing `react-resizable-panels` (wrapper at `components/ui/resizable.tsx`) with `autoSaveId="epic-chat"`
- Chat panel appears to the right of the kanban/list/graph view within a tab
- Chat history: IndexedDB via `idb` library:
  ```typescript
  // Store: 'epic-chats', key: epicId
  interface EpicChatRecord {
    epicId: string
    messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: number }>
    updatedAt: number
  }
  // Index: 'by-updated' on updatedAt (for LRU cleanup)
  ```
- Install `idb` as new dependency
- Codebase access: inherits from main chat infrastructure — no special source selection needed. Reuses existing AI interaction layer.
- Write-with-confirmation: when AI proposes a task mutation (status change, spec edit, new task), show a preview card with "Apply" / "Dismiss" buttons. On Apply, execute via IPC.
- Slash commands: parse input for `/plan`, `/interview`, `/review` — trigger corresponding flow-next operations
- Action buttons: row of buttons at bottom of chat (Plan, Interview, Review) that insert the slash command
- Auto-save chat draft on tab switch (Jotai atom per epic)

## Key context

- `react-resizable-panels` `autoSaveId` persists panel sizes to localStorage automatically
- IndexedDB via `idb` avoids native rebuild complexity of better-sqlite3
## Approach

- Split-view: use existing `react-resizable-panels` (wrapper at `components/ui/resizable.tsx`) with `autoSaveId="epic-chat"`
- Chat panel appears to the right of the kanban/list/graph view within a tab
- Chat history: IndexedDB via `idb` library, keyed on epicId. Store messages with role, content, timestamp.
- Write-with-confirmation: when AI proposes a task mutation (status change, spec edit, new task), show a preview card with "Apply" / "Dismiss" buttons. On Apply, execute via IPC.
- Slash commands: parse input for `/plan`, `/interview`, `/review` — trigger corresponding flow-next operations
- Action buttons: row of buttons at bottom of chat (Plan, Interview, Review) that insert the slash command
- Chat connects to existing AI infrastructure (same as main chat panel)
- Auto-save chat draft on tab switch (Jotai atom per epic)

## Key context

- The existing chat system at `renderer/pages/ChatPage.tsx` handles AI interaction. The epic chat should reuse as much of this infrastructure as possible.
- `react-resizable-panels` `autoSaveId` persists panel sizes to localStorage automatically
- IndexedDB via `idb` avoids native rebuild complexity of better-sqlite3
- Install `idb` as new dependency
## Acceptance
- [ ] Split-view chat panel opens alongside epic content
- [ ] Chat history persists per epic in IndexedDB (EpicChatRecord schema)
- [ ] Messages survive app restart (reload from IndexedDB)
- [ ] Slash commands /plan, /interview, /review trigger flow-next operations
- [ ] Action buttons insert corresponding slash commands
- [ ] Write-with-confirmation: AI task mutations show preview with Apply/Dismiss
- [ ] Applied mutations execute via IPC and update kanban immediately
- [ ] Chat draft auto-saved on tab switch
- [ ] Panel resizable with persisted width (autoSaveId)
- [ ] `idb` dependency installed
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
