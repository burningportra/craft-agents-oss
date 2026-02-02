# Opening State Specification

> **Component:** Intelligent Planning Layer  
> **Version:** 1.0

## Overview

The Opening State is the first interaction point in the Plan phase. It transforms a blank textarea into a conversational, context-aware experience.

## State Machine

```
┌──────────────┐
│   question   │ ← Initial state
└──────┬───────┘
       │ handleIntentSelect() or handleFreeformSubmit()
       ▼
┌──────────────┐
│   scanning   │ ← Shows progressive codebase analysis
└──────┬───────┘
       │ auto-advance after 5 steps
       ▼
┌──────────────┐
│  narrative   │ ← Confirm/correct understanding
└──────┬───────┘
       │ handleNarrativeConfirm() or handleBack()
       ▼
┌──────────────┐
│  brainstorm  │ ← Ready for dialogue
└──────────────┘
```

## State Variables

| State | Type | Default | Description |
|-------|------|---------|-------------|
| `openingStep` | enum | `'question'` | Current step in flow |
| `userIntent` | string \| null | `null` | Selected intent ID or `'custom'` |
| `freeformIntent` | string | `''` | User's freeform description |
| `scanProgress` | object[] | `[]` | Completed scan steps |
| `narrativeConfirmed` | boolean | `false` | Whether user confirmed narrative |
| `researchMode` | enum | `'mid'` | Selected research timing mode |

## Intent Options

```javascript
const intentOptions = [
  { id: 'feature', label: 'Build a feature', icon: '🚀' },
  { id: 'fix', label: 'Fix something', icon: '🔧' },
  { id: 'continue', label: 'Continue previous', icon: '↩️' },
  { id: 'explore', label: 'Just exploring', icon: '🔍' },
  { id: 'lost', label: "I'm lost", icon: '🧭' },
];
```

## Scanning Steps

```javascript
const SCANNING_STEPS = [
  { id: 1, label: 'Scanning file structure', detail: 'N files found' },
  { id: 2, label: 'Analysing dependencies', detail: 'Framework, libraries' },
  { id: 3, label: 'Reading recent commits', detail: 'Last activity' },
  { id: 4, label: 'Identifying patterns', detail: 'Architecture style' },
  { id: 5, label: 'Building narrative', detail: 'Ready' },
];
```

## Research Modes

| Mode | Timing | Use Case |
|------|--------|----------|
| `early` | Before brainstorm | Need prior art discovery upfront |
| `mid` | During dialogue | Research as topics emerge |
| `onDemand` | User-triggered | Manual research requests |
| `continuous` | Background | Always researching in parallel |

## CSS Animations

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## Event Handlers

### `handleIntentSelect(intentId)`
Selects a preset intent and starts scanning.

### `handleFreeformSubmit(e)`  
Submits custom description and starts scanning.

### `handleBack()`
Navigates to previous step.

### `handleNarrativeConfirm()`
Confirms understanding and advances to brainstorm.

## UI Components

### Progress Indicator
- 4 dots showing current step
- Green for current, checkmark for completed, gray for upcoming
- Text label describes current state

### Intent Buttons
- Grid layout, responsive
- Icon + label
- Hover/focus states from Wise Design System

### Research Mode Toggle
- Pill button group
- Active state uses `interactivePrimary`

### Narrative Card
- Elevated background
- Border with subtle shadow
- Summary, recent work, patterns, suggestion sections

### Confirmation Buttons
- "That's right" - primary accent
- "Let me correct you" - outline style
