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
 * - OS notifications for task events
 */

import * as React from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useNavigationState, isTasksNavigation } from '@/contexts/NavigationContext'
import { useActiveWorkspace } from '@/context/AppShellContext'
import { TasksMainContent } from '@/components/tasks/TasksMainContent'
import { EpicCreationWizard } from '@/components/tasks/EpicCreationWizard'
import { OnboardingTutorial, useOnboardingComplete, markOnboardingComplete } from '@/components/tasks/OnboardingTutorial'
import {
  useFlowNotifications,
  useTaskCompletionNotifications,
  useEpicReviewReadyNotifications,
} from '@/hooks/useFlowNotifications'
import { epicsAtom, epicsLoadingStateAtom, activeTabAtom, openEpicTabAtom, epicWizardOpenAtom } from '@/atoms/tasks-state'
import { navigate, routes } from '@/lib/navigate'

/** Delay (ms) before showing tutorial after initialization - allows UI to settle */
const TUTORIAL_TRIGGER_DELAY_MS = 500

export function TasksPage() {
  const navState = useNavigationState()
  const workspace = useActiveWorkspace()
  const epics = useAtomValue(epicsAtom)
  const epicsLoadingState = useAtomValue(epicsLoadingStateAtom)
  const activeEpicId = useAtomValue(activeTabAtom)
  const openEpicTab = useSetAtom(openEpicTabAtom)

  // Project path for flow-next (where .flow/ lives) - uses process.cwd() from main process
  // Falls back to workspace.rootPath if getCwd is unavailable or fails
  const [projectPath, setProjectPath] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (typeof window.electronAPI?.getCwd === 'function') {
      window.electronAPI.getCwd()
        .then(setProjectPath)
        .catch((err) => {
          console.error('[TasksPage] Failed to get cwd, falling back to workspace.rootPath:', err)
          setProjectPath(workspace?.rootPath ?? null)
        })
    } else {
      // getCwd not available (old preload), fall back to workspace.rootPath
      console.warn('[TasksPage] getCwd not available, using workspace.rootPath')
      setProjectPath(workspace?.rootPath ?? null)
    }
  }, [workspace?.rootPath])

  const workspaceRoot = projectPath
  const workspaceId = workspace?.id ?? null

  // Wizard dialog state - using atom so it can be triggered from AppShell header too
  const [wizardOpen, setWizardOpen] = useAtom(epicWizardOpenAtom)

  // Onboarding tutorial state
  const isOnboardingComplete = useOnboardingComplete()
  const [showTutorial, setShowTutorial] = React.useState(false)
  const previousLoadingStateRef = React.useRef<string | null>(null)
  // Track if we just did a fresh initialization (to trigger tutorial even with example epics)
  const justInitializedRef = React.useRef(false)

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

  // Trigger tutorial after first successful .flow/ initialization
  // Detected by: loading state transitions from 'error' (no-flow-directory) to 'success'
  // Note: flowctl init may create example epics, so we don't check epics.length === 0
  React.useEffect(() => {
    const prevState = previousLoadingStateRef.current

    // Detect fresh initialization: transition from error to success
    // This happens when user clicks "Initialize Flow-Next" in TasksEmptyState
    if (
      !isOnboardingComplete &&
      epicsLoadingState === 'success' &&
      (prevState === 'error' || prevState === 'idle')
    ) {
      justInitializedRef.current = true
      // Delay to let the UI settle after loading completes
      const timer = setTimeout(() => {
        setShowTutorial(true)
      }, TUTORIAL_TRIGGER_DELAY_MS)
      return () => clearTimeout(timer)
    }

    previousLoadingStateRef.current = epicsLoadingState
  }, [epicsLoadingState, isOnboardingComplete])

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

  // Handle tutorial completion
  const handleTutorialComplete = React.useCallback(() => {
    setShowTutorial(false)
  }, [])

  // Handle create epic from tutorial - opens wizard
  const handleTutorialCreateEpic = React.useCallback(() => {
    setWizardOpen(true)
  }, [setWizardOpen])

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

      {/* Onboarding Tutorial */}
      <OnboardingTutorial
        isActive={showTutorial}
        onComplete={handleTutorialComplete}
        onCreateEpic={handleTutorialCreateEpic}
      />
    </>
  )
}
