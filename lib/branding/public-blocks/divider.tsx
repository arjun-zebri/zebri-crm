'use client'

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
  return (
    <div className={`${p.docX} ${p.blockY}`}>
      <hr
        style={{
          borderTopWidth: thickness,
          borderTopColor: color,
          borderTopStyle: lineStyle,
          borderBottom: 'none',
          borderLeft: 'none',
          borderRight: 'none',
        }}
      />
    </div>
  )
}
