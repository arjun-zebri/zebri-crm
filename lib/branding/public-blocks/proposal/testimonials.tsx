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
import { pad } from '../shared'

import { CarouselControls } from './carousel-controls'

/** Editor slots: a heading replacement and a per-item renderer (quote editing). */
export interface TestimonialsSlots {
  heading?: ReactNode
  item?: (item: TestimonialItem, index: number) => ReactNode
}

/**
 * The card frame a testimonial's content sits inside: border, radius, and
 * padding. Exported so the editor can reuse the exact same frame around its
 * own inline-editable fields (`slots.item` replaces the whole card, so the
 * frame markup would otherwise have to be duplicated there).
 */
export function TestimonialCard({ children, branding }: { children: ReactNode; branding: PublicBranding }) {
  return (
    <div className="flex h-full flex-col gap-3 p-5" style={{ border: `1px solid ${branding.border_color}`, borderRadius: branding.corner_radius }}>
      {children}
    </div>
  )
}

function Card({ item, branding, values }: { item: TestimonialItem; branding: PublicBranding; values?: Record<string, string> | undefined }) {
  const bodyStyle = resolveTextStyle(undefined, roleDefaults(branding, 'body'))
  return (
    <TestimonialCard branding={branding}>
      <Quote size={20} strokeWidth={1.5} style={{ color: branding.brand_color }} />
      <Rich value={item.quote} values={values} className="m-0 flex-1 [&_p]:m-0" style={bodyStyle} />
      <div className="flex items-center gap-3">
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded portrait, no next/image
          <img src={item.imageUrl} alt="" loading="lazy" className="h-10 w-10 rounded-pill object-cover" />
        )}
        <div>
          <p className="m-0" style={{ ...resolveTextStyle(undefined, roleDefaults(branding, 'sectionHeading')), fontSize: 16 }}><Rich value={item.names} values={values} inline /></p>
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
  if (block.items.length === 0 && !slots?.item) return null

  const p = pad(branding)
  const headingStyle = resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))
  const safeIndex = Math.min(index, Math.max(0, block.items.length - 1))
  const current = block.items[safeIndex]

  return (
    <div className={p.blockY}>
      {(richTextHasContent(block.heading) || slots?.heading) && (
        <h2 className="m-0 mb-4" style={headingStyle}>{slots?.heading ?? <Rich value={block.heading} values={variableValues} inline />}</h2>
      )}
      {block.layout === 'carousel' ? (
        <>
          {current && (slots?.item?.(current, safeIndex) ?? <Card item={current} branding={branding} values={variableValues} />)}
          <CarouselControls
            branding={branding}
            index={safeIndex}
            count={block.items.length}
            noun="testimonial"
            onPrev={() => setIndex((i) => (i - 1 + block.items.length) % block.items.length)}
            onNext={() => setIndex((i) => (i + 1) % block.items.length)}
            onSelect={setIndex}
          />
        </>
      ) : (
        <div className="grid gap-4 @md/doc:grid-cols-2">
          {block.items.map((item, i) => (
            <div key={item.id}>{slots?.item?.(item, i) ?? <Card item={item} branding={branding} />}</div>
          ))}
        </div>
      )}
    </div>
  )
}
