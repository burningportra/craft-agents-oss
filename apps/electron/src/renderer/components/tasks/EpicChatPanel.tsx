/**
 * EpicChatPanel
 *
 * Split-view chat panel scoped to an epic.
 * Features:
 * - Persistent chat history (IndexedDB)
 * - Slash commands (/plan, /interview, /review)
 * - Action buttons for quick command insertion
 * - Write-with-confirmation for task mutations
 * - Auto-save draft on blur/tab switch
 * - Resizable width with persistence (autoSaveId)
 */

import * as React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { atomFamily } from 'jotai-family'
import { MessageCircle, Send, Trash2, Bot, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Markdown } from '@/components/markdown'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import {
  useEpicChatHistory,
  type EpicChatMessage,
} from './EpicChatHistory'
import {
  ChatActionButtons,
  parseSlashCommand,
  getCommandSystemPrompt,
  type SlashCommand,
} from './ChatActionButtons'
import {
  WriteConfirmation,
  parseMutationFromResponse,
  type TaskMutation,
} from './WriteConfirmation'
import { epicsAtom, tasksAtomFamily, loadTasksAtom } from '@/atoms/tasks-state'

// ─── Atoms ────────────────────────────────────────────────────────────────────

/**
 * Draft text per epic - persisted to localStorage
 */
const chatDraftAtomFamily = atomFamily(
  (epicId: string) => atomWithStorage<string>(`epic-chat-draft-${epicId}`, ''),
  (a, b) => a === b
)

/**
 * Whether the chat panel is open - global state
 */
export const epicChatOpenAtom = atomWithStorage<boolean>('epic-chat-open', false)

// ─── Spring transition ────────────────────────────────────────────────────────

const springTransition = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 49,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EpicChatPanelProps {
  /** The epic ID for this chat */
  epicId: string | null
  /** Workspace root for IPC calls */
  workspaceRoot: string
  /** Whether the chat panel is visible */
  isOpen: boolean
  /** Callback to toggle chat visibility */
  onToggle: () => void
  /** Children to render in the main content area */
  children: React.ReactNode
  /** Optional className */
  className?: string
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: EpicChatMessage
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex gap-2 items-start',
        isUser && 'flex-row-reverse'
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
          isUser ? 'bg-blue-500/10 text-blue-600' : 'bg-foreground/10 text-foreground/70'
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          'flex-1 min-w-0 px-3 py-2 rounded-lg text-sm',
          isUser
            ? 'bg-blue-500/10 text-foreground ml-8'
            : 'bg-foreground/5 text-foreground mr-8'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <Markdown content={message.content} />
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Chat Content ─────────────────────────────────────────────────────────────

interface ChatContentProps {
  epicId: string
  workspaceRoot: string
}

function ChatContent({ epicId, workspaceRoot }: ChatContentProps) {
  const epics = useAtomValue(epicsAtom)
  const epic = epics.find((e) => e.id === epicId)
  const tasks = useAtomValue(tasksAtomFamily(epicId))
  const loadTasks = useSetAtom(loadTasksAtom)

  const {
    messages,
    isLoading,
    addMessage,
    saveMessages,
    clearHistory,
  } = useEpicChatHistory(epicId)

  const [draft, setDraft] = useAtom(chatDraftAtomFamily(epicId))
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [pendingMutation, setPendingMutation] = React.useState<TaskMutation | null>(null)
  const [isApplyingMutation, setIsApplyingMutation] = React.useState(false)

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Handle command insertion from action buttons
  const handleInsertCommand = React.useCallback((command: string) => {
    setDraft((prev) => {
      const trimmed = prev.trim()
      if (trimmed.length === 0) {
        return command + ' '
      }
      return trimmed + '\n' + command + ' '
    })
    textareaRef.current?.focus()
  }, [setDraft])

  // Handle send message
  const handleSend = React.useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed || isProcessing) return

    // Parse slash command
    const { command, args } = parseSlashCommand(trimmed)

    // Add user message
    await addMessage({ role: 'user', content: trimmed })
    setDraft('')
    setIsProcessing(true)

    try {
      // Build context for the AI
      const epicContext = epic
        ? `Epic: ${epic.title} (${epic.id})\nStatus: ${epic.status}\nProgress: ${epic.done}/${epic.tasks} tasks done`
        : `Epic: ${epicId}`

      const taskContext = tasks.length > 0
        ? `\n\nTasks:\n${tasks.map((t) => `- ${t.id}: ${t.title} [${t.status}]`).join('\n')}`
        : ''

      // Build system prompt
      const systemPrompt = command
        ? getCommandSystemPrompt(command, epicId)
        : `You are helping with the epic "${epicId}". You have access to task management operations. When you want to propose a task mutation, output it in a mutation code block.`

      const fullPrompt = `${systemPrompt}\n\nContext:\n${epicContext}${taskContext}\n\nUser message: ${args || trimmed}`

      // Simulate AI response (in production, this would call the actual AI service)
      // For now, we'll add a placeholder response
      const response = await simulateAIResponse(command, epicId, fullPrompt)

      // Add assistant message
      await addMessage({ role: 'assistant', content: response })

      // Check for mutations in the response
      const mutation = parseMutationFromResponse(response)
      if (mutation) {
        setPendingMutation(mutation)
      }

      // Save messages after adding assistant response
      await saveMessages()
    } catch (error) {
      console.error('[EpicChatPanel] Error processing message:', error)
      await addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [draft, isProcessing, addMessage, setDraft, epic, epicId, tasks, saveMessages])

  // Handle mutation apply
  const handleApplyMutation = React.useCallback(async (mutation: TaskMutation) => {
    setIsApplyingMutation(true)

    try {
      if (mutation.type === 'status_change') {
        // Execute status change via IPC
        await window.electronAPI.flowTaskUpdateStatus(
          workspaceRoot,
          mutation.taskId,
          mutation.toStatus as 'todo' | 'in_progress' | 'blocked' | 'done'
        )

        // Reload tasks to update kanban
        await loadTasks(workspaceRoot, epicId)

        await addMessage({
          role: 'assistant',
          content: `Task "${mutation.taskTitle}" status changed from ${mutation.fromStatus} to ${mutation.toStatus}.`,
        })
      } else if (mutation.type === 'create_task') {
        // Task creation would go here
        await addMessage({
          role: 'assistant',
          content: `Task creation is not yet implemented. Proposed: "${mutation.title}"`,
        })
      }

      setPendingMutation(null)
    } catch (error) {
      console.error('[EpicChatPanel] Error applying mutation:', error)
      await addMessage({
        role: 'assistant',
        content: 'Failed to apply the change. Please try again or make the change manually.',
      })
    } finally {
      setIsApplyingMutation(false)
    }
  }, [workspaceRoot, epicId, loadTasks, addMessage])

  // Handle mutation dismiss
  const handleDismissMutation = React.useCallback(() => {
    setPendingMutation(null)
  }, [])

  // Handle keyboard submit
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // Handle clear history
  const handleClear = React.useCallback(() => {
    if (window.confirm('Clear all chat history for this epic?')) {
      clearHistory()
    }
  }, [clearHistory])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground text-sm">
          Loading chat history...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Epic Chat</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleClear}
          disabled={messages.length === 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" viewportRef={scrollRef as React.RefObject<HTMLDivElement>}>
        <div className="p-3 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Start a conversation about this epic</p>
              <p className="text-xs mt-1">
                Use /plan, /interview, or /review commands
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-muted-foreground text-sm"
            >
              <div className="flex gap-1">
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                  className="w-1.5 h-1.5 rounded-full bg-current"
                />
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
                  className="w-1.5 h-1.5 rounded-full bg-current"
                />
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-current"
                />
              </div>
              <span>Thinking...</span>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Pending mutation */}
      <AnimatePresence>
        {pendingMutation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 pb-2"
          >
            <WriteConfirmation
              mutation={pendingMutation}
              isApplying={isApplyingMutation}
              onApply={handleApplyMutation}
              onDismiss={handleDismissMutation}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="p-3 border-t border-border/50 space-y-2">
        <ChatActionButtons
          onInsertCommand={handleInsertCommand}
          disabled={isProcessing}
        />
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this epic..."
            disabled={isProcessing}
            className="min-h-[60px] max-h-[120px] resize-none"
          />
          <Button
            variant="default"
            size="icon"
            onClick={handleSend}
            disabled={!draft.trim() || isProcessing}
            className="h-[60px] w-10 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── AI Response Simulation ───────────────────────────────────────────────────

/**
 * Simulate AI response for demo purposes.
 * In production, this would call the actual AI service via IPC.
 */
async function simulateAIResponse(
  command: SlashCommand,
  epicId: string,
  _prompt: string
): Promise<string> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000))

  switch (command) {
    case 'plan':
      return `I'll help you plan the epic **${epicId}**.

Based on the context, here's a suggested implementation plan:

1. **Foundation Setup**
   - Set up the basic infrastructure
   - Configure necessary dependencies

2. **Core Implementation**
   - Implement the main features
   - Add error handling

3. **Testing & Polish**
   - Write unit tests
   - Add integration tests
   - Polish the UI

Would you like me to break any of these down into specific tasks?`

    case 'interview':
      return `I have a few questions to better understand the requirements for **${epicId}**:

1. What is the primary user persona for this feature?
2. Are there any specific performance requirements?
3. What's the expected timeline for completion?
4. Are there any dependencies on other features or services?
5. What does "done" look like for this epic?

Please answer any questions you'd like to address, or let me know if you'd like to discuss specific aspects in more detail.`

    case 'review':
      return `Here's my review of the epic **${epicId}**:

**Strengths:**
- Clear scope definition
- Well-structured task breakdown
- Dependencies are properly mapped

**Areas for Improvement:**
- Consider adding more acceptance criteria
- Some tasks might benefit from more detailed descriptions
- Timeline estimates could be refined

**Recommendations:**
1. Add unit test requirements to each task
2. Consider breaking down larger tasks
3. Ensure all edge cases are covered

Overall, the epic is well-structured and ready for implementation.`

    default:
      return `I understand you're asking about the epic **${epicId}**.

I can help you with:
- **/plan** - Generate a detailed implementation plan
- **/interview** - Ask clarifying questions about requirements
- **/review** - Review the current plan and provide feedback

What would you like to do?`
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EpicChatPanel({
  epicId,
  workspaceRoot,
  isOpen,
  onToggle,
  children,
  className,
}: EpicChatPanelProps) {
  // Save draft on blur/unmount
  const draftAtom = epicId ? chatDraftAtomFamily(epicId) : null
  const [draft, setDraft] = useAtom(draftAtom ?? atomWithStorage('__unused__', ''))

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Draft is auto-saved via atomWithStorage
    }
  }, [])

  if (!isOpen) {
    return <div className={cn('h-full', className)}>{children}</div>
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      autoSaveId="epic-chat"
      className={cn('h-full', className)}
    >
      {/* Main content */}
      <ResizablePanel defaultSize={65} minSize={40}>
        {children}
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Chat panel */}
      <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
        <div className="h-full border-l border-border/50 bg-background">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 z-10"
            onClick={onToggle}
          >
            <X className="h-3.5 w-3.5" />
          </Button>

          {epicId ? (
            <ChatContent epicId={epicId} workspaceRoot={workspaceRoot} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">Select an epic to start chatting</p>
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

// ─── Chat Toggle Button ───────────────────────────────────────────────────────

export interface ChatToggleButtonProps {
  isOpen: boolean
  onClick: () => void
  className?: string
}

export function ChatToggleButton({ isOpen, onClick, className }: ChatToggleButtonProps) {
  return (
    <Button
      variant={isOpen ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onClick}
      className={cn('gap-1.5', className)}
    >
      <MessageCircle className="h-4 w-4" />
      <span>Chat</span>
    </Button>
  )
}
