'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle, type TextStyleDefaults } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { HeroBackground, HeroBlock } from '@/app/(dashboard)/branding/blocks/types'
import type { HeroOverride } from '@/lib/proposals/types'

import type { PublicBranding } from '../../public-surface'
import { renderRichText, renderRichTextInline } from '../../render-rich-text'
import { roleDefaults } from '../../type-defaults'
import type { FrameMode, PublicDocData } from '../shared'

import { EmbedFrame, VideoPlayer } from './media'

/** Editor slots that replace the static heading / subheading / media with live inline editors. */
export interface HeroSlots {
  heading?: ReactNode
  subheading?: ReactNode
  media?: ReactNode
}

/** The legacy Full / Tall / Short presets as viewport shares (R6). */
const PRESET_VH: Record<HeroBlock['height'], number> = { full: 100, tall: 70, short: 45 }
/** Bounds of the dragged height: below 30 the heading no longer fits, 100 is one screen. */
export const HERO_MIN_VH = 30
export const HERO_MAX_VH = 100
/**
 * The `document` / `print` frame has no viewport to be a share of: a
 * full-screen hero is the 720px document card's 480px opening, and smaller
 * heights scale down from there.
 */
const FULL_HEIGHT_DOCUMENT_PX = 480

/**
 * The hero's height as a share of the couple's viewport: the dragged value
 * when the MC has resized it, else the legacy preset the block was saved
 * with. Clamped so a hand-edited or pre-clamp value cannot collapse the
 * section or grow past one screen.
 */
export function heroHeightVh(block: HeroBlock): number {
  const vh = block.heightVh ?? PRESET_VH[block.height]
  return Math.min(HERO_MAX_VH, Math.max(HERO_MIN_VH, Math.round(vh)))
}

/**
 * Heading size on the page frame when the MC has not set one. Fluid so a
 * long couple name on a phone (the 380px canvas, a real handset) does not
 * run to three lines at desktop size: 40px on a phone, 56px from tablet up.
 * Container units, not viewport units, so the mobile canvas inside the
 * desktop editor window scales the same way the sent page will.
 */
const FLUID_HEADING_SIZE = 'clamp(40px, 10.5cqw, 56px)'

/**
 * A per-proposal hero override replaces the block's saved background without
 * touching the block itself (D3: the MC picks one hero image/video
 * per proposal, but the block's own default stays reusable across proposals).
 * Image wins over embed wins over video: an MC who sets an image after
 * trying a video shouldn't need to also clear the video field.
 */
function resolveBackground(block: HeroBlock, override: HeroOverride | null | undefined): HeroBackground {
  if (override?.imagePath) return { kind: 'image', url: override.imagePath }
  if (override?.embedUrl) return { kind: 'embed', url: override.embedUrl }
  if (override?.videoPath) return { kind: 'video', url: override.videoPath }
  return block.background
}

/**
 * Vertical placement of the hero text. Blocks saved before `verticalAlign`
 * existed keep the look they were designed with: centred text in the middle
 * of the section, left-aligned text at the bottom.
 */
export function heroVerticalAlign(block: HeroBlock): 'top' | 'middle' | 'bottom' {
  return block.verticalAlign ?? (block.textAlign === 'center' ? 'middle' : 'bottom')
}

/**
 * The text defaults the hero actually renders with, for both the public page
 * and the editor toolbar, so the toolbar's size stepper and colour swatch
 * show what is on screen (56px white over media, not the 32px brand-coloured
 * document title it once displayed). The hero is a full-height section with
 * or without media, so the type scales up in both cases; only the colour
 * depends on media (white over a photo or video, the brand text colour on a
 * plain surface).
 */
export function heroTextDefaults(
  branding: PublicBranding,
  block: HeroBlock,
  frame: FrameMode,
): { heading: TextStyleDefaults; subheading: TextStyleDefaults } {
  const hasMedia = block.background.kind !== 'none'
  return {
    heading: {
      ...roleDefaults(branding, 'docTitle'),
      ...(hasMedia ? { color: '#FFFFFF' } : {}),
      fontSize: frame === 'page' ? 56 : 40,
      align: block.textAlign,
    },
    subheading: {
      ...roleDefaults(branding, 'body'),
      ...(hasMedia ? { color: '#FFFFFF' } : {}),
      fontSize: 20,
      align: block.textAlign,
    },
  }
}

const VALIGN_CLASS = { top: 'items-start', middle: 'items-center', bottom: 'items-end' } as const
const HALIGN_CLASS = { left: 'justify-start text-left', center: 'justify-center text-center', right: 'justify-end text-right' } as const

/**
 * The proposal's opening section: a full-bleed background (image, video, or
 * embed, or none) behind the couple's names. Always renders; an untouched
 * hero still shows the heading over the brand colour.
 */
export function RenderHero({
  block,
  branding,
  doc,
  frame,
  variableValues,
  slots,
  chrome,
  canvasViewportHeight,
}: {
  block: HeroBlock
  branding: PublicBranding
  doc: PublicDocData
  frame: FrameMode
  variableValues?: Record<string, string>
  slots?: HeroSlots
  chrome?: ReactNode
  /**
   * Height in px of the viewport a `page` frame is being simulated in. The
   * editor canvas passes this: svh units there resolve against the browser
   * window, not the canvas, so a "full" hero would swallow the whole window
   * and leave the block toolbar nowhere to sit. Ignored for other frames.
   */
  canvasViewportHeight?: number | undefined
}) {
  const background = resolveBackground(block, doc.proposal?.heroOverride)
  const hasMedia = background.kind !== 'none'
  // A per-proposal override can add media the block itself lacks, so the
  // colour follows the resolved background, not the block's own.
  const { heading: headingDefaults, subheading: subheadingDefaults } = heroTextDefaults(
    branding,
    { ...block, background },
    frame,
  )
  const vh = heroHeightVh(block)
  const simulated = frame === 'page' && canvasViewportHeight !== undefined
  // The page frame is a share of the real viewport (svh, so a phone's
  // collapsing browser chrome never leaves a gap under a full hero); the
  // editor canvas simulates that viewport in pixels; document/print scale
  // the fixed card opening.
  const minHeight = simulated
    ? Math.round((canvasViewportHeight * vh) / 100)
    : frame === 'page'
      ? `${vh}svh`
      : Math.round((FULL_HEIGHT_DOCUMENT_PX * vh) / 100)
  const showHeading = block.showHeading !== false
  const showSubheading = block.showSubheading !== false
  const headingCss = resolveTextStyle(block.headingStyle, headingDefaults)
  if (frame === 'page' && block.headingStyle?.fontSize === undefined) headingCss.fontSize = FLUID_HEADING_SIZE
  // Only the subheading below a heading carries the gap between them.
  const subheadingCls = showHeading ? 'm-0 mt-3' : 'm-0'
  // `none` has no media behind it, so it reads as a plain section in the
  // brand surface colour rather than the brand accent colour a media layer
  // would otherwise show through while loading.
  const rootBg = background.kind === 'none' ? branding.surface_color : branding.brand_color

  return (
    <div
      // `group/hero` is inert on the sent page; the editor's grip and empty
      // state key their hover / text-focus behaviour off it.
      className={`group/hero relative flex w-full overflow-hidden ${VALIGN_CLASS[heroVerticalAlign(block)]} ${HALIGN_CLASS[block.textAlign]}`}
      style={{ background: rootBg, minHeight }}
    >
      {slots?.media ?? (
        hasMedia && (
          <div className="absolute inset-0">
            {background.kind === 'image' && (
              // eslint-disable-next-line @next/next/no-img-element -- above-the-fold hero art; deliberately not lazy
              <img src={background.url} alt="" fetchPriority="high" className="h-full w-full object-cover" />
            )}
            {background.kind === 'video' && (
              <VideoPlayer url={background.url} posterUrl={background.posterUrl} background frame={frame} />
            )}
            {background.kind === 'embed' && (
              <EmbedFrame url={background.url} background frame={frame} title="Hero video" className="pointer-events-none scale-[1.35]" />
            )}
          </div>
        )
      )}
      {hasMedia && (
        <div data-hero-overlay className="absolute inset-0" style={{ background: `rgba(0,0,0,${block.overlay / 100})` }} />
      )}
      <div className="relative max-w-doc-page w-full px-4 @sm/doc:px-8 py-16">
        {showHeading && (
          slots?.heading ? (
            <h1 className="m-0" style={headingCss}>
              {slots.heading}
            </h1>
          ) : (
            // Inline render: a <p> inside an <h1> is invalid HTML, and the heading
            // holds line breaks (Enter in the editor), not paragraphs.
            <h1
              className="m-0"
              style={headingCss}
              dangerouslySetInnerHTML={{ __html: renderRichTextInline(block.heading, variableValues ?? {}) }}
            />
          )
        )}
        {showSubheading && (
          slots?.subheading ? (
            // A div, not a p: the editor's slot is a block-level rich-text
            // editor, and a p cannot contain one without a DOM-nesting warning.
            <div data-hero-subheading className={subheadingCls} style={resolveTextStyle(block.subheadingStyle, subheadingDefaults)}>
              {slots.subheading}
            </div>
          ) : (
            // Also a div: renderRichText emits block-level <p>, and a <p> wrapper
            // would nest <p> in <p>, which the browser's parser splits apart and
            // hydration then fails on (see footer.tsx for the same rule).
            <div
              data-hero-subheading
              className={`${subheadingCls} [&_p]:m-0`}
              style={resolveTextStyle(block.subheadingStyle, subheadingDefaults)}
              dangerouslySetInnerHTML={{ __html: renderRichText(block.subheading, variableValues ?? {}) }}
            />
          )
        )}
      </div>
      {chrome}
    </div>
  )
}
