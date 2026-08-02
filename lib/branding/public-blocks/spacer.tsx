'use client'

import { ReactNode } from 'react'

// Type-only import (erased at runtime); block types live under the editor surface.
// eslint-disable-next-line no-restricted-imports
import type { SpacerBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'

/**
 * Renders a spacer block on public surfaces (invoice, contract, portal).
 * Outputs an empty div with the specified height to create vertical gaps.
 * The editor injects a resize handle via the chrome prop.
 */
export function RenderSpacer({
  block,
  branding,
  chrome,
}: {
  block: SpacerBlock
  branding: PublicBranding
  chrome?: ReactNode
}) {
  const heightPx = block.heightPx ?? 32

  return <div style={{ height: heightPx }}>{chrome}</div>
}
