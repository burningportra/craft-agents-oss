/**
 * TasksNavigatorPanel
 *
 * Navigator panel content for the Tasks view.
 * Shows a list of epics with progress indicators, or empty state if no .flow/ exists.
 *
 * Features:
 * - Epic list with progress bars
 * - Empty state with Initialize button
 * - Loading state
 * - Live updates via flow:changed event subscription
 */

import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EpicListItem } from './EpicListItem'
import { TasksEmptyState } from './TasksEmptyState'
import {
  epicsAtom,
  epicsLoadingStateAtom,
  epicsErrorAtom,
  selectedEpicIdAtom,
  loadEpicsAtom,
  initFlowAtom,
  resetTasksStateAtom,
} from '@/atoms/tasks-state'
import { cn } from '@/lib/utils'

export interface TasksNavigatorPanelProps {
  /** Workspace root path for IPC calls */
  workspaceRoot: string | undefined
  /** Callback when an epic is selected */
  onEpicSelect: (epicId: string) => void
  /** Optional className */
  className?: string
}

export function TasksNavigatorPanel({
  workspaceRoot,
  onEpicSelect,
  className,
}: TasksNavigatorPanelProps) {
  const epics = useAtomValue(epicsAtom)
  const loadingState = useAtomValue(epicsLoadingStateAtom)
  const error = useAtomValue(epicsErrorAtom)
  const [selectedEpicId, setSelectedEpicId] = useAtom(selectedEpicIdAtom)
  const loadEpics = useSetAtom(loadEpicsAtom)
  const initFlow = useSetAtom(initFlowAtom)
  const resetTasksState = useSetAtom(resetTasksStateAtom)

  // Track whether we're initializing (for button disabled state)
  const [isInitializing, setIsInitializing] = React.useState(false)

  // Load epics on mount and workspace change
  React.useEffect(() => {
    if (!workspaceRoot) {
      resetTasksState()
      return
    }

    loadEpics(workspaceRoot)
  }, [workspaceRoot, loadEpics, resetTasksState])

  // Subscribe to flow:changed events for live updates
  React.useEffect(() => {
    if (!workspaceRoot) return

    const cleanup = window.electronAPI.onFlowChanged((changedWorkspaceRoot, payload) => {
      // Only reload if the change is for our workspace
      if (changedWorkspaceRoot === workspaceRoot) {
        console.log('[TasksNavigatorPanel] flow:changed event received:', payload)
        loadEpics(workspaceRoot)
      }
    })

    return cleanup
  }, [workspaceRoot, loadEpics])

  // Handle Initialize button click
  const handleInitialize = React.useCallback(async () => {
    if (!workspaceRoot) return

    setIsInitializing(true)
    try {
      await initFlow(workspaceRoot)
      // Reload epics after init (the flow:changed event may also trigger this)
      await loadEpics(workspaceRoot)
    } finally {
      setIsInitializing(false)
    }
  }, [workspaceRoot, initFlow, loadEpics])

  // Handle epic selection
  const handleEpicClick = React.useCallback((epicId: string) => {
    setSelectedEpicId(epicId)
    onEpicSelect(epicId)
  }, [setSelectedEpicId, onEpicSelect])

  // Loading state
  if (loadingState === 'loading' && epics.length === 0) {
    return (
      <div className={cn('flex flex-col flex-1 items-center justify-center gap-2', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading epics...</span>
      </div>
    )
  }

  // Error state or no epics - show empty state
  if (loadingState === 'error' || (loadingState === 'success' && epics.length === 0)) {
    return (
      <TasksEmptyState
        onInitialize={handleInitialize}
        isInitializing={isInitializing}
        error={error}
        className={className}
      />
    )
  }

  // Epic list
  return (
    <div className={cn('flex flex-col flex-1 min-h-0', className)}>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {epics.map((epic) => (
            <EpicListItem
              key={epic.id}
              epic={epic}
              isSelected={selectedEpicId === epic.id}
              onClick={() => handleEpicClick(epic.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
