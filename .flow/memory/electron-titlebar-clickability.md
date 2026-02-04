# Electron Titlebar Drag Region Blocking Clicks

## Problem

In Electron apps with custom titlebars, buttons and interactive elements in the top ~50px of the window may not respond to clicks or hovers.

## Root Cause

The app has a fixed titlebar drag region that covers the top 50px of the window:

```tsx
// AppShell.tsx
<div className="titlebar-drag-region fixed top-0 left-0 right-0 h-[50px] z-titlebar" />
```

With CSS:
```css
.titlebar-drag-region {
  -webkit-app-region: drag;
  app-region: drag;
}

:root {
  --z-titlebar: 40;
  --z-panel: 50;
}
```

This drag region has `z-index: 40` and intercepts all mouse events for window dragging, blocking clicks on elements underneath it.

## Solution

Use the `titlebar-no-drag` class on containers with interactive elements in the top area:

```tsx
<div className="flex items-center titlebar-no-drag">
  <Button onClick={handleClick}>Click me</Button>
</div>
```

The class applies:
```css
.titlebar-no-drag {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
```

## When to Apply

Add `titlebar-no-drag` to:
- Tab bars in the top area (EpicTabBar)
- Header rows with buttons (EpicHeader, ChatContent header)
- Any container with clickable elements within the top 50px of the window

## Alternative: z-index

For sidebar panels that slide in, also add `z-index: 50` (above z-titlebar: 40):

```tsx
<motion.div
  className="..."
  style={{ position: 'relative', zIndex: 50 }}
>
```

## Files Modified (2024-02-03)

- `EpicTabBar.tsx` - Added `titlebar-no-drag` to container
- `TasksMainContent.tsx` - Added `titlebar-no-drag` to EpicHeader
- `EpicChatPanel.tsx` - Added `titlebar-no-drag` to chat header, z-index to panel
- `AISuggestionSidebar.tsx` - Added z-index to panel

## Key Insight

The issue manifests as "buttons can't be clicked" but the root cause is Electron's window drag region, not CSS or React. Always check for `-webkit-app-region: drag` overlays when debugging click issues in Electron apps.
