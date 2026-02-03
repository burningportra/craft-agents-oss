/**
 * StandardInterviewStep
 *
 * Standard epic creation: 6-question structured form.
 * Part of the EpicCreationWizard flow.
 *
 * Questions:
 * 1. Title (required)
 * 2. Description / problem statement
 * 3. Acceptance criteria (textarea, one per line)
 * 4. Dependencies on other epics (optional dropdown)
 * 5. Estimated complexity (S/M/L selector)
 * 6. Technical notes / constraints
 */

import * as React from 'react'
import { ClipboardList, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { EpicSummary } from '../../../shared/flow-schemas'

export type EpicComplexity = 'S' | 'M' | 'L'

export interface StandardEpicFormData {
  title: string
  description: string
  acceptanceCriteria: string
  dependsOnEpic: string | null
  complexity: EpicComplexity
  technicalNotes: string
}

export interface StandardInterviewStepProps {
  /** Available epics for dependency selection */
  epics: EpicSummary[]
  /** Callback when user goes back to template selection */
  onBack: () => void
  /** Callback to create the epic */
  onCreate: (data: StandardEpicFormData) => Promise<void>
  /** Whether creation is in progress */
  isCreating: boolean
  /** Error message if creation failed */
  error: string | null
  /** Callback to clear error */
  onClearError?: () => void
  /** Optional className */
  className?: string
}

const COMPLEXITY_OPTIONS: { value: EpicComplexity; label: string; description: string }[] = [
  { value: 'S', label: 'Small', description: '1-3 tasks, few hours' },
  { value: 'M', label: 'Medium', description: '4-8 tasks, 1-3 days' },
  { value: 'L', label: 'Large', description: '9+ tasks, week+' },
]

export function StandardInterviewStep({
  epics,
  onBack,
  onCreate,
  isCreating,
  error,
  onClearError,
  className,
}: StandardInterviewStepProps) {
  const [formData, setFormData] = React.useState<StandardEpicFormData>({
    title: '',
    description: '',
    acceptanceCriteria: '',
    dependsOnEpic: null,
    complexity: 'M',
    technicalNotes: '',
  })

  const titleInputRef = React.useRef<HTMLInputElement>(null)

  // Focus title input on mount
  React.useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  // Update form field
  const updateField = <K extends keyof StandardEpicFormData>(
    field: K,
    value: StandardEpicFormData[K]
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

  // Filter out done epics for dependency selection
  const availableEpics = epics.filter((e) => e.status !== 'done')

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex flex-col items-center w-full max-w-lg', className)}
    >
      {/* Icon */}
      <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-blue-500/10">
        <ClipboardList className="size-7 text-blue-500" />
      </div>

      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold">Standard Epic</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Fill out the details to create a well-structured epic.
        </p>
      </div>

      {/* Form */}
      <ScrollArea className="w-full max-h-[400px] pr-4">
        <div className="w-full space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="epic-title" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              ref={titleInputRef}
              id="epic-title"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="e.g., User Authentication System"
              disabled={isCreating}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="epic-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="epic-description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe the problem this epic solves..."
              className="min-h-[80px] resize-none"
              disabled={isCreating}
            />
          </div>

          {/* Acceptance Criteria */}
          <div className="space-y-2">
            <Label htmlFor="epic-acceptance" className="text-sm font-medium">
              Acceptance Criteria
            </Label>
            <Textarea
              id="epic-acceptance"
              value={formData.acceptanceCriteria}
              onChange={(e) => updateField('acceptanceCriteria', e.target.value)}
              placeholder="One criterion per line..."
              className="min-h-[80px] resize-none font-mono text-sm"
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              Enter each criterion on a new line
            </p>
          </div>

          {/* Complexity & Dependencies Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Complexity */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Complexity</Label>
              <Select
                value={formData.complexity}
                onValueChange={(v) => updateField('complexity', v as EpicComplexity)}
                disabled={isCreating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {COMPLEXITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-muted-foreground text-xs">
                          ({opt.description})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dependencies */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Depends On</Label>
              <Select
                value={formData.dependsOnEpic ?? ''}
                onValueChange={(v) => updateField('dependsOnEpic', v || null)}
                disabled={isCreating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {availableEpics.map((epic) => (
                    <SelectItem key={epic.id} value={epic.id}>
                      {epic.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Technical Notes */}
          <div className="space-y-2">
            <Label htmlFor="epic-tech-notes" className="text-sm font-medium">
              Technical Notes
            </Label>
            <Textarea
              id="epic-tech-notes"
              value={formData.technicalNotes}
              onChange={(e) => updateField('technicalNotes', e.target.value)}
              placeholder="Any technical constraints or considerations..."
              className="min-h-[60px] resize-none"
              disabled={isCreating}
            />
          </div>
        </div>
      </ScrollArea>

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
            'Create Epic'
          )}
        </Button>
      </div>
    </form>
  )
}
