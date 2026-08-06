'use client'

import { ScriptAutomation } from '../previews/script-automation'
import { ScriptCouple } from '../previews/script-couple'
import { ScriptSend } from '../previews/script-send'
import { ScriptTemplate } from '../previews/script-template'
import { useReducedMotion } from '../use-reduced-motion'

/** Props for {@link StepPreview}. */
export interface StepPreviewProps {
  step: 4 | 5 | 6 | 7
  /** True when this step is the one on screen. */
  active: boolean
}

const CONTENT = {
  4: {
    title: 'Add a couple',
    body: 'Every booking starts here. Add the couple, their date and their venue, and Zebri tracks them from enquiry to wedding day.',
  },
  5: {
    title: 'Create a template',
    body: 'Write an email once and reuse it forever. Variables like the couple name fill themselves in when you send.',
  },
  6: {
    title: 'Send it in two clicks',
    body: 'Open a couple, pick a template, send. No copying, no pasting, and every send is logged against that couple.',
  },
  7: {
    title: 'Let it run itself',
    body: 'Set it up once and every new enquiry gets that email automatically, whether you are at a wedding or asleep.',
  },
}

/**
 * Host for the four preview steps: heading, one line of copy, and the
 * animated mock. The scripts know nothing about the wizard and the wizard
 * knows nothing about how they animate.
 *
 * Fills its parent as a column: the heading is pinned to the top and the
 * animated frame takes the rest, so the preview reaches the bottom of the
 * wizard instead of floating in a fixed-height box.
 */
export function StepPreview({ step, active }: StepPreviewProps) {
  const reducedMotion = useReducedMotion()
  const { title, body } = CONTENT[step]
  const scriptProps = { active, reducedMotion }

  return (
    <div className="flex flex-col h-full gap-5">
      <div className="shrink-0">
        <h2 className="text-section font-semibold text-text">{title}</h2>
        {/* Full modal width — no max-width clamp. */}
        <p className="text-body text-text-muted mt-2">{body}</p>
      </div>
      <div className="flex-1 min-h-0">
        {step === 4 && <ScriptCouple {...scriptProps} />}
        {step === 5 && <ScriptTemplate {...scriptProps} />}
        {step === 6 && <ScriptSend {...scriptProps} />}
        {step === 7 && <ScriptAutomation {...scriptProps} />}
      </div>
    </div>
  )
}
