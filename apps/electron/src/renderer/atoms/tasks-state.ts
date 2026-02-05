/**
 * Tasks State Atoms
 *
 * Jotai atoms for flow-next epic and task management.
 * Provides reactive state for the Tasks navigator panel.
 */

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { atomFamily } from 'jotai-family'
import type { EpicSummary, TaskSummary, TaskStatus, FlowBridgeResult, EpicListResponse, TaskListResponse, CommandSuccess } from '../../shared/flow-schemas'
import type { ActiveFlowProject, RegisteredFlowProject, FlowProjectStatus } from '../../shared/types'

// ─── Flow Project Atoms ──────────────────────────────────────────────────────

/**
 * Active flow project — the currently selected project directory for tasks management.
 * Separate from the auth Workspace concept (useActiveWorkspace).
 * null path = no projects registered.
 */
export const activeFlowProjectAtom = atom<ActiveFlowProject>({
  path: null,
  flowStatus: 'needs-setup',
})

/**
 * Registered flow projects — persisted to localStorage across app restarts.
 * Shape: [{ path, name, addedAt }]
 */
export const registeredFlowProjectsAtom = atomWithStorage<RegisteredFlowProject[]>(
  'flow-registered-projects',
  []
)

/**
 * Action atom: Set the active flow project.
 * Fetches flow status and git info for the selected project.
 * Handles null projectPath gracefully.
 */
export const setActiveFlowProjectAtom = atom(
  null,
  async (_get, set, projectPath: string | null) => {
    if (!projectPath) {
      set(activeFlowProjectAtom, { path: null, flowStatus: 'needs-setup' })
      // Sync FlowWatcher lifecycle (teardown old watcher)
      set(syncFlowWatcherAtom, null)
      return
    }

    // Set path immediately with loading state
    set(activeFlowProjectAtom, { path: projectPath, flowStatus: 'needs-setup' })

    // Sync FlowWatcher lifecycle (teardown old, debounced start for new)
    set(syncFlowWatcherAtom, projectPath)

    try {
      // Check flow status
      const statusResult = await window.electronAPI.flowProjectCheckStatus(projectPath)
      const flowStatus: FlowProjectStatus = statusResult.status

      // Lazily fetch git info
      const gitInfo = await window.electronAPI.getGitInfo(projectPath)

      set(activeFlowProjectAtom, {
        path: projectPath,
        flowStatus,
        gitInfo: gitInfo ?? undefined,
      })
    } catch (err) {
      console.error('[setActiveFlowProjectAtom] Error:', err)
      set(activeFlowProjectAtom, {
        path: projectPath,
        flowStatus: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }
)

/**
 * Action atom: Register a new flow project.
 * Adds to registeredFlowProjectsAtom and optionally sets as active.
 */
export const registerFlowProjectAtom = atom(
  null,
  async (get, set, projectPath: string, name: string, setActive = true) => {
    const existing = get(registeredFlowProjectsAtom)

    // Prevent duplicate registration
    if (existing.some(p => p.path === projectPath)) {
      if (setActive) {
        set(setActiveFlowProjectAtom, projectPath)
      }
      return
    }

    const newProject: RegisteredFlowProject = {
      path: projectPath,
      name,
      addedAt: Date.now(),
    }

    set(registeredFlowProjectsAtom, [...existing, newProject])

    // FlowWatcher lifecycle is managed solely by setActiveFlowProjectAtom → syncFlowWatcherAtom.
    // No direct IPC registration call here to avoid double-registration race condition.
    if (setActive) {
      set(setActiveFlowProjectAtom, projectPath)
    }
  }
)

/**
 * Action atom: Unregister a flow project.
 * Removes from registeredFlowProjectsAtom. Does NOT delete .flow/ on disk.
 */
export const unregisterFlowProjectAtom = atom(
  null,
  async (get, set, projectPath: string) => {
    const existing = get(registeredFlowProjectsAtom)
    const filtered = existing.filter(p => p.path !== projectPath)
    set(registeredFlowProjectsAtom, filtered)

    // Unregister on main process side
    try {
      await window.electronAPI.flowProjectUnregister(projectPath)
    } catch (err) {
      console.error('[unregisterFlowProjectAtom] IPC error:', err)
    }

    // If we just removed the active project, switch to first available or null
    const active = get(activeFlowProjectAtom)
    if (active.path === projectPath) {
      const next = filtered.length > 0 ? filtered[0].path : null
      set(setActiveFlowProjectAtom, next)
    }
  }
)

// ─── FlowWatcher Lifecycle ────────────────────────────────────────────────────

// ─── FlowWatcher Lifecycle ────────────────────────────────────────────────────

/**
 * Internal atom tracking FlowWatcher state.
 * Uses Jotai state instead of module-level variables to survive HMR correctly.
 */
const flowWatcherInternalAtom = atom<{
  previousPath: string | null
  debounceTimer: ReturnType<typeof setTimeout> | null
}>({
  previousPath: null,
  debounceTimer: null,
})

/**
 * Action atom: Manages FlowWatcher lifecycle on project switch.
 * Tears down old watcher, debounces new watcher start (300ms).
 * Called internally by setActiveFlowProjectAtom -- not for external use.
 */
export const syncFlowWatcherAtom = atom(
  null,
  async (get, set, newPath: string | null) => {
    const state = get(flowWatcherInternalAtom)

    // Clear any pending debounce
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer)
    }

    const oldPath = state.previousPath

    // Tear down old watcher immediately
    if (oldPath && oldPath !== newPath) {
      try {
        await window.electronAPI.flowProjectUnregister(oldPath)
      } catch {
        // Best-effort teardown
      }
    }

    // Debounce new watcher start (300ms) to handle rapid switching
    const newTimer = newPath
      ? setTimeout(async () => {
          try {
            // flowProjectRegister starts the watcher on main process side
            await window.electronAPI.flowProjectRegister(newPath, '')
          } catch {
            // Best-effort setup
          }
        }, 300)
      : null

    set(flowWatcherInternalAtom, {
      previousPath: newPath,
      debounceTimer: newTimer,
    })
  }
)

// ─── View Mode Types ──────────────────────────────────────────────────────────

/** Available view modes for epic content */
export type ViewMode = 'list' | 'kanban' | 'graph'

/** Default view mode when no override is set */
export const DEFAULT_VIEW_MODE: ViewMode = 'list'

// ─── Utils ───────────────────────────────────────────────────────────────────

/**
 * Calculate epic progress as a percentage (0-100)
 * Handles edge cases: zero tasks, done status override
 */
export function calculateEpicProgress(epic: EpicSummary): number {
  // If status is done, always return 100 for visual consistency
  if (epic.status === 'done') return 100
  // Avoid division by zero
  if (epic.tasks === 0) return 0
  return Math.round((epic.done / epic.tasks) * 100)
}

// ─── Loading State ───────────────────────────────────────────────────────────

/**
 * Loading state for epics list
 * - 'idle': Not yet fetched
 * - 'loading': Currently fetching
 * - 'success': Successfully loaded
 * - 'error': Failed to load (flowctl not found, no .flow/, etc.)
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export const epicsLoadingStateAtom = atom<LoadingState>('idle')

// ─── Epics ───────────────────────────────────────────────────────────────────

/**
 * Atom to store the list of epics for the current workspace
 */
export const epicsAtom = atom<EpicSummary[]>([])

/**
 * Error message when epics fail to load (e.g., flowctl not found, no .flow/)
 */
export const epicsErrorAtom = atom<string | null>(null)

// ─── Selected Epic ───────────────────────────────────────────────────────────

/**
 * Currently selected epic ID - persisted across sessions
 * Uses atomWithStorage to save to localStorage
 */
export const selectedEpicIdAtom = atomWithStorage<string | null>(
  'tasks-selected-epic-id',
  null
)

// ─── Tab Navigation Atoms ─────────────────────────────────────────────────────
// Note: Defined early so resetTasksStateAtom can reference them

/**
 * Open tabs: ordered array of epic IDs
 * Persisted via atomWithStorage - restores on reload
 */
export const openTabsAtom = atomWithStorage<string[]>(
  'tasks-open-tabs',
  []
)

/**
 * Active (currently visible) tab: epic ID
 * Persisted via atomWithStorage - restores on reload
 */
export const activeTabAtom = atomWithStorage<string | null>(
  'tasks-active-tab',
  null
)

/**
 * View mode override per epic
 * Uses atomFamily for per-epic storage with atomWithStorage for persistence
 */
export const viewModePerEpicAtomFamily = atomFamily(
  (epicId: string) => atomWithStorage<ViewMode | null>(
    `tasks-view-mode-${epicId}`,
    null
  ),
  (a, b) => a === b
)

// ─── Tasks per Epic ──────────────────────────────────────────────────────────

/**
 * Atom family for tasks per epic
 * Each epic has its own atom with its task list
 */
export const tasksAtomFamily = atomFamily(
  (_epicId: string) => atom<TaskSummary[]>([]),
  (a, b) => a === b
)

/**
 * Loading state for tasks per epic
 */
export const tasksLoadingAtomFamily = atomFamily(
  (_epicId: string) => atom<LoadingState>('idle'),
  (a, b) => a === b
)

// ─── Derived Atoms ───────────────────────────────────────────────────────────

/**
 * Get the currently selected epic (full summary object)
 */
export const selectedEpicAtom = atom((get) => {
  const selectedId = get(selectedEpicIdAtom)
  if (!selectedId) return null
  const epics = get(epicsAtom)
  return epics.find(e => e.id === selectedId) ?? null
})

/**
 * Get tasks for the selected epic
 */
export const selectedEpicTasksAtom = atom((get) => {
  const selectedId = get(selectedEpicIdAtom)
  if (!selectedId) return []
  return get(tasksAtomFamily(selectedId))
})

// ─── Action Atoms ────────────────────────────────────────────────────────────

/**
 * Action atom: Load epics from IPC
 */
export const loadEpicsAtom = atom(
  null,
  async (get, set, workspaceRoot: string) => {
    set(epicsLoadingStateAtom, 'loading')
    set(epicsErrorAtom, null)

    try {
      const result: FlowBridgeResult<EpicListResponse> = await window.electronAPI.flowEpicsList(workspaceRoot)

      if (result.ok) {
        set(epicsAtom, result.data.epics)
        set(epicsLoadingStateAtom, 'success')

        const epicIds = result.data.epics.map(e => e.id)

        // Auto-select first epic if none selected
        const currentSelected = get(selectedEpicIdAtom)
        if (!currentSelected && result.data.epics.length > 0) {
          set(selectedEpicIdAtom, result.data.epics[0].id)
        }

        // If selected epic no longer exists, select first available
        if (currentSelected && !epicIds.includes(currentSelected)) {
          set(selectedEpicIdAtom, result.data.epics[0]?.id ?? null)
        }

        // Validate persisted tabs against loaded epics (filter out stale tabs)
        const openTabs = get(openTabsAtom)
        const validTabs = openTabs.filter(id => epicIds.includes(id))
        if (validTabs.length !== openTabs.length) {
          set(openTabsAtom, validTabs)
        }

        // Validate active tab
        const activeTab = get(activeTabAtom)
        if (activeTab && !epicIds.includes(activeTab)) {
          set(activeTabAtom, validTabs[0] ?? null)
          set(selectedEpicIdAtom, validTabs[0] ?? null)
        }
      } else {
        // Handle error
        let errorMsg = 'Failed to load epics'
        if (result.error.type === 'no_project_configured') {
          errorMsg = 'no-project-configured'
        } else if (result.error.type === 'flowctl_not_found') {
          errorMsg = 'flowctl not found - .flow/ may not be initialized'
        } else if (result.error.type === 'command_failed') {
          // Check if it's "no .flow directory" error - use specific exit code
          // flowctl returns exit code 1 with "not found" or "no such" in stderr
          const stderr = result.error.stderr.toLowerCase()
          const isNoFlowDir = result.error.exitCode === 1 && (
            stderr.includes('not found') ||
            stderr.includes('no such') ||
            stderr.includes('does not exist') ||
            stderr.includes('not initialized')
          )
          if (isNoFlowDir) {
            errorMsg = 'no-flow-directory'
          } else {
            errorMsg = result.error.stderr || 'Command failed'
          }
        }
        set(epicsErrorAtom, errorMsg)
        set(epicsAtom, [])
        set(epicsLoadingStateAtom, 'error')
      }
    } catch (err) {
      set(epicsErrorAtom, err instanceof Error ? err.message : 'Unknown error')
      set(epicsAtom, [])
      set(epicsLoadingStateAtom, 'error')
    }
  }
)

/**
 * Action atom: Load tasks for a specific epic
 */
export const loadTasksAtom = atom(
  null,
  async (_get, set, workspaceRoot: string, epicId: string) => {
    set(tasksLoadingAtomFamily(epicId), 'loading')

    try {
      const result: FlowBridgeResult<TaskListResponse> = await window.electronAPI.flowTasksList(workspaceRoot, epicId)

      if (result.ok) {
        set(tasksAtomFamily(epicId), result.data.tasks)
        set(tasksLoadingAtomFamily(epicId), 'success')
      } else {
        set(tasksAtomFamily(epicId), [])
        set(tasksLoadingAtomFamily(epicId), 'error')
      }
    } catch {
      set(tasksAtomFamily(epicId), [])
      set(tasksLoadingAtomFamily(epicId), 'error')
    }
  }
)

/**
 * Action atom: Initialize flow-next in the workspace
 * After successful init, relies on flow:changed event to trigger reload
 * (avoids race condition from duplicate IPC calls)
 */
export const initFlowAtom = atom(
  null,
  async (_get, set, workspaceRoot: string) => {
    set(epicsLoadingStateAtom, 'loading')

    try {
      const result = await window.electronAPI.flowInit(workspaceRoot)

      if (result.ok) {
        // Clear error state - the flow:changed event will trigger a reload
        // Don't manually reload here to avoid race condition with event handler
        set(epicsErrorAtom, null)
        // Set to idle so the flow:changed handler can transition to loading
        set(epicsLoadingStateAtom, 'idle')
      } else {
        set(epicsErrorAtom, 'Failed to initialize flow-next')
        set(epicsLoadingStateAtom, 'error')
      }
    } catch (err) {
      set(epicsErrorAtom, err instanceof Error ? err.message : 'Unknown error')
      set(epicsLoadingStateAtom, 'error')
    }
  }
)

/**
 * Action atom: Reset all tasks state (for workspace changes)
 * Clears selected epic and tab state to prevent cross-workspace bugs
 */
export const resetTasksStateAtom = atom(
  null,
  (_get, set) => {
    set(epicsAtom, [])
    set(epicsLoadingStateAtom, 'idle')
    set(epicsErrorAtom, null)
    // Clear selection on workspace change to prevent cross-workspace selection bugs
    set(selectedEpicIdAtom, null)
    // Clear tab state to prevent stale tabs from previous workspace
    set(openTabsAtom, [])
    set(activeTabAtom, null)
    // Reset active flow project to prevent cross-workspace bugs (project registration persists in localStorage)
    set(activeFlowProjectAtom, { path: null, flowStatus: 'needs-setup' })
  }
)

// ─── Tab Action Atoms ─────────────────────────────────────────────────────────

/**
 * Action atom: Open an epic tab (or activate if already open)
 * Adds to openTabs if not present, sets as activeTab
 */
export const openEpicTabAtom = atom(
  null,
  (get, set, epicId: string) => {
    const openTabs = get(openTabsAtom)

    if (!openTabs.includes(epicId)) {
      // Add new tab at end
      set(openTabsAtom, [...openTabs, epicId])
    }

    // Activate the tab
    set(activeTabAtom, epicId)
    // Also sync with selectedEpicIdAtom for backward compatibility
    set(selectedEpicIdAtom, epicId)
  }
)

/**
 * Action atom: Close an epic tab
 * Removes from openTabs, selects adjacent tab if closing active tab
 */
export const closeEpicTabAtom = atom(
  null,
  (get, set, epicId: string) => {
    const openTabs = get(openTabsAtom)
    const activeTab = get(activeTabAtom)

    const tabIndex = openTabs.indexOf(epicId)
    if (tabIndex === -1) return

    // Remove the tab
    const newTabs = openTabs.filter(id => id !== epicId)
    set(openTabsAtom, newTabs)

    // If closing active tab, select adjacent (prefer next, then previous)
    if (activeTab === epicId) {
      if (newTabs.length === 0) {
        set(activeTabAtom, null)
        set(selectedEpicIdAtom, null)
      } else {
        // Prefer the tab at same index, or the last tab if at end
        const newIndex = Math.min(tabIndex, newTabs.length - 1)
        const newActive = newTabs[newIndex]
        set(activeTabAtom, newActive)
        set(selectedEpicIdAtom, newActive)
      }
    }
  }
)

/**
 * Action atom: Set active tab (switch between open tabs)
 */
export const setActiveTabAtom = atom(
  null,
  (get, set, epicId: string) => {
    const openTabs = get(openTabsAtom)
    if (openTabs.includes(epicId)) {
      set(activeTabAtom, epicId)
      set(selectedEpicIdAtom, epicId)
    }
  }
)

/**
 * Action atom: Set view mode for an epic
 */
export const setViewModeAtom = atom(
  null,
  (_get, set, epicId: string, mode: ViewMode) => {
    set(viewModePerEpicAtomFamily(epicId), mode)
  }
)

// ─── View Mode Selectors ──────────────────────────────────────────────────────

/**
 * Determine the best view mode for an epic based on task count and dependencies
 * - <5 tasks: list view
 * - >=5 tasks: kanban view
 * - Any dependencies: graph available (but not auto-selected)
 */
export function suggestViewMode(tasks: TaskSummary[]): ViewMode {
  if (tasks.length < 5) return 'list'
  return 'kanban'
}

/**
 * Check if graph view should be available (any task has dependencies)
 */
export function isGraphViewAvailable(tasks: TaskSummary[]): boolean {
  return tasks.some(task => task.depends_on && task.depends_on.length > 0)
}

/**
 * Get effective view mode for an epic (user override or auto-suggested)
 */
export function getEffectiveViewMode(
  userOverride: ViewMode | null,
  tasks: TaskSummary[]
): ViewMode {
  if (userOverride !== null) return userOverride
  return suggestViewMode(tasks)
}

// ─── Graph Viewport State ─────────────────────────────────────────────────────

/**
 * Viewport state for dependency graph (zoom, pan position)
 * Matches React Flow's Viewport type
 */
export interface GraphViewport {
  x: number
  y: number
  zoom: number
}

/**
 * Viewport state per epic for the dependency graph
 * Persists zoom/pan position when switching between views/tabs
 */
export const graphViewportPerEpicAtomFamily = atomFamily(
  (_epicId: string) => atom<GraphViewport | null>(null),
  (a, b) => a === b
)

/**
 * Track whether initial fitView has been applied for each epic
 * Prevents fitView from running on every re-render
 */
export const graphInitializedPerEpicAtomFamily = atomFamily(
  (_epicId: string) => atom<boolean>(false),
  (a, b) => a === b
)

/**
 * Track whether dagre layout has been applied for each epic
 * Per-epic state prevents race conditions when switching tabs
 */
export const graphLayoutAppliedPerEpicAtomFamily = atomFamily(
  (_epicId: string) => atom<boolean>(false),
  (a, b) => a === b
)

/**
 * Action atom: Update task status via drag-drop
 * Performs optimistic update with rollback on failure.
 * Shows sonner toast on error.
 *
 * @param workspaceRoot - Workspace path for IPC calls
 * @param epicId - Epic ID the task belongs to (avoids fragile ID parsing)
 * @param taskId - Task ID to update
 * @param newStatus - Target status
 */
export const updateTaskStatusAtom = atom(
  null,
  async (get, set, workspaceRoot: string, epicId: string, taskId: string, newStatus: TaskStatus) => {

    const tasksAtom = tasksAtomFamily(epicId)
    const currentTasks = get(tasksAtom)
    const taskIndex = currentTasks.findIndex((t) => t.id === taskId)

    if (taskIndex === -1) {
      console.error('[updateTaskStatusAtom] Task not found:', taskId)
      return
    }

    const originalTask = currentTasks[taskIndex]
    const originalStatus = originalTask.status

    // Optimistic update
    const updatedTasks = [...currentTasks]
    updatedTasks[taskIndex] = { ...originalTask, status: newStatus }
    set(tasksAtom, updatedTasks)

    try {
      const result: FlowBridgeResult<CommandSuccess> = await window.electronAPI.flowTaskUpdateStatus(
        workspaceRoot,
        taskId,
        newStatus
      )

      if (!result.ok) {
        // Rollback on failure
        const rollbackTasks = [...get(tasksAtom)]
        const rollbackIndex = rollbackTasks.findIndex((t) => t.id === taskId)
        if (rollbackIndex !== -1) {
          rollbackTasks[rollbackIndex] = { ...rollbackTasks[rollbackIndex], status: originalStatus }
          set(tasksAtom, rollbackTasks)
        }

        // Show error toast
        const errorMsg =
          result.error.type === 'command_failed'
            ? result.error.stderr || 'Command failed'
            : result.error.type === 'flowctl_not_found'
              ? 'flowctl not found'
              : 'Failed to update task status'

        // Import toast dynamically to avoid circular dependency
        const { toast } = await import('sonner')
        toast.error('Failed to update task status', {
          description: errorMsg,
        })
      }
    } catch (err) {
      // Rollback on error
      const rollbackTasks = [...get(tasksAtom)]
      const rollbackIndex = rollbackTasks.findIndex((t) => t.id === taskId)
      if (rollbackIndex !== -1) {
        rollbackTasks[rollbackIndex] = { ...rollbackTasks[rollbackIndex], status: originalStatus }
        set(tasksAtom, rollbackTasks)
      }

      // Show error toast
      const { toast } = await import('sonner')
      toast.error('Failed to update task status', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }
)

// ─── Epic Creation Wizard State ───────────────────────────────────────────────

/**
 * Controls visibility of the epic creation wizard dialog.
 * Can be triggered from navigator panel header or tab bar '+' button.
 */
export const epicWizardOpenAtom = atom<boolean>(false)

// ─── AI Suggestion Sidebar State ──────────────────────────────────────────────

/**
 * Controls visibility of the AI suggestion sidebar.
 * Persisted to localStorage so it remembers user preference.
 * Defaults to collapsed (false).
 */
export const suggestionSidebarOpenAtom = atomWithStorage<boolean>(
  'tasks-suggestion-sidebar-open',
  false
)

/**
 * Dismissed suggestions per epic.
 * Each epic has a Set of suggestion IDs that have been dismissed.
 * Persisted to localStorage per epic.
 */
export const dismissedSuggestionsAtomFamily = atomFamily(
  (epicId: string) => atomWithStorage<string[]>(
    `tasks-dismissed-suggestions-${epicId}`,
    []
  ),
  (a, b) => a === b
)

/**
 * Tracks when the "all tasks done" banner has been shown for an epic.
 * Used to prevent repeated prompts.
 */
export const epicReviewPromptShownAtomFamily = atomFamily(
  (epicId: string) => atomWithStorage<boolean>(
    `tasks-epic-review-prompted-${epicId}`,
    false
  ),
  (a, b) => a === b
)
