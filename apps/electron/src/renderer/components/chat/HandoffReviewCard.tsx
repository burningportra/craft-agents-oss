import * as React from 'react'
import type { Message } from '@craft-agent/core'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CheckCircle2, FileText, AlertTriangle } from 'lucide-react'

interface HandoffReviewCardProps {
  message: Message
  sessionId: string
  isInteractive: boolean
  onReadyToPlan?: () => void
}

/**
 * HandoffReviewCard - Displays extracted planning context for user review
 *
 * Shows:
 * - Decisions made during brainstorming (with confidence levels)
 * - Files that need to be modified/created
 * - Risks identified and their mitigations
 *
 * In future iterations, this will support inline editing.
 */
export function HandoffReviewCard({
  message,
  isInteractive,
  onReadyToPlan
}: HandoffReviewCardProps) {
  const payload = message.handoffPayload

  if (!payload) return null

  const { decisions = [], files = [], risks = [] } = payload

  const confidenceColors = {
    high: 'text-green-600 dark:text-green-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-orange-600 dark:text-orange-400',
  }

  return (
    <div
      className="rounded-[8px] overflow-hidden bg-background shadow-minimal"
      style={{
        backgroundColor: 'var(--background)',
      }}
    >
      <div className="p-4 space-y-4">
        <div className="text-sm font-semibold">Review Planning Context</div>

        {/* Decisions */}
        {decisions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Decisions ({decisions.length})</span>
            </div>
            <div className="space-y-1.5">
              {decisions.map(d => (
                <div
                  key={d.id}
                  className="text-sm border border-border/50 rounded-md p-2.5 bg-foreground/[0.02]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex-1">{d.content}</span>
                    <span className={cn(
                      'text-[10px] font-medium uppercase tracking-wide shrink-0',
                      confidenceColors[d.confidence]
                    )}>
                      {d.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>Files ({files.length})</span>
            </div>
            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="text-sm border border-border/50 rounded-md p-2.5 bg-foreground/[0.02]"
                >
                  <code className="text-xs font-mono">{f.path}</code>
                  <p className="text-xs text-muted-foreground mt-1">{f.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risks */}
        {risks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Risks ({risks.length})</span>
            </div>
            <div className="space-y-1.5">
              {risks.map((r, i) => (
                <div
                  key={i}
                  className="text-sm border border-border/50 rounded-md p-2.5 bg-foreground/[0.02]"
                >
                  <div className="flex items-start gap-1.5">
                    <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide shrink-0">
                      {r.category}:
                    </span>
                    <div className="flex-1 space-y-1">
                      <span className="block">{r.description}</span>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Mitigation:</span> {r.mitigation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action button */}
        {isInteractive && message.handoffEditable && (
          <div className="pt-2 border-t border-border/50">
            <Button
              variant="default"
              size="sm"
              onClick={onReadyToPlan}
              className="w-full"
            >
              Ready to Plan
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Memoized version for performance in chat list
 */
export const MemoizedHandoffReviewCard = React.memo(HandoffReviewCard, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.handoffPayload === next.message.handoffPayload &&
    prev.message.handoffEditable === next.message.handoffEditable &&
    prev.sessionId === next.sessionId &&
    prev.isInteractive === next.isInteractive
  )
})
