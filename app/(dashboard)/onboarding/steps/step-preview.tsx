'use client'

import { useReducedMotion } from '../use-reduced-motion'
import { ScriptAutomation } from '../previews/script-automation'
import { ScriptCouple } from '../previews/script-couple'
import { ScriptSend } from '../previews/script-send'
import { ScriptTemplate } from '../previews/script-template'

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
 */
export function StepPreview({ step, active }: StepPreviewProps) {
  const reducedMotion = useReducedMotion()
  const { title, body } = CONTENT[step]
  const scriptProps = { active, reducedMotion }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text">{title}</h2>
        <p className="text-sm text-text-muted mt-1 max-w-lg">{body}</p>
      </div>
      {step === 4 && <ScriptCouple {...scriptProps} />}
      {step === 5 && <ScriptTemplate {...scriptProps} />}
      {step === 6 && <ScriptSend {...scriptProps} />}
      {step === 7 && <ScriptAutomation {...scriptProps} />}
    </div>
  )
}
