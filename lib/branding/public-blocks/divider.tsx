'use client'

// eslint-disable-next-line no-restricted-imports
import type { DividerBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { pad } from './shared'

export function RenderDivider({
  block,
  branding,
}: {
  block: DividerBlock
  branding: PublicBranding
}) {
  const p = pad(branding)
  const thickness = block.thickness ?? 1
  const color = block.color ?? '#E5E7EB'
  const lineStyle = block.lineStyle ?? 'solid'
  const widthPct = block.widthPct ?? 100
  return (
    <div className={`${p.docX} ${p.blockY} flex justify-start`}>
      <hr
        style={{
          borderTopWidth: thickness,
          borderTopColor: color,
          borderTopStyle: lineStyle,
          borderBottom: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          width: `${widthPct}%`,
        }}
      />
    </div>
  )
}
