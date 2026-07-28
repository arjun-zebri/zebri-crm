'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { PaymentScheduleBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { roleDefaults } from '../type-defaults'

import { fmt, fmtDate, pad, type PublicDocData } from './shared'

/**
 * Renders the invoice payment schedule (deposit + final balance) on public
 * surfaces. The subheading and line labels come from the block (editable in the
 * branding editor); the amounts and due dates come from `doc.paymentSchedule`.
 * Renders nothing when the document has no schedule.
 *
 * The editor's placeholder version lives in the branding editor (render.tsx) and
 * mirrors this structure/styling — keep the two in step when changing either.
 */
export function RenderPaymentSchedule({
  block,
  branding,
  doc,
  chrome,
}: {
  block: PaymentScheduleBlock
  branding: PublicBranding
  doc: PublicDocData
  chrome?: ReactNode
}) {
  const schedule = doc.paymentSchedule
  if (!schedule) return null

  const p = pad(branding)
  const headingDefaults = roleDefaults(branding, 'sectionHeading')
  const bodyDefaults = roleDefaults(branding, 'body')
  const headingCss = resolveTextStyle(block.headingStyle, headingDefaults)
  const lineCss = resolveTextStyle(block.lineStyle, bodyDefaults)
  const valueCss = resolveTextStyle(block.valueStyle, bodyDefaults)

  const stages = [
    { label: block.depositLabel ?? 'Deposit', amount: schedule.depositAmount, due: schedule.depositDueDate },
    { label: block.finalLabel ?? 'Final balance', amount: schedule.finalAmount, due: schedule.finalDueDate },
  ]

  return (
    <div className={`${p.docX} ${p.blockY}`}>
      <p className="mb-3" style={headingCss}>
        {caseText(block.heading ?? 'Payment schedule', block.headingStyle, headingDefaults)}
      </p>
      {stages.map((stage, i) => (
        <div
          key={i}
          className="flex justify-between items-baseline gap-4 py-2.5 border-b last:border-b-0"
          style={{ borderBottomColor: branding.border_color }}
        >
          {/* Label + due date sit on one line (due date beside, not under). */}
          <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
            <span style={lineCss}>{caseText(stage.label, block.lineStyle, bodyDefaults)}</span>
            {stage.due && <span className="tabular-nums" style={valueCss}>{fmtDate(stage.due)}</span>}
          </div>
          <span className="shrink-0 tabular-nums" style={valueCss}>{fmt(stage.amount)}</span>
        </div>
      ))}
      {chrome}
    </div>
  )
}
