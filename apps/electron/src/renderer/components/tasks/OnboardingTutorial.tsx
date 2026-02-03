/**
 * OnboardingTutorial
 *
 * Interactive step-by-step tutorial for first-time Tasks users.
 * Uses spotlight overlay pattern to highlight UI elements.
 *
 * Steps:
 * 1. "This is your epic list" - highlight navigator
 * 2. "Create your first epic" - highlight '+' button
 * 3. "Your tasks appear here" - highlight kanban area
 * 4. "Done! Start building." - completion
 *
 * Features:
 * - Spotlight overlay dims everything except highlighted element
 * - Motion animations for smooth transitions
 * - Skip tutorial link at any step
 * - Completion persisted to localStorage
 */

import * as React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { KEYS, set as setStorage, get as getStorage } from '@/lib/local-storage'
import { ChevronRight, X, Sparkles, Plus, KanbanSquare, Check } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TutorialStep = 'epic-list' | 'create-epic' | 'kanban-area' | 'complete'

interface StepConfig {
  id: TutorialStep
  title: string
  description: string
  icon: React.ReactNode
  /** CSS selector for element to highlight (or null for no spotlight) */
  targetSelector: string | null
  /** Position of tooltip relative to highlighted element */
  tooltipPosition: 'right' | 'bottom' | 'center'
}

const TUTORIAL_STEPS: StepConfig[] = [
  {
    id: 'epic-list',
    title: 'Your Epic List',
    description: 'This is where all your epics appear. Epics are high-level features or projects that contain related tasks.',
    icon: <KanbanSquare className="h-5 w-5" />,
    targetSelector: '[data-tutorial="epic-list"]',
    tooltipPosition: 'right',
  },
  {
    id: 'create-epic',
    title: 'Create Your First Epic',
    description: 'Click the + button to create a new epic. You can use templates or start from scratch.',
    icon: <Plus className="h-5 w-5" />,
    targetSelector: '[data-tutorial="create-epic-button"]',
    tooltipPosition: 'bottom',
  },
  {
    id: 'kanban-area',
    title: 'Task Board',
    description: 'Tasks appear here organized by status. Drag and drop cards to update progress.',
    icon: <KanbanSquare className="h-5 w-5" />,
    targetSelector: '[data-tutorial="kanban-area"]',
    tooltipPosition: 'center',
  },
  {
    id: 'complete',
    title: 'Ready to Build!',
    description: 'You\'re all set. Create your first epic to get started with guided task management.',
    icon: <Check className="h-5 w-5" />,
    targetSelector: null,
    tooltipPosition: 'center',
  },
]

// ─── Component Props ───────────────────────────────────────────────────────────

export interface OnboardingTutorialProps {
  /** Whether the tutorial is active */
  isActive: boolean
  /** Called when tutorial completes or is skipped */
  onComplete: () => void
  /** Called when user clicks "Create Epic" during tutorial */
  onCreateEpic?: () => void
  /** Optional className */
  className?: string
}

// ─── Helper Hook ───────────────────────────────────────────────────────────────

/**
 * Check if onboarding tutorial has been completed
 */
export function useOnboardingComplete(): boolean {
  return getStorage(KEYS.flowTasksOnboardingComplete, false)
}

/**
 * Mark onboarding tutorial as complete
 */
export function markOnboardingComplete(): void {
  setStorage(KEYS.flowTasksOnboardingComplete, true)
}

// ─── Spotlight Overlay ─────────────────────────────────────────────────────────

interface SpotlightOverlayProps {
  targetSelector: string | null
  children: React.ReactNode
}

function SpotlightOverlay({ targetSelector, children }: SpotlightOverlayProps) {
  const [rect, setRect] = React.useState<DOMRect | null>(null)

  React.useEffect(() => {
    if (!targetSelector) {
      setRect(null)
      return
    }

    const updateRect = () => {
      const element = document.querySelector(targetSelector)
      if (element) {
        setRect(element.getBoundingClientRect())
      } else {
        setRect(null)
      }
    }

    updateRect()

    // Update on resize/scroll
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    // MutationObserver for dynamic content
    const observer = new MutationObserver(updateRect)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
      observer.disconnect()
    }
  }, [targetSelector])

  // No spotlight - just render centered overlay
  if (!targetSelector || !rect) {
    return (
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {children}
      </motion.div>
    )
  }

  // Calculate spotlight cutout with padding
  const padding = 8
  const spotlightRect = {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    borderRadius: 8,
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* SVG overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={spotlightRect.x}
              y={spotlightRect.y}
              width={spotlightRect.width}
              height={spotlightRect.height}
              rx={spotlightRect.borderRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight border ring */}
      <motion.div
        className="absolute border-2 border-primary/50 rounded-lg pointer-events-none"
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        style={{
          left: spotlightRect.x,
          top: spotlightRect.y,
          width: spotlightRect.width,
          height: spotlightRect.height,
        }}
      />

      {/* Tooltip content */}
      {children}
    </motion.div>
  )
}

// ─── Tooltip Card ──────────────────────────────────────────────────────────────

interface TutorialTooltipProps {
  step: StepConfig
  stepNumber: number
  totalSteps: number
  targetRect: DOMRect | null
  onNext: () => void
  onSkip: () => void
  onCreateEpic?: () => void
}

function TutorialTooltip({
  step,
  stepNumber,
  totalSteps,
  targetRect,
  onNext,
  onSkip,
  onCreateEpic,
}: TutorialTooltipProps) {
  // Position calculation
  const getPosition = (): React.CSSProperties => {
    if (!targetRect || step.tooltipPosition === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const padding = 16

    if (step.tooltipPosition === 'right') {
      return {
        position: 'fixed',
        top: targetRect.top + targetRect.height / 2,
        left: targetRect.right + padding,
        transform: 'translateY(-50%)',
      }
    }

    // bottom
    return {
      position: 'fixed',
      top: targetRect.bottom + padding,
      left: targetRect.left + targetRect.width / 2,
      transform: 'translateX(-50%)',
    }
  }

  const isLastStep = step.id === 'complete'
  const isCreateEpicStep = step.id === 'create-epic'

  return (
    <motion.div
      className="w-80 bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
      style={getPosition()}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-primary/10 to-transparent border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            {step.icon}
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Step {stepNumber} of {totalSteps}
          </span>
        </div>
        <button
          onClick={onSkip}
          className="p-1 rounded-md hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Skip tutorial"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-base mb-1.5">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {step.description}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-foreground/[0.02] border-t border-border/50 flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip tutorial
        </button>

        <div className="flex items-center gap-2">
          {isCreateEpicStep && onCreateEpic && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onCreateEpic()
                onNext()
              }}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Epic
            </Button>
          )}
          <Button
            size="sm"
            onClick={onNext}
            className="gap-1.5"
          >
            {isLastStep ? (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-[60px] left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {TUTORIAL_STEPS.map((_, idx) => (
          <div
            key={idx}
            className={cn(
              'h-1.5 rounded-full transition-all',
              idx === stepNumber - 1
                ? 'w-4 bg-primary'
                : idx < stepNumber - 1
                  ? 'w-1.5 bg-primary/50'
                  : 'w-1.5 bg-foreground/20'
            )}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function OnboardingTutorial({
  isActive,
  onComplete,
  onCreateEpic,
  className,
}: OnboardingTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0)
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null)

  const currentStep = TUTORIAL_STEPS[currentStepIndex]

  // Update target rect when step changes
  React.useEffect(() => {
    if (!isActive || !currentStep.targetSelector) {
      setTargetRect(null)
      return
    }

    const updateRect = () => {
      const element = document.querySelector(currentStep.targetSelector!)
      if (element) {
        setTargetRect(element.getBoundingClientRect())
      }
    }

    // Initial update with slight delay to allow DOM to settle
    const timeoutId = setTimeout(updateRect, 100)

    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [isActive, currentStep.targetSelector])

  const handleNext = React.useCallback(() => {
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1)
    } else {
      // Complete tutorial
      markOnboardingComplete()
      onComplete()
    }
  }, [currentStepIndex, onComplete])

  const handleSkip = React.useCallback(() => {
    markOnboardingComplete()
    onComplete()
  }, [onComplete])

  if (!isActive) return null

  return (
    <AnimatePresence>
      <SpotlightOverlay targetSelector={currentStep.targetSelector}>
        <TutorialTooltip
          step={currentStep}
          stepNumber={currentStepIndex + 1}
          totalSteps={TUTORIAL_STEPS.length}
          targetRect={targetRect}
          onNext={handleNext}
          onSkip={handleSkip}
          onCreateEpic={onCreateEpic}
        />
      </SpotlightOverlay>
    </AnimatePresence>
  )
}
