import * as React from 'react'
import type { Message } from '@craft-agent/core'
import { cn } from '@/lib/utils'

interface PhaseIndicatorProps {
  message: Message
}

/**
 * PhaseIndicator - Shows the current planning workflow phase
 *
 * Displays a centered badge indicating which phase of the
 * planning workflow the user is currently in.
 */
export function PhaseIndicator({ message }: PhaseIndicatorProps) {
  const phase = message.currentPhase || 'question'

  const phaseConfig: Record<string, { label: string; color: string }> = {
    question: { label: 'Discovery', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    brainstorm: { label: 'Brainstorming', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
    extracting: { label: 'Extracting', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    handoff: { label: 'Review', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
    planning: { label: 'Planning', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  }

  const config = phaseConfig[phase] || { label: phase, color: 'bg-foreground/5 text-foreground' }

  return (
    <div className="flex items-center justify-center py-2">
      <div className={cn(
        'px-3 py-1 rounded-full text-xs font-medium',
        config.color
      )}>
        Phase: {config.label}
      </div>
    </div>
  )
}

/**
 * Memoized version for performance in chat list
 */
export const MemoizedPhaseIndicator = React.memo(PhaseIndicator, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.currentPhase === next.message.currentPhase
  )
})
