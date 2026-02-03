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

        // Auto-select first epic if none selected
        const currentSelected = get(selectedEpicIdAtom)
        if (!currentSelected && result.data.epics.length > 0) {
          set(selectedEpicIdAtom, result.data.epics[0].id)
        }

        // If selected epic no longer exists, select first available
        if (currentSelected && !result.data.epics.find(e => e.id === currentSelected)) {
          set(selectedEpicIdAtom, result.data.epics[0]?.id ?? null)
        }
      } else {
        // Handle error
        let errorMsg = 'Failed to load epics'
        if (result.error.type === 'flowctl_not_found') {
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
 * Clears selected epic to prevent cross-workspace selection bugs
 */
export const resetTasksStateAtom = atom(
  null,
  (_get, set) => {
    set(epicsAtom, [])
    set(epicsLoadingStateAtom, 'idle')
    set(epicsErrorAtom, null)
    // Clear selection on workspace change to prevent cross-workspace selection bugs
    set(selectedEpicIdAtom, null)
  }
)

// ─── Tab Navigation Atoms ─────────────────────────────────────────────────────

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
