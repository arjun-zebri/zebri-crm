'use client'

/**
 * One full-bleed section (spec §6): background layers (colour → image →
 * video → overlay), the centred content column, reveal-on-scroll (never
 * on the first section, never in print), and `hideOnMobile`. A video
 * background renders its `poster` image in place of the video in print
 * mode (`VideoPlayer`'s own `frame` branch), so print never shows a blank
 * box where the couple's page shows a playing video.
 *
 * @module features/proposals/render/section
 */
import { useReveal } from '@/lib/branding/page-section'
import type { ProposalSlotProps, PublicDocData } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { ButtonAction } from '../model/doc'
import type { Section } from '../model/layout'

import { DataSectionView } from './data-section'
import { RichDocView, type RenderMode } from './rich-doc'
import { SectionBackdrop } from './section-backdrop'
import { sectionCss } from './section-style'

/** Props for {@link SectionView}. */
export interface SectionViewProps {
  section: Section
  index: number
  branding: PublicBranding
  doc: PublicDocData
  mode: RenderMode
  values: Record<string, string>
  proposal?: ProposalSlotProps | undefined
  onAction?: ((action: ButtonAction) => void) | undefined
}

/** Renders one layout section: background, reveal, content column, and the content/data switch. */
export function SectionView({ section, index, branding, doc, mode, values, proposal, onAction }: SectionViewProps) {
  const { section: sectionStyle, column, columnClass } = sectionCss(section.style, mode)
  // The opening section is on screen at load; animating it would only delay the first paint.
  const animate = mode === 'page' && index > 0
  const { ref, revealed } = useReveal(animate)
  const ctx = { branding, mode, values, textColor: section.style.textColor, align: section.style.align, onAction }

  return (
    <section
      ref={ref}
      data-section-id={section.id}
      data-section-kind={section.kind}
      className={`relative flex w-full overflow-hidden ${section.hideOnMobile ? 'max-md:hidden' : ''} ${
        animate ? (revealed ? 'animate-reveal-up' : 'opacity-0 motion-reduce:opacity-100 print:opacity-100') : ''
      }`}
      style={sectionStyle}
    >
      <SectionBackdrop background={section.style.background} index={index} mode={mode} />
      {/* `data-content-column` marks the resizable box for the editor's
          `SectionResizeOverlay` (Task 12): a data attribute rather than a
          new element, so `mode: 'page'`/`'print'` render exactly the same
          markup the public page always has. */}
      <div data-content-column className={`relative mx-auto flex w-full flex-col justify-center px-4 @sm/doc:px-8 ${columnClass}`} style={column}>
        {section.intro ? <RichDocView doc={section.intro} ctx={ctx} /> : null}
        {section.kind === 'content' && section.content ? (
          <RichDocView doc={section.content} ctx={ctx} />
        ) : section.kind !== 'content' ? (
          <DataSectionView section={section} branding={branding} doc={doc} mode={mode} proposal={proposal} values={values} />
        ) : null}
      </div>
    </section>
  )
}
