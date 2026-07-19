'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { TitleBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { roleDefaults } from '../type-defaults'

import { Html } from './html'
import { fmtDate, pad, type PublicDocData } from './shared'

export interface TitleSlots {
  /** Editor replaces static title with live InlineText. */
  title?: ReactNode
  /** Editor replaces static subtitle with live InlineText. */
  subtitle?: ReactNode
}

export function RenderTitle({
  block,
  branding,
  doc,
  slots,
  chrome,
}: {
  block: TitleBlock
  branding: PublicBranding
  doc: PublicDocData
  slots?: TitleSlots
  chrome?: ReactNode
}) {
  const p = pad(branding)
  const titleDefaults = roleDefaults(branding, 'docTitle')
  const subtitleDefaults = roleDefaults(branding, 'subtitle')
  const titleCss = resolveTextStyle(block.titleStyle, titleDefaults)
  const subtitleCss = resolveTextStyle(block.subtitleStyle, subtitleDefaults)
  const metaAlign = block.titleStyle?.align ?? 'left'

  return (
    <div className={p.blockY}>
      <div className={p.docX}>
        <h1 className="leading-tight tracking-tight" style={titleCss}>
          {slots?.title ?? doc.title}
        </h1>
        {slots?.subtitle ? (
          <p className="mt-2" style={subtitleCss}>
            {slots.subtitle}
          </p>
        ) : block.subtitle ? (
          <p className="mt-2" style={subtitleCss}>
            <Html value={block.subtitle} allowLists={false} />
          </p>
        ) : null}
      </div>
      {(block.showRef || block.showExpires || block.showAbn) && (
        <div
          className={`${p.docX} mt-3 flex flex-wrap items-baseline gap-x-4 @sm/doc:gap-x-8 gap-y-2`}
          style={{ justifyContent: metaAlign === 'center' ? 'center' : metaAlign === 'right' ? 'flex-end' : 'flex-start' }}
        >
          {block.showRef && doc.refNumber && <Meta label="Ref" value={doc.refNumber} branding={branding} />}
          {block.showExpires && doc.expiresAt && (
            <Meta label="Expires" value={fmtDate(doc.expiresAt)} branding={branding} />
          )}
          {block.showAbn && branding.abn && (
            <Meta label="ABN" value={branding.abn} branding={branding} />
          )}
        </div>
      )}
      {chrome}
    </div>
  )
}

function Meta({ label, value, branding }: { label: string; value: ReactNode; branding: PublicBranding }) {
  const labelDefaults = roleDefaults(branding, 'sectionLabel')
  const valueDefaults = roleDefaults(branding, 'body')
  const labelCss = resolveTextStyle({}, labelDefaults)
  const valueCss = resolveTextStyle({}, valueDefaults)

  return (
    <div className="flex items-baseline gap-2">
      <span style={labelCss}>{label}</span>
      <span style={valueCss}>{value}</span>
    </div>
  )
}
