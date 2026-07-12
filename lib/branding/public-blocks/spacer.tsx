'use client'

// Type-only import (erased at runtime); block types live under the editor surface.
// eslint-disable-next-line no-restricted-imports
import type { SpacerBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../public-surface'

/**
 * Renders a spacer block on public surfaces (proposal, invoice, contract, portal).
 * Outputs an empty div with the specified height to create vertical gaps.
 */
export function RenderSpacer({
  block,
}: {
  block: SpacerBlock
  branding: PublicBranding
}) {
  const heightPx = block.heightPx ?? 32

  return <div style={{ height: heightPx }} />
}
