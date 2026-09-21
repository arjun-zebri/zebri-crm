'use client'

/**
 * The section's labelled Style popover (UX audit §3.5, a major): every
 * control the old flat section bar exposed - background, width, height,
 * padding, text colour, alignment, hide-on-phone, reset - as label-left /
 * control-right rows in one popover, instead of twelve icon-only controls
 * in a single unlabelled row. Opened from the Style button on
 * `SectionToolbar`.
 *
 * @module features/proposals/editor/bars/section-style-popover
 */
import * as Popover from '@radix-ui/react-popover'
import { SlidersHorizontal } from 'lucide-react'
import { useRef, useState, type ReactNode, type RefObject } from 'react'

import { NumberStepper, PillToggle } from '@/components/editor'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip } from '@/components/ui/tooltip'

import type { FaqData, GalleryData, PackagesData, Section, SectionStyle, TestimonialsData, VideoData } from '../../model/layout'
import { effectivePadding, effectivePaddingX, effectiveWidth, type ProposalTheme } from '../../model/theme'
import type { SectionCanvasProps } from '../section-canvas'

import { SectionBackgroundControl } from './section-background'
import { SectionCardBackgroundControl } from './section-card-background'
import { CarouselColorControl } from './section-carousel-color'
import { SectionPaddingControl, SectionPaddingXControl } from './section-padding'
import { SectionAlignPill, SectionHeightPill, SectionVAlignPill, SectionWidthPill } from './section-style-pills'
import { SectionTextColorControl } from './section-text-color'

/** Props for {@link SectionStylePopover}. */
export interface SectionStylePopoverProps {
  section: Section
  /** The layout's canvas theme: the Padding control's inherited value and alignment baseline. */
  theme: ProposalTheme
  dispatch: SectionCanvasProps['dispatch']
  /** The canvas scroll element; the popover (and every nested one it opens) collides against it, never the page chrome. */
  boundsRef: RefObject<HTMLElement | null>
  /** Brand swatches offered by every colour picker. Defaults to none. */
  swatches?: readonly string[]
  /** `branding.corner_radius`: what a video section's Corner rounding control shows until the section sets its own (`VideoData.cornerRadius`). Defaults to 0 in a bare harness. */
  brandCornerRadius?: number
  /** Starts the on-canvas drag for the background image (`../background-reposition.tsx`); this popover closes first. Omitted in a bare harness. */
  onReposition?: (() => void) | undefined
  /** The toolbar's own outer element (`section-toolbar.tsx`): measured on open so the popover's right edge lines up with the toolbar's, not just its own (leftmost) trigger button's. Omitted in a bare test harness, where the popover falls back to the trigger-relative offset. */
  toolbarRef?: RefObject<HTMLDivElement | null>
}

/** Corner rounding's stepper range. 64px is well past any rounding that still reads as a corner on a 16:9 box. */
const MAX_VIDEO_CORNER_RADIUS = 64

/** Matches the Content's own `w-[340px]` below. */
const POPOVER_WIDTH = 340

/** The trigger is the toolbar's own first button, inset from the toolbar's outer edge by its `px-1` padding plus its 1px border (`section-toolbar.tsx`) - this is `align="start"`'s own baseline offset before `toolbarRef` pulls the popover's right edge out to the toolbar's. */
const TRIGGER_INSET = 5

const PACKAGES_LAYOUTS: { value: NonNullable<PackagesData['layout']>; label: string }[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'stacked', label: 'Stacked' },
]
// "Swipe" / "Stacked" rather than the literal "carousel"/"stack" internal
// values (2026-09-18 feedback): on a phone-width screen every card in a
// row, "Swipe" shows one at a time with Previous/Next paging instead of
// every card stacked one after another.
const PACKAGES_MOBILE_LAYOUTS: { value: NonNullable<PackagesData['mobileLayout']>; label: string }[] = [
  { value: 'stack', label: 'Stacked' },
  { value: 'carousel', label: 'Swipe' },
]
// A gallery section's own layout (2026-09-18 feedback: "in the popover the
// gallery should be removed and the layout should go into style") - no more
// separate Gallery toolbar button, matching packages above.
const GALLERY_LAYOUTS: { value: GalleryData['layout']; label: string }[] = [
  { value: 'grid', label: 'Grid' },
  { value: 'masonry', label: 'Masonry' },
  { value: 'carousel', label: 'Carousel' },
]
// Testimonials' own desktop arrangement (2026-09-19: brought to the same
// Style-popover treatment as packages/gallery - previously unreachable in
// the editor UI at all).
const TESTIMONIALS_LAYOUTS: { value: TestimonialsData['layout']; label: string }[] = [
  { value: 'cards', label: 'Cards' },
  { value: 'carousel', label: 'Carousel' },
]
// Only meaningful when `layout` is 'cards' - a desktop carousel is already
// one-at-a-time on every breakpoint. Same "Swipe"/"Stacked" labelling as
// packages' mobile toggle.
const TESTIMONIALS_MOBILE_LAYOUTS: { value: NonNullable<TestimonialsData['mobileLayout']>; label: string }[] = [
  { value: 'stack', label: 'Stacked' },
  { value: 'carousel', label: 'Swipe' },
]

/** One label-left, control-right row. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-body text-text-muted">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  )
}

/** The Style trigger button and its labelled popover. */
export function SectionStylePopover({ section, theme, dispatch, boundsRef, swatches = [], brandCornerRadius = 0, onReposition, toolbarRef }: SectionStylePopoverProps) {
  const { style } = section
  const [open, setOpen] = useState(false)
  // Captured on open, not read during render: see `section-padding.tsx`'s
  // matching comment for why (`react-hooks/refs`).
  const [bounds, setBounds] = useState<HTMLElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Measured on open, from the toolbar's *real* width, rather than a
  // hardcoded button count: a `virtualRef` Popper anchor on the toolbar
  // itself collapsed to a 0x0 rect here (Radix/floating-ui quirk, not
  // reproduced in isolation) - this reads the same two rects `virtualRef`
  // would have, once, and turns them into a plain `alignOffset` instead.
  const [alignOffset, setAlignOffset] = useState(-TRIGGER_INSET)

  const update = (patch: Partial<SectionStyle>, opts?: { commit?: boolean }) =>
    dispatch({ type: 'updateStyle', id: section.id, patch }, opts)
  /** Every pill here is a discrete, already-committed change. */
  const commitPatch = (patch: Partial<SectionStyle>) => update(patch, { commit: true })

  // A packages section's own settings (layout, phone behaviour, inclusions
  // visibility) live here too (2026-09-18 feedback: "layout should go
  // into style, same with show inclusions") - no more separate Packages
  // toolbar button.
  const packagesData = section.data?.kind === 'packages' ? section.data.packages : null
  const updatePackages = (next: Partial<PackagesData>) => {
    if (!packagesData) return
    dispatch({ type: 'setData', id: section.id, data: { kind: 'packages', packages: { ...packagesData, ...next } } }, { commit: true })
  }

  const galleryData = section.data?.kind === 'gallery' ? section.data.gallery : null
  const updateGallery = (next: Partial<GalleryData>) => {
    if (!galleryData) return
    dispatch({ type: 'setData', id: section.id, data: { kind: 'gallery', gallery: { ...galleryData, ...next } } }, { commit: true })
  }

  const testimonialsData = section.data?.kind === 'testimonials' ? section.data.testimonials : null
  const updateTestimonials = (next: Partial<TestimonialsData>) => {
    if (!testimonialsData) return
    dispatch({ type: 'setData', id: section.id, data: { kind: 'testimonials', testimonials: { ...testimonialsData, ...next } } }, { commit: true })
  }

  // A video section's media-box rounding (2026-09-19 feedback: "in the
  // style for this section you should be able to set corner rounding for
  // the video"). Shows the brand radius until the section sets its own.
  const videoData = section.data?.kind === 'video' ? section.data.video : null
  const updateVideo = (next: Partial<VideoData>) => {
    if (!videoData) return
    dispatch({ type: 'setData', id: section.id, data: { kind: 'video', video: { ...videoData, ...next } } }, { commit: true })
  }

  // A FAQ section's own collapse behaviour (2026-09-19 feedback: "a way to
  // toggle that on and off"). Unset reads as on - see `FaqBlock.collapsible`'s
  // own doc for why this field is optional rather than defaulted here.
  const faqData = section.data?.kind === 'faq' ? section.data.faq : null
  const updateFaq = (next: Partial<FaqData>) => {
    if (!faqData) return
    dispatch({ type: 'setData', id: section.id, data: { kind: 'faq', faq: { ...faqData, ...next } } }, { commit: true })
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) return
        setBounds(boundsRef.current)
        // Recompute the offset from the toolbar's real, current width
        // rather than trusting a hardcoded button count - this only needs
        // to run once, when the popover opens, same as `bounds` above.
        const toolbar = toolbarRef?.current
        const trigger = triggerRef.current
        setAlignOffset(toolbar && trigger ? toolbar.getBoundingClientRect().right - trigger.getBoundingClientRect().left - POPOVER_WIDTH : -TRIGGER_INSET)
      }}
    >
      <Tooltip side="top" label="Style">
        <Popover.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            aria-label="Style"
            className="inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:bg-surface-emphasis hover:text-text"
          >
            <SlidersHorizontal size={14} strokeWidth={1.5} />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="start"
          // The Style trigger is the toolbar's own first button, inset
          // from the toolbar's outer edge - `align="start"` alone lands
          // the popover at the trigger's own left edge, which lined up
          // with the toolbar's right edge (where it visually sits, flush
          // against the section's own right edge) only by coincidence:
          // badly misaligned on a narrow section, since the popover is
          // wider than the toolbar (2026-09-19 live-found bug).
          // `alignOffset` is recomputed on open, above, from the real
          // toolbar width, so the two right edges stay flush regardless.
          alignOffset={alignOffset}
          sideOffset={6}
          collisionPadding={16}
          collisionBoundary={bounds}
          // 300px wasn't enough for the Width row's four pills (Narrow /
          // Medium / Wide / Custom) - even with the "Custom" pill's label
          // fixed to never show a px value, the plain four-way segmented
          // control alone slightly overflowed the popover's right edge
          // (live-found bug).
          className="z-[60] w-[340px] animate-modal-in rounded-control border border-border bg-surface p-4 shadow-xl"
        >
          <Row label={packagesData ? 'Section background' : 'Background'}>
            <SectionBackgroundControl
              background={style.background}
              onChange={(background, opts) => update({ background }, opts)}
              swatches={swatches}
              boundsRef={boundsRef}
              onReposition={onReposition ? () => { setOpen(false); onReposition() } : undefined}
            />
          </Row>
          {packagesData && (
            <Row label="Card background">
              <SectionCardBackgroundControl
                color={packagesData.cardBackgroundColor}
                onChange={(cardBackgroundColor) => updatePackages({ cardBackgroundColor })}
                swatches={swatches}
              />
            </Row>
          )}
          {testimonialsData && (
            <Row label="Card background">
              <SectionCardBackgroundControl
                color={testimonialsData.cardBackgroundColor}
                onChange={(cardBackgroundColor) => updateTestimonials({ cardBackgroundColor })}
                swatches={swatches}
              />
            </Row>
          )}
          <Row label="Width">
            <SectionWidthPill style={{ ...style, contentWidth: effectiveWidth(style.contentWidth, theme) }} onChange={commitPatch} />
          </Row>
          {/* In step flow "Full" means "fill this page" (`render/section.tsx`), so the control applies in both flows. */}
          <Row label="Height">
            <SectionHeightPill style={style} onChange={commitPatch} />
          </Row>
          {/* Two paddings, named by axis, the same split as the Global
              style Page tab: each shows the inherited theme value until the
              section sets its own. */}
          <Row label="Vertical padding">
            <SectionPaddingControl
              padding={effectivePadding(style.padding, theme)}
              onChange={(padding, opts) => update({ padding }, opts)}
              boundsRef={boundsRef}
            />
          </Row>
          <Row label="Horizontal padding">
            <SectionPaddingXControl
              paddingX={effectivePaddingX(style.paddingX, theme)}
              onChange={(paddingX, opts) => update({ paddingX }, opts)}
              boundsRef={boundsRef}
            />
          </Row>
          <Row label="Text colour">
            <SectionTextColorControl
              color={style.textColor}
              onChange={(color) => update({ textColor: color }, { commit: true })}
              swatches={swatches}
            />
          </Row>
          <Row label="Alignment">
            <SectionAlignPill style={style} onChange={commitPatch} />
          </Row>
          <Row label="Vertical align">
            <SectionVAlignPill style={style} onChange={commitPatch} />
          </Row>

          {packagesData && (
            <>
              <div className="my-2 border-t border-border" />
              <Row label="Layout">
                <PillToggle value={packagesData.layout} onChange={(layout) => updatePackages({ layout })} options={PACKAGES_LAYOUTS} />
              </Row>
              <Row label="On phone">
                <PillToggle
                  value={packagesData.mobileLayout ?? 'stack'}
                  onChange={(mobileLayout) => updatePackages({ mobileLayout })}
                  options={PACKAGES_MOBILE_LAYOUTS}
                />
              </Row>
              <Row label="Show inclusions">
                <Checkbox
                  ariaLabel="Show inclusions"
                  checked={packagesData.showInclusions}
                  onChange={(showInclusions) => updatePackages({ showInclusions })}
                />
              </Row>
              {packagesData.mobileLayout === 'carousel' && (
                <>
                  <Row label="Carousel background">
                    <CarouselColorControl
                      label="Carousel background"
                      clearLabel="Use brand colour"
                      fallback="#FFFFFF"
                      color={packagesData.carouselBackgroundColor}
                      onChange={(carouselBackgroundColor) => updatePackages({ carouselBackgroundColor })}
                      swatches={swatches}
                    />
                  </Row>
                  <Row label="Carousel icon colour">
                    <CarouselColorControl
                      label="Carousel icon colour"
                      clearLabel="Use automatic colour"
                      fallback="#000000"
                      color={packagesData.carouselIconColor}
                      onChange={(carouselIconColor) => updatePackages({ carouselIconColor })}
                      swatches={swatches}
                    />
                  </Row>
                </>
              )}
            </>
          )}

          {galleryData && (
            <>
              <div className="my-2 border-t border-border" />
              <Row label="Layout">
                <PillToggle value={galleryData.layout} onChange={(layout) => updateGallery({ layout })} options={GALLERY_LAYOUTS} />
              </Row>
              {galleryData.layout === 'carousel' && (
                <>
                  <Row label="Carousel background">
                    <CarouselColorControl
                      label="Carousel background"
                      clearLabel="Use brand colour"
                      fallback="#FFFFFF"
                      color={galleryData.carouselBackgroundColor}
                      onChange={(carouselBackgroundColor) => updateGallery({ carouselBackgroundColor })}
                      swatches={swatches}
                    />
                  </Row>
                  <Row label="Carousel icon colour">
                    <CarouselColorControl
                      label="Carousel icon colour"
                      clearLabel="Use automatic colour"
                      fallback="#000000"
                      color={galleryData.carouselIconColor}
                      onChange={(carouselIconColor) => updateGallery({ carouselIconColor })}
                      swatches={swatches}
                    />
                  </Row>
                </>
              )}
            </>
          )}

          {testimonialsData && (
            <>
              <div className="my-2 border-t border-border" />
              <Row label="Layout">
                <PillToggle value={testimonialsData.layout} onChange={(layout) => updateTestimonials({ layout })} options={TESTIMONIALS_LAYOUTS} />
              </Row>
              {testimonialsData.layout === 'cards' && (
                <Row label="On phone">
                  <PillToggle
                    value={testimonialsData.mobileLayout ?? 'stack'}
                    onChange={(mobileLayout) => updateTestimonials({ mobileLayout })}
                    options={TESTIMONIALS_MOBILE_LAYOUTS}
                  />
                </Row>
              )}
              {(testimonialsData.layout === 'carousel' || testimonialsData.mobileLayout === 'carousel') && (
                <>
                  <Row label="Carousel background">
                    <CarouselColorControl
                      label="Carousel background"
                      clearLabel="Use brand colour"
                      fallback="#FFFFFF"
                      color={testimonialsData.carouselBackgroundColor}
                      onChange={(carouselBackgroundColor) => updateTestimonials({ carouselBackgroundColor })}
                      swatches={swatches}
                    />
                  </Row>
                  <Row label="Carousel icon colour">
                    <CarouselColorControl
                      label="Carousel icon colour"
                      clearLabel="Use automatic colour"
                      fallback="#000000"
                      color={testimonialsData.carouselIconColor}
                      onChange={(carouselIconColor) => updateTestimonials({ carouselIconColor })}
                      swatches={swatches}
                    />
                  </Row>
                </>
              )}
            </>
          )}

          {videoData && (
            <>
              <div className="my-2 border-t border-border" />
              <Row label="Corner rounding">
                <NumberStepper
                  value={videoData.cornerRadius ?? brandCornerRadius}
                  min={0}
                  max={MAX_VIDEO_CORNER_RADIUS}
                  step={2}
                  suffix="px"
                  ariaLabel="Corner rounding"
                  onChange={(cornerRadius) => updateVideo({ cornerRadius })}
                />
              </Row>
            </>
          )}

          {faqData && (
            <>
              <div className="my-2 border-t border-border" />
              <Row label="Collapsible answers">
                <Checkbox
                  ariaLabel="Collapsible answers"
                  checked={faqData.collapsible ?? true}
                  onChange={(collapsible) => updateFaq({ collapsible })}
                />
              </Row>
            </>
          )}

          <Row label="Hide on phone">
            <Checkbox
              ariaLabel="Hide on phone"
              checked={Boolean(section.hideOnMobile)}
              onChange={() => dispatch({ type: 'toggleHideOnMobile', id: section.id }, { commit: true })}
            />
          </Row>

          <div className="my-2 border-t border-border" />

          <Button
            variant="ghost"
            className="w-full justify-center"
            onClick={() => dispatch({ type: 'resetStyle', id: section.id }, { commit: true })}
          >
            Reset style
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
