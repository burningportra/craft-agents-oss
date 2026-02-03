/**
 * Tasks State Atoms
 *
 * Jotai atoms for flow-next epic and task management.
 * Provides reactive state for the Tasks navigator panel.
 */

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { atomFamily } from 'jotai-family'
import type { EpicSummary, TaskSummary, FlowBridgeResult, EpicListResponse, TaskListResponse } from '../../shared/flow-schemas'

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
          // Check if it's "no .flow directory" error
          if (result.error.stderr.includes('.flow') || result.error.exitCode === 1) {
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
 */
export const initFlowAtom = atom(
  null,
  async (_get, set, workspaceRoot: string) => {
    set(epicsLoadingStateAtom, 'loading')

    try {
      const result = await window.electronAPI.flowInit(workspaceRoot)

      if (result.ok) {
        // Reload epics after successful init
        // Note: The flow:changed event will trigger a reload, but we also do it here
        // for immediate feedback
        set(epicsErrorAtom, null)
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
 */
export const resetTasksStateAtom = atom(
  null,
  (_get, set) => {
    set(epicsAtom, [])
    set(epicsLoadingStateAtom, 'idle')
    set(epicsErrorAtom, null)
    // Note: selectedEpicIdAtom is persisted, so we don't reset it
  }
)
