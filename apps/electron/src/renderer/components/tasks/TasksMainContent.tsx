/**
 * TasksMainContent
 *
 * Main content area for the Tasks view.
 * Routes to correct view (List/Kanban/Graph) based on active tab and view mode.
 *
 * Features:
 * - Tab bar for multi-epic navigation
 * - View mode selector (List/Kanban/Graph)
 * - Auto-selects best view based on epic state
 * - Persists view preference per epic
 * - Keeps inactive views mounted (display: none) to preserve state
 */

import * as React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { KanbanSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { EpicTabBar } from './EpicTabBar'
import { ViewModeSelector } from './ViewModeSelector'
import { ListView } from './ListView'
import { KanbanBoard } from './KanbanBoard'
import {
  openTabsAtom,
  activeTabAtom,
  epicsAtom,
  tasksAtomFamily,
  viewModePerEpicAtomFamily,
  setViewModeAtom,
  calculateEpicProgress,
  suggestViewMode,
  isGraphViewAvailable,
  getEffectiveViewMode,
  type ViewMode,
} from '@/atoms/tasks-state'

// Spring transition - snappy
const springTransition = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 49,
}

export interface TasksMainContentProps {
  /** Workspace root for IPC calls */
  workspaceRoot: string
  /** Callback when a task is clicked */
  onTaskClick?: (epicId: string, taskId: string) => void
  /** Callback when "add" tab button is clicked */
  onAddTab?: () => void
  /** Optional className */
  className?: string
}

interface EpicViewContainerProps {
  epicId: string
  workspaceRoot: string
  isActive: boolean
  onTaskClick?: (taskId: string) => void
}

/**
 * Container for a single epic's view.
 * Stays mounted but hidden when inactive to preserve scroll/zoom state.
 * Handles its own view mode state.
 */
function EpicViewContainer({
  epicId,
  workspaceRoot,
  isActive,
  onTaskClick,
}: EpicViewContainerProps) {
  const tasks = useAtomValue(tasksAtomFamily(epicId))
  const userOverride = useAtomValue(viewModePerEpicAtomFamily(epicId))
  const viewMode = getEffectiveViewMode(userOverride, tasks)

  return (
    <div
      className="absolute inset-0"
      style={{ display: isActive ? 'block' : 'none' }}
    >
      {viewMode === 'list' && (
        <ListView
          epicId={epicId}
          workspaceRoot={workspaceRoot}
          onTaskClick={onTaskClick}
          className="h-full"
        />
      )}
      {viewMode === 'kanban' && (
        <KanbanBoard
          epicId={epicId}
          workspaceRoot={workspaceRoot}
          onTaskClick={onTaskClick}
          className="h-full"
        />
      )}
      {viewMode === 'graph' && (
        // Placeholder for dependency graph (task 8)
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p className="text-sm">Dependency graph view coming soon</p>
        </div>
      )}
    </div>
  )
}

/**
 * View selector wrapper that tracks per-epic view mode
 */
function EpicViewSelector({
  epicId,
  onViewChange,
}: {
  epicId: string
  onViewChange?: (mode: ViewMode) => void
}) {
  const tasks = useAtomValue(tasksAtomFamily(epicId))
  const [userOverride, setUserOverride] = useAtom(viewModePerEpicAtomFamily(epicId))
  const setViewMode = useSetAtom(setViewModeAtom)

  const effectiveMode = getEffectiveViewMode(userOverride, tasks)
  const graphAvailable = isGraphViewAvailable(tasks)

  const handleChange = React.useCallback(
    (mode: ViewMode) => {
      setViewMode(epicId, mode)
      onViewChange?.(mode)
    },
    [epicId, setViewMode, onViewChange]
  )

  return (
    <ViewModeSelector
      value={effectiveMode}
      onChange={handleChange}
      graphAvailable={graphAvailable}
    />
  )
}

/**
 * Epic header with title, progress, and view selector
 */
function EpicHeader({ epicId }: { epicId: string }) {
  const epics = useAtomValue(epicsAtom)
  const epic = epics.find((e) => e.id === epicId)

  if (!epic) return null

  const progressPercent = calculateEpicProgress(epic)

  return (
    <div className="px-6 py-4 border-b border-border/50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{epic.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{epic.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <EpicViewSelector epicId={epicId} />
          <Badge
            variant={epic.status === 'done' ? 'secondary' : 'outline'}
            className={cn(
              epic.status === 'done' &&
                'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
            )}
          >
            {epic.status === 'done' ? 'Done' : 'Open'}
          </Badge>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-foreground/5 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              epic.status === 'done'
                ? 'bg-emerald-500'
                : progressPercent > 0
                  ? 'bg-blue-500'
                  : 'bg-transparent'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {epic.done}/{epic.tasks}
        </span>
      </div>
    </div>
  )
}

export function TasksMainContent({
  workspaceRoot,
  onTaskClick,
  onAddTab,
  className,
}: TasksMainContentProps) {
  const openTabs = useAtomValue(openTabsAtom)
  const activeTab = useAtomValue(activeTabAtom)

  // No tabs open - show empty state
  if (openTabs.length === 0 || !activeTab) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-full gap-3 text-muted-foreground',
          className
        )}
      >
        <KanbanSquare className="h-10 w-10 opacity-40" />
        <p className="text-sm font-medium">Tasks</p>
        <p className="text-xs opacity-60">Select an epic to view its tasks</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Tab bar */}
      <EpicTabBar onAddTab={onAddTab} />

      {/* Epic header (for active tab) */}
      <EpicHeader epicId={activeTab} />

      {/* View content area */}
      <div className="flex-1 relative min-h-0">
        {openTabs.map((epicId) => (
          <EpicViewContainer
            key={epicId}
            epicId={epicId}
            workspaceRoot={workspaceRoot}
            isActive={epicId === activeTab}
            onTaskClick={(taskId) => onTaskClick?.(epicId, taskId)}
          />
        ))}
      </div>
    </div>
  )
}
