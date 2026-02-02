import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WelcomeIntentPickerProps {
  onSelectIntent: (message: string) => void
}

const intents = [
  { key: 'feature', label: 'Build a feature', message: 'I want to build a feature' },
  { key: 'fix', label: 'Fix something', message: 'I need to fix something' },
  { key: 'continue', label: 'Continue previous', message: 'I want to continue where I left off' },
  { key: 'explore', label: 'Just exploring', message: "I'm just exploring the codebase" },
  { key: 'lost', label: "I'm lost", message: "I'm lost and need help getting oriented" },
]

/**
 * WelcomeIntentPicker - Shown in empty sessions before any messages.
 * Lightweight standalone component, not tied to Message types.
 */
export function WelcomeIntentPicker({ onSelectIntent }: WelcomeIntentPickerProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center select-none gap-4">
      <div className="text-center space-y-1">
        <h2 className="text-base font-medium text-foreground">What brought you here today?</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 max-w-sm w-full px-4">
        {intents.map(intent => (
          <Button
            key={intent.key}
            variant="outline"
            size="sm"
            onClick={() => onSelectIntent(intent.message)}
            className={cn(
              'h-auto py-2.5 px-3 text-sm',
              intent.key === 'lost' && 'col-span-2'
            )}
          >
            {intent.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
