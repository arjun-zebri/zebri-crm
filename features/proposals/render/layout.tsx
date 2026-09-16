'use client'

/**
 * The whole proposal page from a v2 layout (spec §6): resolves variables
 * once, then renders every section in order. Used by the couple's page
 * (`mode: 'page'`), the PDF path (`'print'`) and, from Phase 2, the
 * editor canvas (`'edit'`).
 *
 * @module features/proposals/render/layout
 */
import type { ProposalSlotProps, PublicDocData } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { bodyFontFamily } from '@/lib/branding/public-surface'

import type { ButtonAction } from '../model/doc'
import type { ProposalLayout } from '../model/layout'
import { resolveProposalVariables } from '../model/variables'

import type { RenderMode } from './rich-doc'
import { SectionView } from './section'

/** Props for {@link ProposalLayoutView}. */
export interface ProposalLayoutViewProps {
  layout: ProposalLayout
  branding: PublicBranding
  doc: PublicDocData
  mode: RenderMode
  proposal?: ProposalSlotProps | undefined
  /** Receives rich-doc button actions (accept / decline / jump). */
  onAction?: ((action: ButtonAction) => void) | undefined
}

/** Renders a whole v2 proposal layout: one full-bleed `<section>` per layout section, in order. */
export function ProposalLayoutView({ layout, branding, doc, mode, proposal, onAction }: ProposalLayoutViewProps) {
  const values = resolveProposalVariables(branding, doc)
  return (
    <div
      className="@container/doc [&_a]:[color:var(--doc-link)]"
      style={{ background: branding.page_background, color: branding.text_color, fontFamily: bodyFontFamily(branding), ['--doc-link' as string]: branding.link_color }}
    >
      {layout.sections.map((section, index) => (
        <SectionView key={section.id} section={section} index={index} branding={branding} doc={doc} mode={mode} values={values} proposal={proposal} onAction={onAction} />
      ))}
    </div>
  )
}
