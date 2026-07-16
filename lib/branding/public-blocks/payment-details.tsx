'use client'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { PaymentDetailsBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { pad } from './shared'
import { Html } from './html'

export function RenderPaymentDetails({
  block,
  branding,
}: {
  block: PaymentDetailsBlock
  branding: PublicBranding
}) {
  const p = pad(branding)
  const headingDefaults: TextStyleDefaults = {
    fontFamily: branding.font_heading,
    fontSize: 16,
    fontWeight: branding.font_weight,
    color: branding.text_color || '#111827',
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
    <div className={`${p.docX} ${p.blockY}`}>
      <p className="mb-3" style={headingCss}>
        <Html value={block.heading} allowLists={false} />
      </p>
      <div className="space-y-1.5">
        <div className="flex items-baseline gap-3">
          <span className="w-28 shrink-0" style={labelCss}>Account name</span>
          <span className="flex-1" style={valueCss}><Html value={accountName} allowLists={false} /></span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="w-28 shrink-0" style={labelCss}>BSB</span>
          <span className="flex-1" style={valueCss}><Html value={bsb} allowLists={false} /></span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="w-28 shrink-0" style={labelCss}>Account number</span>
          <span className="flex-1" style={valueCss}><Html value={accountNumber} allowLists={false} /></span>
        </div>
      </div>
    </div>
  )
}
