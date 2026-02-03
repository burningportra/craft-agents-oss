/**
 * TasksPage - Placeholder component for the Tasks navigator
 *
 * This will be replaced with the full tasks GUI in later tasks.
 * For now it renders a simple placeholder indicating the tasks view is active.
 */

import * as React from 'react'
import { KanbanSquare } from 'lucide-react'

export function TasksPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <KanbanSquare className="h-10 w-10 opacity-40" />
      <p className="text-sm font-medium">Tasks</p>
      <p className="text-xs opacity-60">Task management coming soon</p>
    </div>
  )
}
