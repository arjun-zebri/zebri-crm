'use client'

import { publicBrandingFromEditorState } from '@/app/(dashboard)/branding/editor-branding'
import { RenderIntroNote, type IntroNoteSlots } from '@/lib/branding/public-blocks/proposal/intro-note'
import { renderRichText } from '@/lib/branding/render-rich-text'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import type { ProposalRenderExtras, UpdateBlock } from '../render-proposal'
import { SAMPLE_DOC_BY_SURFACE } from '../sample-doc'
import type { IntroNoteBlock } from '../types'

import { ProposalText } from './proposal-text'

interface EditIntroNoteProps {
  block: IntroNoteBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: UpdateBlock
  extras: ProposalRenderExtras
}

/**
 * Editor renderer for the proposal intro-note marker. The small heading
 * above the note is a per-template setting, so it stays inline-editable; the
 * note itself is written per proposal in the builder, never here, so the
 * canvas shows the sample proposal's note as a muted stand-in under a caption
 * saying so. The caption sits above the text (a chip after three paragraphs
 * read as a fourth), and the stand-in is dimmed so it does not look like a
 * field that refuses to take a cursor. Clicking it still selects the block
 * and points the toolbar's typography at the note (`data-subtarget="note"`).
 */
export function EditIntroNote({ block, state, updateBlock }: EditIntroNoteProps) {
  const branding = publicBrandingFromEditorState(state)
  const doc = SAMPLE_DOC_BY_SURFACE.proposal
  const noteHtml = doc.proposal ? renderRichText(doc.proposal.introNote, { couple_name: doc.coupleName ?? '' }) : ''

  const slots: IntroNoteSlots = {
    heading: (
      <ProposalText
        subtarget="heading"
        value={block.heading}
        onChange={(v) => updateBlock<IntroNoteBlock>(block.id, { heading: v })}
        placeholder="Heading"
      />
    ),
    note: (
      <div data-subtarget="note">
        <span
          className="inline-flex items-center rounded-control px-1.5 py-px mb-2 text-body font-medium select-none"
          style={{ backgroundColor: '#D1FAE5', color: '#047857' }}
        >
          Note · written per proposal in the builder
        </span>
        <div data-sample-note className="[&_p]:mb-3 opacity-60 select-none" dangerouslySetInnerHTML={{ __html: noteHtml }} />
      </div>
    ),
  }

  return <RenderIntroNote block={block} branding={branding} doc={doc} slots={slots} />
}
