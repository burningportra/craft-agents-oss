/**
 * OnboardingWizard
 *
 * 5-step modal onboarding wizard for new flow-next projects.
 * Steps 1-2 (Welcome + Interactive Demo) are implemented here.
 * Steps 3-5 are placeholder slots for Task 5.
 *
 * Steps 1-2 are required (not skippable).
 * Steps 3-5 are individually skippable.
 *
 * Follows EpicCreationWizard.tsx pattern:
 * - Radix Dialog modal
 * - Motion AnimatePresence mode="wait"
 * - Spring config { type: 'spring', stiffness: 600, damping: 49 }
 */

import * as React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Rocket,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  MousePointerClick,
  Settings,
  Terminal,
  PartyPopper,
  ListChecks,
  GitBranch,
  MessageSquare,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from '@/components/ui/dialog'
import type { FlowProjectContext } from '../../../shared/types'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type OnboardingStep = 1 | 2 | 3 | 4 | 5

export interface OnboardingWizardProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Project path for IPC calls */
  projectPath: string
  /** Callback when onboarding completes (all steps or skipped forward) */
  onComplete: () => void
}

// ─── Step Metadata ──────────────────────────────────────────────────────────────

interface StepMeta {
  step: OnboardingStep
  label: string
  icon: React.ReactNode
  skippable: boolean
}

const STEPS: StepMeta[] = [
  { step: 1, label: 'Welcome', icon: <BookOpen className="size-4" />, skippable: false },
  { step: 2, label: 'Demo', icon: <MousePointerClick className="size-4" />, skippable: false },
  { step: 3, label: 'Configure', icon: <Settings className="size-4" />, skippable: true },
  { step: 4, label: 'Initialize', icon: <Terminal className="size-4" />, skippable: true },
  { step: 5, label: 'Create', icon: <PartyPopper className="size-4" />, skippable: true },
]

// ─── Spring Animation Config ────────────────────────────────────────────────────

const springTransition = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 49,
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function OnboardingWizard({
  open,
  onOpenChange,
  projectPath,
  onComplete,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = React.useState<OnboardingStep>(1)
  const [completedSteps, setCompletedSteps] = React.useState<Set<OnboardingStep>>(new Set())
  const [projectContext, setProjectContext] = React.useState<FlowProjectContext | null>(null)
  const [contextLoading, setContextLoading] = React.useState(true)
  const [shouldReset, setShouldReset] = React.useState(false)

  // Direction for slide animation (1 = forward, -1 = backward)
  const [direction, setDirection] = React.useState(1)

  // Fetch project context on mount / projectPath change
  React.useEffect(() => {
    if (!open || !projectPath) return

    let cancelled = false
    setContextLoading(true)

    window.electronAPI
      .flowReadProjectContext(projectPath)
      .then((ctx) => {
        if (!cancelled) {
          setProjectContext(ctx)
          setContextLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectContext(null)
          setContextLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, projectPath])

  // Mark for reset when dialog closes
  React.useEffect(() => {
    if (!open) {
      setShouldReset(true)
    }
  }, [open])

  // Reset state after close animation
  const handleCloseAnimationComplete = React.useCallback(() => {
    if (shouldReset) {
      setCurrentStep(1)
      setCompletedSteps(new Set())
      setProjectContext(null)
      setContextLoading(true)
      setDirection(1)
      setShouldReset(false)
    }
  }, [shouldReset])

  const projectName = projectContext?.name ?? 'your project'

  // Navigation
  const handleNext = React.useCallback(() => {
    setCompletedSteps((prev) => new Set([...prev, currentStep]))
    setDirection(1)
    if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as OnboardingStep)
    } else {
      onComplete()
      onOpenChange(false)
    }
  }, [currentStep, onComplete, onOpenChange])

  const handlePrev = React.useCallback(() => {
    setDirection(-1)
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as OnboardingStep)
    }
  }, [currentStep])

  const handleSkip = React.useCallback(() => {
    // Steps 1-2 are not skippable, but steps 3-5 can be skipped
    const meta = STEPS[currentStep - 1]
    if (!meta.skippable) return
    handleNext()
  }, [currentStep, handleNext])

  // Can navigate backward only if not on step 1
  const canGoBack = currentStep > 1

  // Steps 1-2 cannot be skipped
  const canSkip = STEPS[currentStep - 1]?.skippable ?? false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[640px] p-0 max-h-[85vh] flex flex-col overflow-hidden"
        showCloseButton={false}
        aria-labelledby="onboarding-wizard-title"
        aria-describedby="onboarding-wizard-description"
        data-testid="onboarding-wizard"
      >
        <DialogDescription id="onboarding-wizard-description" className="sr-only">
          Onboarding wizard to set up flow-next for your project.
        </DialogDescription>

        {/* Progress Bar */}
        <div className="h-1 bg-foreground/5 shrink-0">
          <motion.div
            className="h-full bg-foreground/80 rounded-r-full"
            initial={{ width: '0%' }}
            animate={{ width: `${(currentStep / STEPS.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <AnimatePresence mode="wait" onExitComplete={handleCloseAnimationComplete}>
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -30 }}
                transition={springTransition}
                role="region"
                aria-label="Welcome step"
              >
                <WelcomeStep
                  projectName={projectName}
                  projectDescription={projectContext?.description}
                  loading={contextLoading}
                />
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -30 }}
                transition={springTransition}
                role="region"
                aria-label="Interactive demo step"
              >
                <InteractiveDemoStep projectName={projectName} />
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -30 }}
                transition={springTransition}
                role="region"
                aria-label="Configure step"
              >
                <PlaceholderStep
                  step={3}
                  title="Configure Preferences"
                  description="Choose your default view mode and other preferences. (Coming in the next update)"
                />
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -30 }}
                transition={springTransition}
                role="region"
                aria-label="Initialize step"
              >
                <PlaceholderStep
                  step={4}
                  title="Initialize Flow-Next"
                  description="Set up the .flow/ directory in your project. (Coming in the next update)"
                />
              </motion.div>
            )}

            {currentStep === 5 && (
              <motion.div
                key="step-5"
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -30 }}
                transition={springTransition}
                role="region"
                aria-label="Create epic step"
              >
                <PlaceholderStep
                  step={5}
                  title="Create Your First Epic"
                  description="Start planning your first feature with AI-assisted task generation. (Coming in the next update)"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer: Step Indicator + Navigation */}
        <div className="shrink-0 border-t border-border/50 px-8 py-4 flex items-center justify-between bg-foreground/[0.02]">
          {/* Step Indicator Dots */}
          <div className="flex items-center gap-2">
            {STEPS.map((meta) => {
              const isActive = meta.step === currentStep
              const isCompleted = completedSteps.has(meta.step)
              return (
                <div
                  key={meta.step}
                  className={cn(
                    'flex items-center gap-1.5 text-xs transition-colors',
                    isActive
                      ? 'text-foreground font-medium'
                      : isCompleted
                        ? 'text-foreground/50'
                        : 'text-foreground/25'
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <div
                    className={cn(
                      'size-2 rounded-full transition-all',
                      isActive
                        ? 'bg-foreground scale-125'
                        : isCompleted
                          ? 'bg-foreground/50'
                          : 'bg-foreground/20'
                    )}
                  />
                  <span className="hidden sm:inline">{meta.label}</span>
                </div>
              )
            })}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            {canSkip && (
              <button
                onClick={handleSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
                data-testid="onboarding-skip-button"
              >
                Skip
              </button>
            )}
            {canGoBack && (
              <button
                onClick={handlePrev}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  'text-foreground/70 hover:text-foreground hover:bg-foreground/5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
                data-testid="onboarding-prev-button"
              >
                <ArrowLeft className="size-3.5" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className={cn(
                'flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all',
                'bg-foreground text-background hover:bg-foreground/90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
              data-testid="onboarding-next-button"
            >
              {currentStep === 5 ? 'Finish' : 'Continue'}
              {currentStep < 5 && <ArrowRight className="size-3.5" />}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Step 1: Welcome ────────────────────────────────────────────────────────────

interface WelcomeStepProps {
  projectName: string
  projectDescription?: string
  loading: boolean
}

function WelcomeStep({ projectName, projectDescription, loading }: WelcomeStepProps) {
  const methodologySteps = [
    {
      icon: <ListChecks className="size-5 text-blue-500" />,
      title: 'Plan',
      description: 'Create epics and break them into tasks with AI-assisted planning.',
      bgClass: 'bg-blue-500/10',
    },
    {
      icon: <GitBranch className="size-5 text-emerald-500" />,
      title: 'Work',
      description: 'Implement tasks one at a time with focused, trackable progress.',
      bgClass: 'bg-emerald-500/10',
    },
    {
      icon: <MessageSquare className="size-5 text-violet-500" />,
      title: 'Review',
      description: 'AI-assisted code review ensures quality before completion.',
      bgClass: 'bg-violet-500/10',
    },
  ]

  return (
    <div className="flex flex-col items-center" data-testid="onboarding-step-welcome">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-foreground/5">
          <Rocket className="size-6 text-foreground/80" />
        </div>
      </div>

      <h2
        id="onboarding-wizard-title"
        className="text-xl font-semibold text-center"
      >
        {loading ? (
          <span className="text-muted-foreground">Loading...</span>
        ) : (
          <>Set up flow-next for <span className="text-foreground">{projectName}</span></>
        )}
      </h2>

      {projectDescription && !loading && (
        <p className="text-sm text-muted-foreground text-center mt-1.5 max-w-md line-clamp-2">
          {projectDescription}
        </p>
      )}

      <p className="text-sm text-muted-foreground text-center mt-3 max-w-md">
        Flow-next brings structured, AI-assisted task management directly into your development workflow.
      </p>

      {/* Methodology Cards */}
      <div className="w-full mt-6 space-y-3">
        {methodologySteps.map((step) => (
          <div
            key={step.title}
            className="flex items-start gap-4 rounded-xl p-4 bg-foreground/[0.02] shadow-minimal"
          >
            <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', step.bgClass)}>
              {step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm">{step.title}</span>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Step 2: Interactive Demo ───────────────────────────────────────────────────

interface InteractiveDemoStepProps {
  projectName: string
}

// Demo workflow phases
type DemoPhase = 'plan' | 'work' | 'review' | 'done'

const DEMO_PHASES: { id: DemoPhase; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'plan', label: 'Plan', icon: <ListChecks className="size-4" />, color: 'text-blue-500' },
  { id: 'work', label: 'Work', icon: <GitBranch className="size-4" />, color: 'text-emerald-500' },
  { id: 'review', label: 'Review', icon: <MessageSquare className="size-4" />, color: 'text-violet-500' },
  { id: 'done', label: 'Done', icon: <CheckCircle2 className="size-4" />, color: 'text-amber-500' },
]

function InteractiveDemoStep({ projectName }: InteractiveDemoStepProps) {
  const [activePhase, setActivePhase] = React.useState<DemoPhase>('plan')

  // Sample data for the demo
  const sampleEpic = `Add authentication to ${projectName}`
  const sampleTasks = [
    { id: 1, title: 'Set up auth provider', status: 'done' as const },
    { id: 2, title: 'Create login page', status: 'in-progress' as const },
    { id: 3, title: 'Add session management', status: 'todo' as const },
    { id: 4, title: 'Write integration tests', status: 'todo' as const },
  ]

  const phaseContent: Record<DemoPhase, { title: string; description: string; highlight: string }> = {
    plan: {
      title: 'Create an Epic',
      description: `Start by describing what you want to build. AI breaks "${sampleEpic}" into actionable tasks.`,
      highlight: 'epic',
    },
    work: {
      title: 'Work Through Tasks',
      description: 'Pick up tasks one at a time. Each task has clear scope and acceptance criteria.',
      highlight: 'tasks',
    },
    review: {
      title: 'AI-Assisted Review',
      description: 'When a task is complete, AI reviews the implementation for quality and correctness.',
      highlight: 'review',
    },
    done: {
      title: 'Ship with Confidence',
      description: 'Every task is reviewed, every epic is tracked. Ship features with a clear audit trail.',
      highlight: 'done',
    },
  }

  const content = phaseContent[activePhase]

  return (
    <div className="flex flex-col" data-testid="onboarding-step-demo">
      {/* Header */}
      <div className="text-center mb-5">
        <h2 className="text-lg font-semibold">See How It Works</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Click each phase to explore the workflow
        </p>
      </div>

      {/* Phase Selector */}
      <div className="flex items-center justify-center gap-1 mb-5">
        {DEMO_PHASES.map((phase, idx) => {
          const isActive = phase.id === activePhase
          return (
            <React.Fragment key={phase.id}>
              {idx > 0 && (
                <div className="w-6 h-px bg-foreground/10 mx-0.5" />
              )}
              <button
                onClick={() => setActivePhase(phase.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-foreground/10 text-foreground shadow-minimal'
                    : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                )}
                data-testid={`demo-phase-${phase.id}`}
              >
                <span className={cn(isActive ? phase.color : '')}>{phase.icon}</span>
                {phase.label}
              </button>
            </React.Fragment>
          )
        })}
      </div>

      {/* Phase Description */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activePhase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="text-center mb-5"
        >
          <h3 className="text-sm font-semibold">{content.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{content.description}</p>
        </motion.div>
      </AnimatePresence>

      {/* Mock Board Visualization */}
      <div className="rounded-xl border border-border/50 bg-foreground/[0.01] overflow-hidden">
        {/* Mock header */}
        <div className="px-4 py-2.5 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-blue-500" />
            <span className="text-xs font-medium truncate max-w-[200px]">{sampleEpic}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">4 tasks</span>
        </div>

        {/* Mock task list */}
        <div className="p-3 space-y-2">
          {sampleTasks.map((task) => {
            const isHighlighted =
              (content.highlight === 'epic') ||
              (content.highlight === 'tasks' && task.status === 'in-progress') ||
              (content.highlight === 'review' && task.status === 'done') ||
              (content.highlight === 'done' && task.status === 'done')

            return (
              <motion.div
                key={task.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all',
                  isHighlighted
                    ? 'bg-foreground/5 ring-1 ring-foreground/10'
                    : 'bg-transparent'
                )}
                animate={{
                  scale: isHighlighted ? 1.01 : 1,
                  opacity: isHighlighted ? 1 : 0.5,
                }}
                transition={{ duration: 0.2 }}
              >
                {/* Status Indicator */}
                {task.status === 'done' ? (
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                ) : task.status === 'in-progress' ? (
                  <motion.div
                    className="size-3.5 rounded-full border-2 border-blue-500 border-t-transparent shrink-0"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  <Circle className="size-3.5 text-foreground/20 shrink-0" />
                )}

                <span className={cn(
                  'flex-1',
                  task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'
                )}>
                  {task.title}
                </span>

                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded',
                  task.status === 'done'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : task.status === 'in-progress'
                      ? 'bg-blue-500/10 text-blue-600'
                      : 'bg-foreground/5 text-muted-foreground'
                )}>
                  {task.status === 'in-progress' ? 'in progress' : task.status}
                </span>
              </motion.div>
            )
          })}
        </div>

        {/* Review indicator for 'review' phase */}
        {activePhase === 'review' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2.5 border-t border-border/50 bg-violet-500/5"
          >
            <div className="flex items-center gap-2 text-xs text-violet-600">
              <MessageSquare className="size-3.5" />
              <span>AI reviewing &ldquo;Set up auth provider&rdquo;...</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ─── Placeholder Step (Steps 3-5) ───────────────────────────────────────────────

interface PlaceholderStepProps {
  step: number
  title: string
  description: string
}

function PlaceholderStep({ step, title, description }: PlaceholderStepProps) {
  const icons = {
    3: <Settings className="size-6 text-foreground/40" />,
    4: <Terminal className="size-6 text-foreground/40" />,
    5: <PartyPopper className="size-6 text-foreground/40" />,
  }

  return (
    <div
      className="flex flex-col items-center justify-center py-12"
      data-testid={`onboarding-step-placeholder-${step}`}
    >
      <div className="p-3 rounded-xl bg-foreground/5 mb-4">
        {icons[step as keyof typeof icons]}
      </div>
      <h2 className="text-lg font-semibold text-center">{title}</h2>
      <p className="text-sm text-muted-foreground text-center mt-2 max-w-sm">{description}</p>
    </div>
  )
}
