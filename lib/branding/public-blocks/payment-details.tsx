'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, caseText } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { PaymentDetailsBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { renderRichText } from '../render-rich-text'
import { roleDefaults } from '../type-defaults'

import { Html } from './html'
import { pad } from './shared'
import { VarChip } from './var-chip'

export interface PaymentDetailsSlots {
  /** Editor slot for the heading text. */
  heading?: ReactNode
  /** Editor slot for the instruction note under the heading. */
  note?: ReactNode
  /** Editor slot for the account name value. */
  accountName?: ReactNode
  /** Editor slot for the BSB value. */
  bsb?: ReactNode
  /** Editor slot for the account number value. */
  accountNumber?: ReactNode
}

export function RenderPaymentDetails({
  block,
  branding,
  slots,
  variableValues,
  variablePreview = false,
  chrome,
}: {
  block: PaymentDetailsBlock
  branding: PublicBranding
  slots?: PaymentDetailsSlots
  /** Variable id -> display value map for resolving chips in the heading. */
  variableValues?: Record<string, string>
  /**
   * Editor-only: bank details come from Settings → Payments. When a field is
   * blank, show a mint `{{ … }}` placeholder so the MC knows to fill it there;
   * the sent document just omits blank fields.
   */
  variablePreview?: boolean
  chrome?: ReactNode
}) {
  const p = pad(branding)
  const headingDefaults = roleDefaults(branding, 'sectionHeading')
  const labelDefaults = roleDefaults(branding, 'sectionLabel')
  const valueDefaults = roleDefaults(branding, 'body')

  const headingCss = resolveTextStyle(block.headingStyle, headingDefaults)
  const labelCss = resolveTextStyle(block.labelStyle, labelDefaults)
  const valueCss = resolveTextStyle(block.valueStyle, valueDefaults)
  const noteCss = resolveTextStyle(block.noteStyle, valueDefaults)

  // Optional instruction under the heading (e.g. "Please transfer the total to
  // the account below"). Editable via the note slot; on the sent document it
  // renders only when the MC wrote one.
  const noteNode =
    slots?.note !== undefined ? (
      <p data-subtarget="note" className="mb-3" style={noteCss}>{slots.note}</p>
    ) : block.note ? (
      <p data-subtarget="note" className="mb-3" style={noteCss}>{block.note}</p>
    ) : null

  // Values come from the MC's real bank settings only. A blank field renders as a
  // mint placeholder in the editor (variablePreview) and is simply omitted on the
  // sent document — never the block's old template text.
  const accountName = branding.bank_account_name || ''
  const bsb = branding.bank_bsb || ''
  const accountNumber = branding.bank_account_number || ''
  const renderValue = (value: string, chip: string, hint: string) =>
    value ? <Html value={value} allowLists={false} /> : variablePreview ? <VarChip label={chip} hint={hint} /> : null

  return (
    <div className={`${p.blockY} relative`}>
      {/* Container is a <div> (not <p>): rich text renders block-level <p>, so a
          <p> wrapper would nest invalidly and break hydration. */}
      <div className="mb-3 [&_p]:m-0" style={headingCss}>
        {slots?.heading ?? (
          <div dangerouslySetInnerHTML={{ __html: renderRichText(block.heading, variableValues ?? {}) }} />
        )}
      </div>
      {noteNode}
      <div className="space-y-1.5">
        <div className="flex flex-col gap-0.5 @sm/doc:flex-row @sm/doc:items-baseline @sm/doc:gap-3">
          <span data-subtarget="label" className="shrink-0 @sm/doc:w-28" style={labelCss}>{caseText('Account name', block.labelStyle, labelDefaults)}</span>
          <span data-subtarget="value" className="flex-1" style={valueCss}>{slots?.accountName ?? renderValue(accountName, 'Account name', 'Your account name, from Settings → Payments.')}</span>
        </div>
        <div className="flex flex-col gap-0.5 @sm/doc:flex-row @sm/doc:items-baseline @sm/doc:gap-3">
          <span data-subtarget="label" className="shrink-0 @sm/doc:w-28" style={labelCss}>{caseText('BSB', block.labelStyle, labelDefaults)}</span>
          <span data-subtarget="value" className="flex-1" style={valueCss}>{slots?.bsb ?? renderValue(bsb, 'BSB', 'Your BSB, from Settings → Payments.')}</span>
        </div>
        <div className="flex flex-col gap-0.5 @sm/doc:flex-row @sm/doc:items-baseline @sm/doc:gap-3">
          <span data-subtarget="label" className="shrink-0 @sm/doc:w-28" style={labelCss}>{caseText('Account number', block.labelStyle, labelDefaults)}</span>
          <span data-subtarget="value" className="flex-1" style={valueCss}>{slots?.accountNumber ?? renderValue(accountNumber, 'Account number', 'Your account number, from Settings → Payments.')}</span>
        </div>
      </div>
      {chrome}
    </div>
  )
}
