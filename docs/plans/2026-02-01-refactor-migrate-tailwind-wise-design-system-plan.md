---
title: "refactor: Migrate to Tailwind CSS v4 with Wise Design System tokens"
type: refactor
date: 2026-02-01
---

# Migrate to Tailwind CSS v4 with Wise Design System tokens

## Overview

Replace the current styling approach (inline `style={{}}` props + `src/styles/wise.css` custom properties + `src/lib/colors.ts` TypeScript module) with Tailwind CSS v4 utility classes. All Wise Design System tokens map into Tailwind's CSS-first `@theme` configuration. The result: zero inline styles, no colors.ts, no wise.css, one `@theme` block as the single source of truth.

## Problem statement

The codebase has **160 inline `style={{}}` occurrences** across 4 component files, a 305-line `wise.css` that's partially used, and a `colors.ts` module that duplicates the CSS custom properties. Hover states are implemented via `onMouseEnter`/`onMouseLeave` JS handlers instead of CSS `:hover`. This creates:

- Verbose, hard-to-scan component code
- No hover/focus/responsive pseudo-class support without JS
- Duplicate token definitions (CSS vars + TS module)
- Impossible to use Tailwind ecosystem tooling (Intellisense, prettier-plugin-tailwindcss)

## Proposed solution

Tailwind CSS v4 with the `@tailwindcss/vite` plugin. v4's CSS-first `@theme` directive maps Wise tokens directly — no `tailwind.config.js` needed. Use `clsx` for conditional class composition.

## Technical approach

### Architecture

```
src/
  styles/
    app.css          ← @import "tailwindcss" + @theme block + responsive radius overrides
  lib/
    colors.ts        ← DELETE (tokens live in @theme)
  components/
    App.tsx           ← className utilities, no style={{}}
    PlanPhase.tsx     ← className utilities, no style={{}}
    HandoffReview.tsx ← className utilities, no style={{}}
    ProjectSelector.tsx ← className utilities, no style={{}}
vite.config.js       ← add @tailwindcss/vite plugin
```

### The `@theme` block

All Wise tokens map to Tailwind v4's `@theme` namespace. This replaces both `wise.css` `:root` variables and `colors.ts`.

```css
/* src/styles/app.css */
@import "tailwindcss";

@theme {
  /* Brand */
  --color-forest-green: #163300;
  --color-bright-green: #9FE870;
  --color-bright-pink: #FFD7EF;
  --color-bright-orange: #FFC091;
  --color-bright-yellow: #FFEB69;
  --color-bright-blue: #A0E1E1;
  --color-dark-purple: #260A2F;
  --color-dark-gold: #3A341C;
  --color-dark-charcoal: #21231D;

  /* Content */
  --color-content-primary: #0E0F0C;
  --color-content-secondary: #454745;
  --color-content-tertiary: #6A6C6A;
  --color-content-link: #163300;

  /* Interactive */
  --color-interactive-primary: #163300;
  --color-interactive-accent: #9FE870;
  --color-interactive-secondary: #868685;
  --color-interactive-control: #163300;

  /* Background */
  --color-bg-screen: #FFFFFF;
  --color-bg-elevated: #FFFFFF;
  --color-bg-neutral: rgba(22, 51, 0, 0.08);

  /* Border */
  --color-border-neutral: rgba(14, 15, 12, 0.12);

  /* Sentiment */
  --color-sentiment-positive: #2F5711;
  --color-sentiment-negative: #A8200D;
  --color-sentiment-warning: #EDC843;

  /* Base */
  --color-base-light: #FFFFFF;

  /* Font */
  --font-sans: 'Inter', sans-serif;

  /* Spacing (Wise non-standard values) */
  --spacing-1: 1px;
  --spacing-1.5: 6px;
  --spacing-2.5: 10px;
  --spacing-3.5: 14px;
  --spacing-5.5: 22px;

  /* Radius — mobile defaults */
  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-xl: 32px;
  --radius-2xl: 48px;
}

/* Responsive radius overrides (not expressible in @theme) */
@media (min-width: 480px) {
  :root {
    --radius-sm: 16px;
    --radius-md: 20px;
    --radius-lg: 30px;
    --radius-xl: 40px;
    --radius-2xl: 60px;
  }
}
```

This gives utilities like `bg-forest-green`, `text-content-primary`, `border-border-neutral`, `rounded-md`, etc. automatically.

### Conditional class pattern

Use `clsx` (lightweight, no tailwind-merge needed since we control the design system):

```tsx
import clsx from 'clsx';

<button className={clsx(
  'flex items-center gap-1.5 px-3.5 h-[30px] rounded-lg border-none cursor-pointer transition-all duration-150',
  isActive
    ? 'bg-bg-elevated shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
    : 'bg-transparent',
)} />
```

### Hover state migration

Replace JS `onMouseEnter`/`onMouseLeave` + `useState` with Tailwind `hover:` utilities:

```tsx
// BEFORE
onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.backgroundNeutral; }}
onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}

// AFTER
className="bg-transparent hover:bg-bg-neutral"
```

### Implementation phases

#### Phase 1: Foundation

- [x] Install `@tailwindcss/vite` and `clsx`: `npm install -D @tailwindcss/vite && npm install clsx`
- [x] Add `tailwindcss()` plugin to `vite.config.js`
- [x] Create `src/styles/app.css` with `@import "tailwindcss"` + full `@theme` block + responsive radius overrides
- [x] Update `src/main.jsx`: replace `import './styles/wise.css'` with `import './styles/app.css'`
- [x] Verify dev server starts, Tailwind classes work alongside existing inline styles
- [x] Keep `wise.css` and `colors.ts` intact during this phase (coexistence)

#### Phase 2: Migrate components (one at a time)

Migrate in this order (simplest → most complex):

- [x] `src/components/HandoffReview.tsx` (33 inline styles, no JS hover states)
  - Replace all `style={{}}` with Tailwind classes
  - Replace `colors.X` references with Tailwind color utilities
  - Replace `var(--*)` references with Tailwind utilities
  - Remove `import { colors }` when fully migrated
- [x] `src/components/ProjectSelector.tsx` (31 inline styles, JS hover states)
  - Same as above + replace `onMouseEnter`/`onMouseLeave` + `hoveredCard` state with `hover:` utilities
  - Note: project card border color on hover uses `accent.bg` (dynamic) — use `clsx` with explicit color classes or keep as `style` for dynamic accent
- [x] `src/components/PlanPhase.tsx` (41 inline styles)
  - Chat bubbles, intent cards, progress indicators
  - Conditional active/inactive states → `clsx`
- [x] `src/App.tsx` (55 inline styles, JS hover states)
  - Header toolbar, phase tabs, sidebar, advance bar
  - Replace `onMouseEnter`/`onMouseLeave` handlers
  - Phase tab active/past states → `clsx`

#### Phase 3: Cleanup

- [x] Delete `src/styles/wise.css`
- [x] Delete `src/lib/colors.ts`
- [x] Remove `import './index.css'` if redundant (box-sizing reset is in Tailwind's preflight)
- [x] Grep for any remaining `colors.` imports, `style={{`, or `var(--` references
- [x] Verify `npx vite build` passes
- [x] Visual comparison: dev server renders identically

## Edge cases and risks

### Dynamic accent colors in ProjectSelector

`ProjectSelector.tsx` computes accent colors from a hash of the project name (`accentFor()`). The accent is used for border color, avatar bg, and color strip. These are **runtime-dynamic values** that cannot be Tailwind utilities (they'd be purged).

**Strategy**: Keep `style={{ borderColor: accent.bg }}` for these ~3 dynamic color props. Everything else migrates to classes. Delete `colors.ts` but keep the `CARD_ACCENTS` array with inline hex values in the component.

### Responsive radius tokens

Tailwind `@theme` doesn't support media-query-conditional values. The responsive radius overrides (mobile: 10px → desktop: 16px for `--radius-sm`, etc.) are handled via a plain `@media` block after `@theme` that overrides the CSS custom properties Tailwind generates. This works because Tailwind v4 generates `var(--radius-sm)` references internally.

### Non-standard spacing

Values like 3px, 6px, 10px, 14px, 22px are used throughout. Strategy:
- 6px → `gap-1.5` (Tailwind default 1.5 = 6px with 4px base)
- 10px → `gap-2.5` (Tailwind default 2.5 = 10px)
- 14px → `gap-3.5` or `p-3.5` (Tailwind default 3.5 = 14px)
- 3px → `p-[3px]` (arbitrary, only used for accent strip height)
- 22px → `size-[22px]` (arbitrary, only used for step indicators)

Most map cleanly to Tailwind's default scale. Only 2-3 need arbitrary values.

### Typography classes

`wise.css` defines `wise-h1` through `wise-h6` with responsive overrides. Two options:
1. **Keep as `@layer components` in app.css** — cleanest, preserves responsive behavior
2. **Inline as Tailwind utilities** — verbose (`text-[42px] leading-[46px] font-semibold tracking-[-0.03em] md:text-[78px] md:leading-[82px]`)

**Strategy**: Option 1 — define typography classes in `@layer components` within `app.css`. These are semantic compound classes that don't benefit from decomposition.

### Component classes (wise-btn-primary, wise-card, etc.)

Same as typography — keep as `@layer components` in `app.css`. These encode multi-property component styles including focus states that are cleaner as named classes than decomposed utilities.

## Acceptance criteria

- [x] Zero `import { colors }` statements remain
- [x] Zero `style={{}}` props remain (except dynamic accent colors in ProjectSelector ~3 instances)
- [x] Zero `onMouseEnter`/`onMouseLeave` hover handlers remain
- [x] `src/styles/wise.css` deleted
- [x] `src/lib/colors.ts` deleted
- [x] `npx vite build` passes with no errors
- [x] All Wise Design System tokens present in `@theme`
- [x] Responsive radius behavior preserved (smaller on mobile, larger on desktop)
- [x] Visual output identical to current state
- [x] Typography classes (`wise-h1` through `wise-h6`, `wise-body1` through `wise-body3`) preserved in `@layer components`
- [x] Component classes (`wise-btn-primary`, `wise-card`, etc.) preserved in `@layer components`

## Dependencies

- `@tailwindcss/vite` (Tailwind v4 Vite plugin)
- `clsx` (conditional className composition)

## Files changed

| File | Action |
|------|--------|
| `vite.config.js` | Add `@tailwindcss/vite` plugin |
| `src/styles/app.css` | NEW — `@import "tailwindcss"` + `@theme` + `@layer components` |
| `src/styles/wise.css` | DELETE |
| `src/lib/colors.ts` | DELETE |
| `src/index.css` | DELETE (preflight covers reset) |
| `src/main.jsx` | Update import to `./styles/app.css` |
| `src/App.tsx` | Migrate inline styles → Tailwind classes |
| `src/components/PlanPhase.tsx` | Migrate inline styles → Tailwind classes |
| `src/components/HandoffReview.tsx` | Migrate inline styles → Tailwind classes |
| `src/components/ProjectSelector.tsx` | Migrate inline styles → Tailwind classes |
| `package.json` | Add `@tailwindcss/vite`, `clsx` |

## References

- Tailwind CSS v4 docs: https://tailwindcss.com/docs/installation/using-vite
- Tailwind v4 `@theme` reference: https://tailwindcss.com/docs/theme
- Wise Design System spec: `agents.md:46-270`
- Current tokens: `src/styles/wise.css`, `src/lib/colors.ts`
