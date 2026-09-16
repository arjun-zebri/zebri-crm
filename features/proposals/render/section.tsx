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
import { VideoPlayer } from '@/lib/branding/public-blocks/proposal/media'
import type { ProposalSlotProps, PublicDocData } from '@/lib/branding/public-blocks/shared'
import type { PublicBranding } from '@/lib/branding/public-branding'

import type { ButtonAction } from '../model/doc'
import type { Section } from '../model/layout'

import { DataSectionView } from './data-section'
import { isHttpUrl, RichDocView, type RenderMode } from './rich-doc'
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
  const bg = section.style.background
  const overlay = Math.min(100, Math.max(0, bg?.overlay ?? 0)) / 100
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
      {bg?.image && isHttpUrl(bg.image) ? (
        // eslint-disable-next-line @next/next/no-img-element -- MC-uploaded section background
        <img src={bg.image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" fetchPriority={index === 0 ? 'high' : 'auto'} />
      ) : null}
      {bg?.video && isHttpUrl(bg.video) ? (
        <div className="absolute inset-0">
          <VideoPlayer
            url={bg.video}
            posterUrl={bg.poster && isHttpUrl(bg.poster) ? bg.poster : undefined}
            background
            frame={mode === 'print' ? 'print' : 'page'}
          />
        </div>
      ) : null}
      {(bg?.image || bg?.video) && overlay > 0 ? (
        <div aria-hidden data-section-overlay className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay})` }} />
      ) : null}
      <div className={`relative mx-auto flex w-full flex-col justify-center px-4 @sm/doc:px-8 ${columnClass}`} style={column}>
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
