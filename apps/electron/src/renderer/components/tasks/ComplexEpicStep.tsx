/**
 * ComplexEpicStep
 *
 * Complex epic creation: creates an epic shell and opens split-view chat
 * for a deep AI-assisted interview.
 * Part of the EpicCreationWizard flow.
 *
 * Features:
 * - Title and brief description input
 * - Creates epic shell immediately
 * - Opens split-view chat for detailed planning (task 10)
 */

import * as React from 'react'
import { MessageSquarePlus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export interface ComplexEpicFormData {
  title: string
  description: string
}

export interface ComplexEpicStepProps {
  /** Callback when user goes back to template selection */
  onBack: () => void
  /** Callback to create the epic shell and open chat */
  onCreate: (data: ComplexEpicFormData) => Promise<void>
  /** Whether creation is in progress */
  isCreating: boolean
  /** Error message if creation failed */
  error: string | null
  /** Callback to clear error */
  onClearError?: () => void
  /** Optional className */
  className?: string
}

export function ComplexEpicStep({
  onBack,
  onCreate,
  isCreating,
  error,
  onClearError,
  className,
}: ComplexEpicStepProps) {
  const [formData, setFormData] = React.useState<ComplexEpicFormData>({
    title: '',
    description: '',
  })

  const titleInputRef = React.useRef<HTMLInputElement>(null)

  // Focus title input on mount
  React.useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  // Update form field
  const updateField = <K extends keyof ComplexEpicFormData>(
    field: K,
    value: ComplexEpicFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (error) {
      onClearError?.()
    }
  }

  // Handle form submit
  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!formData.title.trim() || isCreating) return
      await onCreate(formData)
    },
    [formData, isCreating, onCreate]
  )

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex flex-col items-center w-full max-w-md', className)}
    >
      {/* Icon */}
      <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-violet-500/10">
        <MessageSquarePlus className="size-7 text-violet-500" />
      </div>

      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold">Complex Epic</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Start with a title and description. Then dive deep with an AI-assisted planning session.
        </p>
      </div>

      {/* Form */}
      <div className="w-full space-y-5">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="complex-epic-title" className="text-sm font-medium">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            ref={titleInputRef}
            id="complex-epic-title"
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="e.g., Complete Platform Redesign"
            disabled={isCreating}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="complex-epic-description" className="text-sm font-medium">
            Initial Description
          </Label>
          <Textarea
            id="complex-epic-description"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Briefly describe what you want to accomplish. We'll explore the details together in a chat session..."
            className="min-h-[120px] resize-none"
            disabled={isCreating}
          />
        </div>

        {/* Info box */}
        <div className="rounded-lg bg-violet-500/5 border border-violet-500/10 p-4">
          <p className="text-sm text-muted-foreground">
            After creating the epic shell, a split-view chat will open where you can work with AI to:
          </p>
          <ul className="mt-2 text-sm text-muted-foreground space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-violet-500">-</span>
              Explore requirements and edge cases
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-500">-</span>
              Break down into well-scoped tasks
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-500">-</span>
              Define dependencies and priorities
            </li>
          </ul>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive mt-4 w-full">{error}</p>
      )}

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
          disabled={!formData.title.trim() || isCreating}
        >
          {isCreating ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Create & Start Chat
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
