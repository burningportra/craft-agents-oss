/**
 * TasksPage - Main content panel for Tasks navigator
 *
 * Displays tab-based multi-epic navigation with adaptive view selection.
 * Features:
 * - Tab bar for multiple open epics
 * - Auto-selects best view (list/kanban/graph) based on epic state
 * - User can override view with segmented control
 * - Persists tab and view state across sessions
 */

import * as React from 'react'
import { useNavigationState, isTasksNavigation } from '@/contexts/NavigationContext'
import { useActiveWorkspace } from '@/context/AppShellContext'
import { TasksMainContent } from '@/components/tasks/TasksMainContent'

export function TasksPage() {
  const navState = useNavigationState()
  const workspace = useActiveWorkspace()

  const workspaceRoot = workspace?.rootPath

  // Handle task click - could open detail panel (task 7)
  const handleTaskClick = React.useCallback((epicId: string, taskId: string) => {
    console.log('[TasksPage] Task clicked:', { epicId, taskId })
    // Task detail panel will be implemented in task 7
  }, [])

  // Handle add tab click - could open epic creation wizard (task 9)
  const handleAddTab = React.useCallback(() => {
    console.log('[TasksPage] Add tab clicked')
    // Epic creation wizard will be implemented in task 9
  }, [])

  if (!workspaceRoot) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">No workspace selected</p>
      </div>
    )
  }

  return (
    <TasksMainContent
      workspaceRoot={workspaceRoot}
      onTaskClick={handleTaskClick}
      onAddTab={handleAddTab}
      className="h-full"
    />
  )
}
