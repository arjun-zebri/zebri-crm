'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { PaymentDetailsBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'

import { Html } from './html'
import { pad } from './shared'

export interface PaymentDetailsSlots {
  /** Editor slot for the heading text. */
  heading?: ReactNode
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
  chrome,
}: {
  block: PaymentDetailsBlock
  branding: PublicBranding
  slots?: PaymentDetailsSlots
  chrome?: ReactNode
}) {
  const p = pad(branding)
  const headingDefaults: TextStyleDefaults = {
    fontFamily: branding.font_heading,
    fontSize: 16,
    fontWeight: branding.font_weight,
    color: branding.heading_color || '#111827',
    align: 'left',
    lineHeight: 1.3,
    letterSpacing: 0,
  }
  const labelDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 12,
    fontWeight: 500,
    color: branding.muted_color || '#6B7280',
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
  }
  const valueDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 14,
    fontWeight: 500,
    color: branding.text_color || '#111827',
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
  }

  const headingCss = resolveTextStyle(block.headingStyle, headingDefaults)
  const labelCss = resolveTextStyle(block.labelStyle, labelDefaults)
  const valueCss = resolveTextStyle(block.valueStyle, valueDefaults)

  // Values come from the MC's real bank settings only. If a setting is blank,
  // render it blank — never fall back to the block's placeholder template text.
  const accountName = branding.bank_account_name || ''
  const bsb = branding.bank_bsb || ''
  const accountNumber = branding.bank_account_number || ''

  return (
    <div className={`${p.docX} ${p.blockY} relative`}>
      <p className="mb-3" style={headingCss}>
        {slots?.heading ?? <Html value={block.heading} allowLists={false} />}
      </p>
      <div className="space-y-1.5">
        <div className="flex flex-col gap-0.5 @sm/doc:flex-row @sm/doc:items-baseline @sm/doc:gap-3">
          <span className="shrink-0 @sm/doc:w-28" style={labelCss}>Account name</span>
          <span className="flex-1" style={valueCss}>{slots?.accountName ?? <Html value={accountName} allowLists={false} />}</span>
        </div>
        <div className="flex flex-col gap-0.5 @sm/doc:flex-row @sm/doc:items-baseline @sm/doc:gap-3">
          <span className="shrink-0 @sm/doc:w-28" style={labelCss}>BSB</span>
          <span className="flex-1" style={valueCss}>{slots?.bsb ?? <Html value={bsb} allowLists={false} />}</span>
        </div>
        <div className="flex flex-col gap-0.5 @sm/doc:flex-row @sm/doc:items-baseline @sm/doc:gap-3">
          <span className="shrink-0 @sm/doc:w-28" style={labelCss}>Account number</span>
          <span className="flex-1" style={valueCss}>{slots?.accountNumber ?? <Html value={accountNumber} allowLists={false} />}</span>
        </div>
      </div>
      {chrome}
    </div>
  )
}
