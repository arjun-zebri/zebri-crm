'use client'

import type { ReactNode } from 'react'
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
import type { TitleBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { PublicBranding } from '../public-surface'
import { fmtDate, pad, type PublicDocData } from './shared'
import { Html } from './html'

export function RenderTitle({
  block,
  branding,
  doc,
}: {
  block: TitleBlock
  branding: PublicBranding
  doc: PublicDocData
}) {
  const p = pad(branding)
  const titleDefaults: TextStyleDefaults = {
    fontFamily: branding.font_heading,
    fontSize: 36,
    fontWeight: branding.font_weight,
    color: branding.text_color || '#111827',
    align: 'left',
    lineHeight: 1.1,
    letterSpacing: -0.01,
  }
  const subtitleDefaults: TextStyleDefaults = {
    fontFamily: branding.font_body,
    fontSize: 14,
    fontWeight: branding.font_body_weight,
    color: branding.muted_color || '#6B7280',
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
  }
  const titleCss = resolveTextStyle(block.titleStyle, titleDefaults)
  const subtitleCss = resolveTextStyle(block.subtitleStyle, subtitleDefaults)
  const metaAlign = block.titleStyle?.align ?? 'left'

  return (
    <div className={p.blockY}>
      <div className={p.docX}>
        <h1 className="leading-tight tracking-tight" style={titleCss}>{doc.title}</h1>
        {block.subtitle && (
          <p className="mt-2" style={subtitleCss}>
            <Html value={block.subtitle} allowLists={false} />
          </p>
        )}
      </div>
      {(block.showRef || block.showExpires || block.showAbn) && (
        <div
          className={`${p.docX} mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2`}
          style={{ justifyContent: metaAlign === 'center' ? 'center' : metaAlign === 'right' ? 'flex-end' : 'flex-start' }}
        >
          {block.showRef && doc.refNumber && <Meta label="Ref" value={doc.refNumber} muted={branding.muted_color} />}
          {block.showExpires && doc.expiresAt && (
            <Meta label="Expires" value={fmtDate(doc.expiresAt)} muted={branding.muted_color} />
          )}
          {block.showAbn && branding.abn && (
            <Meta label="ABN" value={branding.abn} muted={branding.muted_color} />
          )}
        </div>
      )}
    </div>
  )
}

function Meta({ label, value, muted }: { label: string; value: ReactNode; muted: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: muted }}>{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}
