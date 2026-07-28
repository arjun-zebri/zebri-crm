/**
 * Editor preview of the multi-package proposal view.
 *
 * When the MC flips the proposal layout to "Multi", the canvas shows this live
 * preview instead of the editable single-package block canvas: the same block
 * tree rendered with three sample packages, so the compare-and-pick region
 * (chooser + selected package's add-ons + total) appears exactly as a couple
 * would see it, styled from the MC's branding. Picking a card and toggling
 * add-ons work locally so the MC can explore; the wording labels are editable
 * inline via `onEditLabel`. Never used on a sent document.
 *
 * @module components/proposal/proposal-multi-preview
 */
'use client'

import { useState } from 'react'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { publicBrandingFromEditorState } from '@/app/(dashboard)/branding/editor-branding'
import type { ProposalLabelEdit } from '@/lib/branding/proposal-labels'
import { defaultSelection } from '@/lib/payments/proposal-view'
import type { BrandPreviewState } from '@/types/branding-preview'

import { ProposalBlocksRenderer } from './proposal-blocks-renderer'
import { viewBranding } from './proposal-page-view'
import { PROPOSAL_SAMPLE_MULTI } from './proposal-sample-data'

export interface ProposalMultiPreviewProps {
  /** The proposal block tree being edited (chrome + package region). */
  blocks: Block[]
  /** The editor's live branding state, mapped to public branding for render. */
  state: BrandPreviewState
  /** Commit an inline edit of a multi-package wording label. */
  onEditLabel?: ProposalLabelEdit
}

/**
 * Render the multi-package proposal preview with sample packages.
 */
export function ProposalMultiPreview({ blocks, state, onEditLabel }: ProposalMultiPreviewProps) {
  const branding = publicBrandingFromEditorState(state)
  const view = viewBranding(branding)
  const options = PROPOSAL_SAMPLE_MULTI

  // The popular "Full Day" package is the default selection so the preview
  // opens on a package that has add-ons to show.
  const [chosenId, setChosenId] = useState(options[1]!.id)
  const [selection, setSelection] = useState<Record<string, boolean>>(() =>
    defaultSelection(options[1]!),
  )

  return (
    <ProposalBlocksRenderer
      blocks={blocks}
      branding={branding}
      view={view}
      options={options}
      chosenId={chosenId}
      selection={selection}
      state="active"
      expiresAt={null}
      onChoose={(id) => {
        setChosenId(id)
        const opt = options.find((o) => o.id === id)
        if (opt) setSelection(defaultSelection(opt))
      }}
      onToggle={(itemId, next) => setSelection((s) => ({ ...s, [itemId]: next }))}
      onEditLabel={onEditLabel}
    />
  )
}
