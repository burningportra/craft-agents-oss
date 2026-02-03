# fn-1-interactive-guided-tasks-gui.12 Onboarding tutorial, guided error recovery, OS notifications

## Description
Build the interactive onboarding tutorial for first-time users, guided error recovery for flowctl failures, and OS notification integration for task events.

**Size:** M
**Files:**
- `apps/electron/src/renderer/components/tasks/OnboardingTutorial.tsx` — step-by-step tutorial with spotlight overlay
- `apps/electron/src/renderer/components/tasks/ErrorRecoveryPanel.tsx` — guided error recovery UI
- `apps/electron/src/main/lib/flow-notifications.ts` — notification integration for flow events
- `apps/electron/src/renderer/hooks/useFlowNotifications.ts` — renderer-side notification hook

## Approach

### Onboarding
- Triggered after .flow/ initialized (from empty state CTA)
- Steps: (1) "This is your epic list" → highlight navigator, (2) "Create your first epic" → highlight '+' button, (3) "Your tasks appear here" → highlight kanban area, (4) "Done! Start building."
- Use spotlight overlay pattern (dim everything except highlighted element) with Motion animations
- Tutorial walks through creating a real epic (user's first one)
- Skippable via "Skip Tutorial" link at any step
- Completion persisted to `storage.KEYS.flowTasksOnboardingComplete` in localStorage

### Error Recovery
- When FlowBridge returns typed FlowBridgeError, ErrorRecoveryPanel renders contextual recovery:
  - `flowctl_not_found` → "Install flowctl" button + path explanation
  - `invalid_output` → "Corrupt data detected" + "View raw JSON" + "Revert from backup"
  - `command_failed` → show error message + "Retry" + "Report Issue"
  - `timeout` → "flowctl timed out" + "Retry" + "Check process"
- Panel replaces normal content in the error area (not a modal)
- Circuit breaker applies per flowctl command type (e.g., task-update-status, epic-create) — after 3 consecutive failures of the same command type, stop auto-retry. Reset on first success.

### OS Notifications
- Extend existing `main/notifications.ts` with flow-specific notifications
- Events: task completed (by agent), epic review ready, flowctl error requiring attention
- Only notify when window is not focused (check `BrowserWindow.isFocused()`)
- Use `silent: true` for low-priority (task updates), sound for errors
- Notification click navigates to relevant task/epic via deep link

## Key context

- Existing notification system at `main/notifications.ts` has `showNotification()` and badge support
- `useNotifications` hook at `renderer/hooks/useNotifications.ts` tracks window focus
- Tutorial should be lightweight — custom overlay + Motion animations, no heavy library
## Approach

### Onboarding
- Triggered after .flow/ initialized (from empty state CTA)
- Steps: (1) "This is your epic list" → highlight navigator, (2) "Create your first epic" → highlight '+' button, (3) "Your tasks appear here" → highlight kanban area, (4) "Done! Start building."
- Use spotlight overlay pattern (dim everything except highlighted element)
- Tutorial walks through creating a real epic (user's first one)
- Completion persisted to localStorage, skippable via "Skip Tutorial" link

### Error Recovery
- When FlowBridge returns typed errors, ErrorRecoveryPanel renders contextual recovery:
  - `FlowctlNotFound` → "Install flowctl" button + path explanation
  - `InvalidOutput` → "Corrupt data detected" + "View raw JSON" + "Revert from backup"
  - `CommandFailed` → show error message + "Retry" + "Report Issue"
- Panel replaces normal content in the error area (not a modal)

### OS Notifications
- Extend existing `main/notifications.ts` with flow-specific notifications
- Events: task completed (by agent), epic review ready, flowctl error
- Only notify when window is not focused (check `BrowserWindow.isFocused()`)
- Use `silent: true` for low-priority, sound for errors

## Key context

- Existing notification system at `main/notifications.ts` has `showNotification()` and badge support
- `useNotifications` hook at `renderer/hooks/useNotifications.ts` tracks window focus
- Error recovery follows circuit-breaker pattern: after 3 consecutive failures, stop auto-retry
- Tutorial should be lightweight — no heavy library needed, custom overlay + Motion animations
## Acceptance
- [ ] Onboarding tutorial triggers after first .flow/ initialization
- [ ] Tutorial highlights UI elements with spotlight overlay
- [ ] Tutorial is skippable via "Skip Tutorial" link
- [ ] Tutorial completion persisted at storage.KEYS.flowTasksOnboardingComplete
- [ ] Tutorial walks through creating a real epic
- [ ] FlowctlNotFound error shows install guidance
- [ ] InvalidOutput error shows raw JSON view and revert option
- [ ] CommandFailed error shows retry and report options
- [ ] Timeout error shows retry and process check options
- [ ] Circuit breaker per command type: stops auto-retry after 3 consecutive failures, resets on success
- [ ] OS notifications fire for task completion, review ready, errors
- [ ] Notifications only fire when window is not focused
- [ ] Notification click navigates to relevant task/epic
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
