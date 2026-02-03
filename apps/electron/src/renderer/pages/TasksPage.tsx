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
 * - Onboarding tutorial for first-time users
 */

import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useNavigationState, isTasksNavigation } from '@/contexts/NavigationContext'
import { useActiveWorkspace } from '@/context/AppShellContext'
import { TasksMainContent } from '@/components/tasks/TasksMainContent'
import { EpicCreationWizard } from '@/components/tasks/EpicCreationWizard'
import { OnboardingTutorial, useOnboardingComplete, markOnboardingComplete } from '@/components/tasks/OnboardingTutorial'
import { epicsAtom, epicsLoadingStateAtom, openEpicTabAtom, epicWizardOpenAtom } from '@/atoms/tasks-state'
import { navigate, routes } from '@/lib/navigate'

export function TasksPage() {
  const navState = useNavigationState()
  const workspace = useActiveWorkspace()
  const epics = useAtomValue(epicsAtom)
  const epicsLoadingState = useAtomValue(epicsLoadingStateAtom)
  const openEpicTab = useSetAtom(openEpicTabAtom)

  const workspaceRoot = workspace?.rootPath

  // Wizard dialog state - using atom so it can be triggered from AppShell header too
  const [wizardOpen, setWizardOpen] = useAtom(epicWizardOpenAtom)

  // Onboarding tutorial state
  const isOnboardingComplete = useOnboardingComplete()
  const [showTutorial, setShowTutorial] = React.useState(false)
  const previousLoadingStateRef = React.useRef<string | null>(null)

  // Trigger tutorial after first successful .flow/ initialization
  // Detected by: loading state transitions from 'error' (no-flow-directory) to 'success'
  React.useEffect(() => {
    const prevState = previousLoadingStateRef.current

    // Check if we just transitioned from error/idle to success with 0 epics
    // This indicates a fresh initialization
    if (
      !isOnboardingComplete &&
      epicsLoadingState === 'success' &&
      epics.length === 0 &&
      (prevState === 'error' || prevState === 'idle')
    ) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        setShowTutorial(true)
      }, 500)
      return () => clearTimeout(timer)
    }

    previousLoadingStateRef.current = epicsLoadingState
  }, [epicsLoadingState, epics.length, isOnboardingComplete])

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

  if (!workspaceRoot) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">No workspace selected</p>
      </div>
    )
  }

  // Handle tutorial completion
  const handleTutorialComplete = React.useCallback(() => {
    setShowTutorial(false)
  }, [])

  // Handle create epic from tutorial - opens wizard
  const handleTutorialCreateEpic = React.useCallback(() => {
    setWizardOpen(true)
  }, [setWizardOpen])

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

      {/* Onboarding Tutorial */}
      <OnboardingTutorial
        isActive={showTutorial}
        onComplete={handleTutorialComplete}
        onCreateEpic={handleTutorialCreateEpic}
      />
    </>
  )
}
