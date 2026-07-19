'use client'

import { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { TaglineBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'
import { roleDefaults } from '../type-defaults'

import { Html } from './html'
import { pad } from './shared'

export interface TaglineSlots {
  /** Editor replaces static tagline with live InlineText. */
  text?: ReactNode
}

export function RenderTagline({
  block,
  branding,
  slots,
  chrome,
}: {
  block: TaglineBlock
  branding: PublicBranding
  slots?: TaglineSlots
  chrome?: ReactNode
}) {
  if (!branding.tagline && !slots?.text) return null
  const p = pad(branding)
  const defaults = roleDefaults(branding, 'subtitle')
  return (
    <div className={`${p.docX} ${p.blockY}`}>
      <p style={resolveTextStyle(block.textStyle, defaults)}>
        {slots?.text ?? (
          <Html value={branding.tagline!} allowLists={false} />
        )}
      </p>
      {chrome}
    </div>
  )
}
