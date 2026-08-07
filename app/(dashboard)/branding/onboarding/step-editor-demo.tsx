'use client'

import { useReducedMotion } from '@/app/(dashboard)/onboarding/use-reduced-motion'

import { EditorDemo } from './editor-demo'

/**
 * Props for the editor demo step.
 * @internal
 */
interface StepEditorDemoProps {
  /** Test override; defaults to the OS-level preference. */
  reducedMotion?: boolean
}

/**
 * StepEditorDemo — Animated tour of the branding editor.
 *
 * The wizard's closing page: a miniature of the real editor with a fake
 * pointer clicking through the three ideas — choosing documents from the
 * tab strip's gear, the brand kit restyling every document at once, and a
 * single block styled on its own via its toolbar. Collects nothing; purely
 * explanatory. Reduced motion rests on the final frame.
 * @internal
 */
export function StepEditorDemo({ reducedMotion }: StepEditorDemoProps) {
  const systemReduced = useReducedMotion()

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h2 className="text-section font-semibold text-text mb-1">See how the editor works</h2>
        <p className="text-body text-text-muted">
          A quick tour. You can change everything later in the editor.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <EditorDemo reducedMotion={reducedMotion ?? systemReduced} />
      </div>
    </div>
  )
}
