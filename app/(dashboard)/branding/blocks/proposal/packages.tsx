'use client'

import { publicBrandingFromEditorState } from '@/app/(dashboard)/branding/editor-branding'
import { RenderPackages, type PackagesSlots } from '@/lib/branding/public-blocks/proposal/packages'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import type { ProposalRenderExtras, UpdateBlock } from '../render-proposal'
import { SAMPLE_DOC_BY_SURFACE } from '../sample-doc'
import type { PackagesBlock } from '../types'

import { ProposalText } from './proposal-text'

interface EditPackagesProps {
  block: PackagesBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: UpdateBlock
  extras: ProposalRenderExtras
}

/**
 * Editor renderer for the proposal packages marker. The option cards,
 * inclusions and add-on toggles all come from the sample proposal (a real
 * proposal's options live on that proposal, never on this template block),
 * so the whole card area is inert (`pointer-events-none select-none`, no
 * `proposal` slot, so `resolveSelection` falls back to its default pick);
 * only the heading stays inline-editable, re-enabled with its own
 * `pointer-events-auto` so the wrapper's block doesn't swallow its clicks.
 */
export function EditPackages({ block, state, updateBlock }: EditPackagesProps) {
  const branding = publicBrandingFromEditorState(state)
  const doc = SAMPLE_DOC_BY_SURFACE.proposal

  const slots: PackagesSlots = {
    heading: (
      <span className="pointer-events-auto select-auto">
        <ProposalText
          subtarget="heading"
          value={block.heading}
          onChange={(v) => updateBlock<PackagesBlock>(block.id, { heading: v })}
          placeholder="Heading"
        />
      </span>
    ),
  }

  return (
    <div className="pointer-events-none select-none">
      <RenderPackages block={block} branding={branding} doc={doc} slots={slots} />
    </div>
  )
}
