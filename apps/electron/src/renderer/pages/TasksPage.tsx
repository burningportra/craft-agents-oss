/**
 * TasksPage - Main content panel for Tasks navigator
 *
 * Displays content based on navigation state:
 * - Selected epic: Shows epic info and task list (placeholder for kanban in task 5)
 * - No selection: Shows placeholder
 */

import * as React from 'react'
import { useAtomValue } from 'jotai'
import { KanbanSquare, ListTodo } from 'lucide-react'
import { useNavigationState, isTasksNavigation } from '@/contexts/NavigationContext'
import { selectedEpicAtom, epicsAtom } from '@/atoms/tasks-state'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function TasksPage() {
  const navState = useNavigationState()
  const selectedEpic = useAtomValue(selectedEpicAtom)
  const epics = useAtomValue(epicsAtom)

  // Get the epic from navigation state or from selected atom
  const epicId = isTasksNavigation(navState) && navState.details?.type === 'epic'
    ? navState.details.epicId
    : undefined

  const displayEpic = epicId
    ? epics.find(e => e.id === epicId)
    : selectedEpic

  // No epic selected - show placeholder
  if (!displayEpic) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <KanbanSquare className="h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">Tasks</p>
        <p className="text-xs opacity-60">Select an epic to view its tasks</p>
      </div>
    )
  }

  // Show epic info with task progress (kanban board comes in task 5)
  const progressPercent = displayEpic.tasks > 0
    ? Math.round((displayEpic.done / displayEpic.tasks) * 100)
    : 0

  return (
    <div className="flex flex-col h-full">
      {/* Epic header */}
      <div className="px-6 py-5 border-b border-border/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{displayEpic.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {displayEpic.id}
            </p>
          </div>
          <Badge
            variant={displayEpic.status === 'done' ? 'secondary' : 'outline'}
            className={cn(
              displayEpic.status === 'done' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
            )}
          >
            {displayEpic.status === 'done' ? 'Done' : 'Open'}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 bg-foreground/5 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                displayEpic.status === 'done'
                  ? 'bg-emerald-500'
                  : progressPercent > 0
                    ? 'bg-blue-500'
                    : 'bg-transparent'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">
            {displayEpic.done} / {displayEpic.tasks} tasks
          </span>
        </div>
      </div>

      {/* Task list placeholder - kanban board will be added in task 5 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <ListTodo className="h-8 w-8 opacity-40" />
        <p className="text-sm font-medium">Kanban Board</p>
        <p className="text-xs opacity-60 text-center max-w-xs">
          Task board with drag-and-drop status changes coming soon
        </p>
      </div>
    </div>
  )
}
