import * as React from 'react'
import type { Message } from '@craft-agent/core'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface IntentPickerCardProps {
  message: Message
  sessionId: string
  isInteractive: boolean
  onSelectIntent?: (intent: string) => void
}

/**
 * IntentPickerCard - Inline intent selection UI in chat
 *
 * Renders a card with buttons for different task intents:
 * - feature: Building a new feature
 * - fix: Fixing a bug
 * - continue: Continuing previous work
 * - explore: Exploring/investigating
 * - lost: Need help getting oriented
 */
export function IntentPickerCard({
  message,
  isInteractive,
  onSelectIntent
}: IntentPickerCardProps) {
  const intents = message.intentOptions || ['feature', 'fix', 'continue', 'explore', 'lost']
  const selected = message.intentSelected

  const handleSelect = (intent: string) => {
    if (!isInteractive || selected !== undefined) return
    onSelectIntent?.(intent)
  }

  // Intent display labels and descriptions
  const intentConfig: Record<string, { label: string; description: string }> = {
    feature: { label: 'Build a feature', description: 'Build something new' },
    fix: { label: 'Fix something', description: 'Fix a bug or issue' },
    continue: { label: 'Continue previous', description: 'Pick up previous work' },
    explore: { label: 'Just exploring', description: 'Investigate or research' },
    lost: { label: "I'm lost", description: 'Need orientation' },
  }

  return (
    <div
      className="rounded-[8px] overflow-hidden bg-background shadow-minimal"
      style={{
        backgroundColor: 'var(--background)',
      }}
    >
      <div className="p-4 space-y-3">
        <div className="text-sm font-medium">What are you working on?</div>

        <div className="grid grid-cols-2 gap-2">
          {intents.map(intent => {
            const config = intentConfig[intent] || { label: intent, description: '' }
            const isSelected = selected === intent

            return (
              <Button
                key={intent}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSelect(intent)}
                disabled={!isInteractive || (selected !== undefined && !isSelected)}
                className={cn(
                  'h-auto flex-col items-start gap-0.5 py-2',
                  isSelected && 'ring-2 ring-foreground ring-offset-2'
                )}
              >
                <span className="font-medium">{config.label}</span>
                <span className={cn(
                  'text-[10px] font-normal',
                  isSelected ? 'opacity-90' : 'text-muted-foreground'
                )}>
                  {config.description}
                </span>
              </Button>
            )
          })}
        </div>

        {selected && (
          <div className="text-xs text-muted-foreground mt-2">
            Selected: <span className="font-medium">{intentConfig[selected]?.label || selected}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Memoized version for performance in chat list
 */
export const MemoizedIntentPickerCard = React.memo(IntentPickerCard, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.intentSelected === next.message.intentSelected &&
    prev.sessionId === next.sessionId &&
    prev.isInteractive === next.isInteractive
  )
})
