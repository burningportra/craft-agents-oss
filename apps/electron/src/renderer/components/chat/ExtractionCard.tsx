import * as React from 'react'
import type { Message } from '@craft-agent/core'
import { Spinner } from '@craft-agent/ui'

interface ExtractionCardProps {
  message: Message
}

/**
 * ExtractionCard - Shows extraction progress indicator
 *
 * Displays a spinner with phase-appropriate message while
 * the agent extracts planning context from the conversation.
 */
export function ExtractionCard({ message }: ExtractionCardProps) {
  const phase = message.extractionPhase || 'analyzing'

  const phaseLabels = {
    analyzing: 'Analyzing conversation...',
    extracting: 'Extracting planning context...',
    validating: 'Validating decisions...',
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
      <Spinner className="text-xs" />
      <span>{phaseLabels[phase]}</span>
    </div>
  )
}

/**
 * Memoized version for performance in chat list
 */
export const MemoizedExtractionCard = React.memo(ExtractionCard, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.extractionPhase === next.message.extractionPhase
  )
})
