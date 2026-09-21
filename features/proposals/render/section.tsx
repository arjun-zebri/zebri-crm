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
import type { ProposalTheme } from '../model/theme'

import { DataSectionView, type DataSectionSlots } from './data-section'
import { RichDocView, type RenderMode } from './rich-doc'
import { SectionBackdrop } from './section-backdrop'
import { sectionCss } from './section-style'

/** Props for {@link SectionView}. */
export interface SectionViewProps {
  section: Section
  index: number
  branding: PublicBranding
  /** The layout's canvas theme (`model/theme.ts`): text roles, inherited padding, section gap, reveal animation and flow. */
  theme: ProposalTheme
  doc: PublicDocData
  mode: RenderMode
  values: Record<string, string>
  proposal?: ProposalSlotProps | undefined
  onAction?: ((action: ButtonAction) => void) | undefined
  /** Editor-only (Slice E1): a data section's live inline editors, handed straight through to `DataSectionView`. `undefined` on the public page and print, which never pass it. */
  slots?: DataSectionSlots | undefined
  /** Forwarded to `DataSectionView` - see its own doc comment. */
  defaultSelection?: boolean | undefined
  /** Step flow: true for the first section on a page, which never carries the theme's section gap above it (the gap is between sections on a page, not between the page's top and its first section). */
  pageStart?: boolean | undefined
}

/** Renders one layout section: background, reveal, content column, and the content/data switch. */
export function SectionView({ section, index, branding, theme, doc, mode, values, proposal, onAction, slots, defaultSelection, pageStart }: SectionViewProps) {
  const { section: sectionStyle, column, columnClass, justifyClass } = sectionCss(section.style, mode, theme)
  const { animation } = theme
  // Reveal only ever runs on the live page. `section` mode skips the
  // opening section (on screen at load; animating it would only delay the
  // first paint) and reveals the rest as they scroll in; `together` plays
  // every section, the first included, once on load.
  const animate = mode === 'page' && animation.mode !== 'none' && (animation.mode === 'together' || index > 0)
  const { ref, revealed } = useReveal(animate && animation.mode === 'section')
  const ctx = { branding, theme, mode, values, textColor: section.style.textColor, align: section.style.align, onAction }

  return (
    <section
      ref={ref}
      data-section-id={section.id}
      data-section-kind={section.kind}
      // `data-reveal`/`data-anim` drive the keyframes in `globals.css`
      // (`[data-reveal=in][data-anim=fade|slide]`); the duration comes from
      // `--doc-anim-ms`, set once on the layout root from the theme's speed.
      // `pending` keeps a not-yet-seen section invisible only while JS
      // runs (see `useReveal`); reduced-motion and print force it visible.
      data-reveal={animate ? (revealed ? 'in' : 'pending') : undefined}
      data-anim={animate ? animation.type : undefined}
      // `hideOnMobile` keys off the `@container/doc` every host wraps this
      // render in (public page, editor canvas, Preview), not the viewport:
      // the editor's mobile canvas and mobile Preview are a ~390px column
      // inside a desktop window, so a viewport `max-md:` never fired there
      // and a section marked "Hide on phone" stayed visible. `3xl` is
      // 48rem, the same 768px cut-off the old viewport `md` had, so real
      // phones and tablets hide exactly what they did before.
      // Step flow: the page is the screen and snaps (`layout.tsx`); a
      // section keeps its natural height on it (2026-09-19: "still forcing
      // all sections to be full height" when they shared the page), and
      // only one whose own Height is `full` grows to fill the page - the
      // hero case, same control as in stack flow.
      className={`relative flex w-full overflow-hidden ${section.hideOnMobile ? '@max-3xl/doc:hidden' : ''} ${
        theme.flow === 'step' && mode !== 'print' && section.style.height === 'full' ? 'grow' : ''
      }`}
      style={{ ...sectionStyle, marginTop: index > 0 && !pageStart && theme.sectionGap ? theme.sectionGap : undefined }}
    >
      <SectionBackdrop background={section.style.background} index={index} mode={mode} />
      {/* `data-content-column` marks the resizable box for the editor's
          `SectionResizeOverlay` (Task 12): a data attribute rather than a
          new element, so `mode: 'page'`/`'print'` render exactly the same
          markup the public page always has. */}
      <div data-content-column data-align={section.style.align} className={`relative mx-auto flex w-full flex-col ${justifyClass} ${columnClass}`} style={column}>
        {section.intro ? <RichDocView doc={section.intro} ctx={ctx} /> : null}
        {section.kind === 'content' && section.content ? (
          <RichDocView doc={section.content} ctx={ctx} />
        ) : section.kind !== 'content' ? (
          <>
            <DataSectionView section={section} branding={branding} doc={doc} mode={mode} proposal={proposal} values={values} slots={slots} defaultSelection={defaultSelection} />
            {slots?.after}
          </>
        ) : null}
      </div>
    </section>
  )
}
