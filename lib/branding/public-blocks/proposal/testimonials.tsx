'use client'

import { Quote } from 'lucide-react'
import { useState, type ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { TestimonialItem, TestimonialsBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../../public-surface'
import { richTextHasContent } from '../../render-rich-text'
import { roleDefaults } from '../../type-defaults'
import { Rich } from '../rich'
import { inheritAlign, pad } from '../shared'

import { CarouselControls } from './carousel-controls'

/** Editor slots: a heading replacement, a per-item renderer (quote editing), and a text-below replacement. */
export interface TestimonialsSlots {
  heading?: ReactNode
  item?: (item: TestimonialItem, index: number) => ReactNode
  textBelow?: ReactNode
}

/**
 * The card frame a testimonial's content sits inside: border, radius,
 * padding, and the optional background override. Exported so the editor can
 * reuse the exact same frame around its own inline-editable fields
 * (`slots.item` replaces the whole card, so the frame markup would otherwise
 * have to be duplicated there).
 */
export function TestimonialCard({ children, branding, cardBackgroundColor }: { children: ReactNode; branding: PublicBranding; cardBackgroundColor?: string | undefined }) {
  return (
    <div
      className="flex h-full flex-col gap-3 p-5"
      style={{ border: `1px solid ${branding.border_color}`, borderRadius: branding.corner_radius, background: cardBackgroundColor ?? branding.surface_color }}
    >
      {children}
    </div>
  )
}

function Card({ item, branding, values, cardBackgroundColor }: { item: TestimonialItem; branding: PublicBranding; values?: Record<string, string> | undefined; cardBackgroundColor?: string | undefined }) {
  // Item text follows the section's alignment (`inheritAlign`'s own doc).
  const bodyStyle = inheritAlign(resolveTextStyle(undefined, roleDefaults(branding, 'body')))
  return (
    <TestimonialCard branding={branding} cardBackgroundColor={cardBackgroundColor}>
      <Quote size={20} strokeWidth={1.5} style={{ color: branding.brand_color }} />
      <Rich value={item.quote} values={values} className="m-0 flex-1 [&_p]:m-0" style={bodyStyle} />
      <div className="flex items-center gap-3">
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded portrait, no next/image
          <img src={item.imageUrl} alt="" loading="lazy" className="h-10 w-10 rounded-pill object-cover" />
        )}
        <div>
          <p className="m-0" style={{ ...inheritAlign(resolveTextStyle(undefined, roleDefaults(branding, 'sectionHeading'))), fontSize: 16 }}><Rich value={item.names} values={values} inline /></p>
          {richTextHasContent(item.detail) && <p className="m-0" style={{ ...bodyStyle, color: branding.muted_color, fontSize: 13 }}><Rich value={item.detail} values={values} inline /></p>}
        </div>
      </div>
    </TestimonialCard>
  )
}

/**
 * A set of past-couple quotes, shown as a card grid or a one-at-a-time
 * carousel. Renders nothing on an untouched block (no items, no editor
 * slot) so a sent proposal never shows an empty testimonials section.
 */
export function RenderTestimonials({
  block,
  branding,
  slots,
  variableValues,
}: {
  block: TestimonialsBlock
  branding: PublicBranding
  slots?: TestimonialsSlots
  variableValues?: Record<string, string>
}) {
  const [index, setIndex] = useState(0)
  const [mobileIndex, setMobileIndex] = useState(0)
  // A quote left blank in the editor (an "Add testimonial" never filled
  // in) would render as an empty card on the sent proposal; the editor's
  // own slot still shows every item so it can be filled in or deleted.
  const items = slots?.item ? block.items : block.items.filter((item) => richTextHasContent(item.quote))
  if (items.length === 0 && !slots?.item) return null

  const p = pad(branding)
  const headingStyle = resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))
  const belowStyle = resolveTextStyle(block.textBelowStyle, { ...roleDefaults(branding, 'body'), color: branding.muted_color })
  const safeIndex = Math.min(index, Math.max(0, items.length - 1))
  const current = items[safeIndex]
  const safeMobileIndex = Math.min(mobileIndex, Math.max(0, items.length - 1))

  const renderCard = (item: TestimonialItem, i: number) => (
    <div key={item.id}>{slots?.item?.(item, i) ?? <Card item={item} branding={branding} values={variableValues} cardBackgroundColor={block.cardBackgroundColor} />}</div>
  )
  // `auto-rows-fr`: same fix as packages (2026-09-18). A grid row sizes to
  // only its own tallest card by default, so one long quote made just that
  // row taller. `minmax(0, 1fr)` rows equalise every card across the grid.
  // `auto-fit` fixed tracks + `justify-content` from the section's
  // alignment (`--doc-box-justify`), same reasoning as packages.tsx's
  // `gridCls`: a `grid-cols-2` of `1fr` tracks could never move a lone card.
  const grid = <div className="grid auto-rows-fr gap-4 @md/doc:grid-cols-[repeat(auto-fit,minmax(0,calc((100%-1rem)/2-0.02px)))] [justify-content:var(--doc-box-justify,start)]">{items.map((item, i) => renderCard(item, i))}</div>

  return (
    <div className={p.blockY}>
      {(richTextHasContent(block.heading) || slots?.heading) && (
        <h2 className="m-0 mb-4" style={headingStyle}>{slots?.heading ?? <Rich value={block.heading} values={variableValues} inline />}</h2>
      )}
      {block.layout === 'carousel' ? (
        <>
          {current && (slots?.item?.(current, safeIndex) ?? <Card item={current} branding={branding} values={variableValues} cardBackgroundColor={block.cardBackgroundColor} />)}
          <CarouselControls
            branding={branding}
            index={safeIndex}
            count={items.length}
            noun="testimonial"
            onPrev={() => setIndex((i) => (i - 1 + items.length) % items.length)}
            onNext={() => setIndex((i) => (i + 1) % items.length)}
            onSelect={setIndex}
            backgroundColor={block.carouselBackgroundColor}
            iconColor={block.carouselIconColor}
          />
        </>
      ) : block.mobileLayout === 'carousel' ? (
        <>
          <div className="hidden @md/doc:block">{grid}</div>
          <div className="@md/doc:hidden">
            <div className="grid">
              {items.map((item, i) => (
                <div key={item.id} className={`col-start-1 row-start-1 ${i === safeMobileIndex ? '' : 'invisible'}`} inert={i === safeMobileIndex ? undefined : true}>
                  {slots?.item?.(item, i) ?? <Card item={item} branding={branding} values={variableValues} cardBackgroundColor={block.cardBackgroundColor} />}
                </div>
              ))}
            </div>
            <CarouselControls
              branding={branding}
              index={safeMobileIndex}
              count={items.length}
              noun="testimonial"
              onPrev={() => setMobileIndex((i) => (i - 1 + items.length) % items.length)}
              onNext={() => setMobileIndex((i) => (i + 1) % items.length)}
              onSelect={setMobileIndex}
              backgroundColor={block.carouselBackgroundColor}
              iconColor={block.carouselIconColor}
            />
          </div>
        </>
      ) : grid}
      {(richTextHasContent(block.textBelow) || slots?.textBelow) && (
        slots?.textBelow
          ? <div className="m-0 mt-4" style={belowStyle}>{slots.textBelow}</div>
          : <p className="m-0 mt-4" style={belowStyle}><Rich value={block.textBelow} values={variableValues} inline /></p>
      )}
    </div>
  )
}
