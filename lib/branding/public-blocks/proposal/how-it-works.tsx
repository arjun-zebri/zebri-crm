'use client'

import { CalendarDays, Check, FileText, Heart, MessageSquare, Mic, PartyPopper, PenLine, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { HowItWorksBlock, HowItWorksIcon, HowItWorksStep } from '@/app/(dashboard)/branding/blocks/types'

import { getTextColor } from '../../contrast'
import type { PublicBranding } from '../../public-surface'
import { richTextHasContent } from '../../render-rich-text'
import { roleDefaults } from '../../type-defaults'
import { Rich } from '../rich'
import { pad } from '../shared'

/** Editor slots: a heading replacement and a per-step renderer (title/description editing). */
export interface HowItWorksSlots {
  heading?: ReactNode
  step?: (step: HowItWorksStep, index: number) => ReactNode
}

/** Lucide icon for each {@link HowItWorksIcon} value the block can carry. */
export const HOW_IT_WORKS_ICONS: Record<HowItWorksIcon, LucideIcon> = {
  message: MessageSquare,
  calendar: CalendarDays,
  pen: PenLine,
  mic: Mic,
  heart: Heart,
  party: PartyPopper,
  check: Check,
  file: FileText,
}

function StepContent({ step, index, branding, values }: { step: HowItWorksStep; index: number; branding: PublicBranding; values?: Record<string, string> | undefined }) {
  const Icon = HOW_IT_WORKS_ICONS[step.icon]
  const iconColor = getTextColor(branding.brand_color)
  const labelStyle = resolveTextStyle(undefined, roleDefaults(branding, 'sectionLabel'))
  const bodyStyle = resolveTextStyle(undefined, roleDefaults(branding, 'body'))
  return (
    <>
      <div className="flex h-10 w-10 items-center justify-center rounded-pill" style={{ background: branding.brand_color }}>
        <Icon size={18} strokeWidth={1.5} style={{ color: iconColor }} />
      </div>
      <p className="m-0 mt-3" style={labelStyle}>Step {index + 1}</p>
      <p className="m-0 mt-1" style={{ ...resolveTextStyle(undefined, roleDefaults(branding, 'sectionHeading')), fontSize: 18 }}><Rich value={step.title} values={values} inline /></p>
      <Rich value={step.description} values={values} className="m-0 mt-1 [&_p]:m-0" style={bodyStyle} />
    </>
  )
}

/**
 * The steps from booking to the wedding day, each with an icon and a short
 * description. Renders nothing on an untouched block (no steps, no editor
 * slot) so a sent proposal never shows an empty section.
 */
export function RenderHowItWorks({
  block,
  branding,
  slots,
  variableValues,
}: {
  block: HowItWorksBlock
  branding: PublicBranding
  slots?: HowItWorksSlots
  variableValues?: Record<string, string>
}) {
  if (block.steps.length === 0 && !slots?.step) return null

  const p = pad(branding)
  const headingStyle = resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))

  return (
    <div className={p.blockY}>
      {(richTextHasContent(block.heading) || slots?.heading) && (
        <h2 className="m-0 mb-6" style={headingStyle}>{slots?.heading ?? <Rich value={block.heading} values={variableValues} inline />}</h2>
      )}
      <ol className="m-0 grid gap-6 p-0 @md/doc:grid-cols-2 @lg/doc:grid-cols-4">
        {block.steps.map((step, i) => (
          <li key={step.id} className="list-none">
            {slots?.step?.(step, i) ?? <StepContent step={step} index={i} branding={branding} values={variableValues} />}
          </li>
        ))}
      </ol>
    </div>
  )
}
