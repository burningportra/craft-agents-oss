/**
 * QuickEpicStep
 *
 * Quick epic creation: single text input that creates an epic from a one-liner.
 * Part of the EpicCreationWizard flow.
 *
 * Features:
 * - Single textarea for epic description
 * - Auto-generates title from description
 * - Creates epic immediately on submit
 */

import * as React from 'react'
import { Zap, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export interface QuickEpicStepProps {
  /** Callback when user goes back to template selection */
  onBack: () => void
  /** Callback to create the epic */
  onCreate: (description: string) => Promise<void>
  /** Whether creation is in progress */
  isCreating: boolean
  /** Error message if creation failed */
  error: string | null
  /** Callback to clear error */
  onClearError?: () => void
  /** Optional className */
  className?: string
}

export function QuickEpicStep({
  onBack,
  onCreate,
  isCreating,
  error,
  onClearError,
  className,
}: QuickEpicStepProps) {
  const [description, setDescription] = React.useState('')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // Focus textarea on mount
  React.useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Handle form submit
  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!description.trim() || isCreating) return
      await onCreate(description.trim())
    },
    [description, isCreating, onCreate]
  )

  // Handle Cmd/Ctrl+Enter to submit
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (description.trim() && !isCreating) {
          onCreate(description.trim())
        }
      }
    },
    [description, isCreating, onCreate]
  )

  // Clear error when description changes
  React.useEffect(() => {
    if (error && description) {
      onClearError?.()
    }
  }, [description, error, onClearError])

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex flex-col items-center w-full max-w-md', className)}
    >
      {/* Icon */}
      <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-amber-500/10">
        <Zap className="size-7 text-amber-500" />
      </div>

      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold">Quick Epic</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Describe your epic in a sentence. We'll create it instantly.
        </p>
      </div>

      {/* Input */}
      <div className="w-full space-y-4">
        <Textarea
          ref={textareaRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., Add user authentication with OAuth support"
          className="min-h-[100px] resize-none"
          disabled={isCreating}
        />

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Hint */}
        <p className="text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 rounded bg-foreground/5 font-mono text-xs">Cmd+Enter</kbd> to create
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 w-full mt-6">
        <Button
          type="button"
          variant="ghost"
          className="flex-1 bg-foreground-2"
          onClick={onBack}
          disabled={isCreating}
        >
          Back
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={!description.trim() || isCreating}
        >
          {isCreating ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Epic'
          )}
        </Button>
      </div>
    </form>
  )
}
