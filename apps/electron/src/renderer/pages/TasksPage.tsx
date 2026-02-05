/**
 * TasksPage - Main content panel for Tasks navigator
 *
 * Displays tab-based multi-epic navigation with adaptive view selection.
 * Features:
 * - Tab bar for multiple open epics
 * - Auto-selects best view (list/kanban/graph) based on epic state
 * - User can override view with segmented control
 * - Persists tab and view state across sessions
 * - Epic creation wizard (Quick/Standard/Complex templates)
 * - Onboarding wizard for new projects (when flowStatus === 'needs-setup')
 * - OS notifications for task events
 */

import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useNavigationState, isTasksNavigation } from '@/contexts/NavigationContext'
import { useActiveWorkspace } from '@/context/AppShellContext'
import { TasksMainContent } from '@/components/tasks/TasksMainContent'
import { EpicCreationWizard } from '@/components/tasks/EpicCreationWizard'
import { OnboardingWizard } from '@/components/tasks/OnboardingWizard'
import {
  useFlowNotifications,
  useTaskCompletionNotifications,
  useEpicReviewReadyNotifications,
} from '@/hooks/useFlowNotifications'
import { epicsAtom, activeTabAtom, openEpicTabAtom, epicWizardOpenAtom, activeFlowProjectAtom } from '@/atoms/tasks-state'
import { navigate, routes } from '@/lib/navigate'

export function TasksPage() {
  const navState = useNavigationState()
  const workspace = useActiveWorkspace()
  const epics = useAtomValue(epicsAtom)
  const activeEpicId = useAtomValue(activeTabAtom)
  const openEpicTab = useSetAtom(openEpicTabAtom)

  // Project path for flow-next (where .flow/ lives) — derived from activeFlowProjectAtom.
  // Falls back to workspace.rootPath if no active flow project is set.
  const activeFlowProject = useAtomValue(activeFlowProjectAtom)
  const projectPath = activeFlowProject.path ?? workspace?.rootPath ?? null

  const workspaceRoot = projectPath
  const workspaceId = workspace?.id ?? null

  // Wizard dialog state - using atom so it can be triggered from AppShell header too
  const [wizardOpen, setWizardOpen] = useAtom(epicWizardOpenAtom)

  // Onboarding wizard state — show when project needs setup
  const showOnboardingWizard = activeFlowProject.flowStatus === 'needs-setup' && !!projectPath
  const [onboardingDismissed, setOnboardingDismissed] = React.useState(false)

  // Flow notifications setup
  const { requestNotification } = useFlowNotifications({
    onNavigateToEpic: React.useCallback((epicId: string) => {
      openEpicTab(epicId)
    }, [openEpicTab]),
    onNavigateToTask: React.useCallback((epicId: string, taskId: string) => {
      openEpicTab(epicId)
      // Task detail navigation handled by TasksMainContent
    }, [openEpicTab]),
    enabled: !!workspaceId,
  })

  // Task completion notifications - watch active epic for task completions
  useTaskCompletionNotifications(
    workspaceId,
    activeEpicId,
    React.useCallback((taskId: string, taskTitle: string) => {
      if (!workspaceId || !activeEpicId) return
      requestNotification({
        type: 'task_completed',
        title: 'Task Completed',
        body: taskTitle,
        workspaceId,
        epicId: activeEpicId,
        taskId,
        priority: 'low',
      })
    }, [workspaceId, activeEpicId, requestNotification])
  )

  // Epic review ready notifications - watch for all tasks done
  useEpicReviewReadyNotifications(
    workspaceId,
    activeEpicId,
    React.useCallback((epicId: string, epicTitle: string) => {
      if (!workspaceId) return
      requestNotification({
        type: 'epic_review_ready',
        title: 'Epic Ready for Review',
        body: `All tasks complete: ${epicTitle}`,
        workspaceId,
        epicId,
        priority: 'low',
      })
    }, [workspaceId, requestNotification])
  )

  // Handle task click - could open detail panel (task 7)
  const handleTaskClick = React.useCallback((epicId: string, taskId: string) => {
    console.log('[TasksPage] Task clicked:', { epicId, taskId })
    // Task detail panel is implemented in task 7
  }, [])

  // Handle add tab click - opens epic creation wizard
  const handleAddTab = React.useCallback(() => {
    setWizardOpen(true)
  }, [])

  // Handle epic created - navigate to the new epic
  const handleEpicCreated = React.useCallback((epicId: string) => {
    // Open the new epic in a tab and navigate to it
    openEpicTab(epicId)
    navigate(routes.view.epicDetail(epicId))
  }, [openEpicTab])

  // Handle opening split-view chat (for complex epics - task 10)
  const handleOpenChat = React.useCallback((epicId: string) => {
    console.log('[TasksPage] Opening chat for epic:', epicId)
    // Split-view chat will be implemented in task 10
  }, [])

  // Handle onboarding wizard completion
  const handleOnboardingComplete = React.useCallback(() => {
    setOnboardingDismissed(true)
  }, [])

  if (!workspaceRoot) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">No workspace selected</p>
      </div>
    )
  }

  return (
    <>
      <TasksMainContent
        workspaceRoot={workspaceRoot}
        onTaskClick={handleTaskClick}
        onAddTab={handleAddTab}
        className="h-full"
      />

      {/* Epic Creation Wizard */}
      <EpicCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        workspaceRoot={workspaceRoot}
        epics={epics}
        onEpicCreated={handleEpicCreated}
        onOpenChat={handleOpenChat}
      />

      {/* Onboarding Wizard — shown when project needs setup */}
      <OnboardingWizard
        open={showOnboardingWizard && !onboardingDismissed}
        onOpenChange={(open) => {
          if (!open) setOnboardingDismissed(true)
        }}
        projectPath={workspaceRoot}
        onComplete={handleOnboardingComplete}
      />
    </>
  )
}
