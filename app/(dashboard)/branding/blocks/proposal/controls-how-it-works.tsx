'use client'

import { Select } from '@/components/ui/select'
import { HOW_IT_WORKS_ICONS } from '@/lib/branding/public-blocks/proposal/how-it-works'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { roleDefaults } from '@/lib/branding/type-defaults'

import type { UpdateBlock } from '../render-proposal'
import { TextStyleControls } from '../text-style-controls'
import type { HowItWorksBlock, HowItWorksIcon } from '../types'

import { LabelledControl } from './labelled-control'

/** `{value, label}` options for every icon a step can use, in the fixed order `HOW_IT_WORKS_ICONS` declares them. */
const ICON_OPTIONS = Object.keys(HOW_IT_WORKS_ICONS).map((icon) => ({
  value: icon,
  label: icon.charAt(0).toUpperCase() + icon.slice(1),
}))

/**
 * Toolbar controls for the proposal {@link HowItWorksBlock}: one icon
 * `Select` per step (the step's title/description are edited on the canvas)
 * plus heading typography.
 */
export function HowItWorksControls({
  block,
  branding,
  updateBlock,
  expanded,
}: {
  block: HowItWorksBlock
  branding: PublicBranding
  updateBlock: UpdateBlock
  expanded?: boolean | undefined
}) {
  const setStepIcon = (stepId: string, icon: HowItWorksIcon) => {
    updateBlock<HowItWorksBlock>(block.id, {
      steps: block.steps.map((s) => (s.id === stepId ? { ...s, icon } : s)),
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      {block.steps.map((step, i) => (
        <LabelledControl key={step.id} label={`Step ${i + 1} icon`}>
          <div className="w-32">
            <Select
              ariaLabel={`Step ${i + 1} icon`}
              options={ICON_OPTIONS}
              value={step.icon}
              onValueChange={(v) => setStepIcon(step.id, v as HowItWorksIcon)}
            />
          </div>
        </LabelledControl>
      ))}
      <TextStyleControls
        style={block.headingStyle}
        defaults={roleDefaults(branding, 'sectionHeading')}
        onChange={(p) => updateBlock<HowItWorksBlock>(block.id, { headingStyle: { ...(block.headingStyle ?? {}), ...p } })}
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}
