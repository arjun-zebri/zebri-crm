'use client'

import type { ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { AboutMeBlock } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../../public-surface'
import { renderRichText, richTextHasContent } from '../../render-rich-text'
import { roleDefaults } from '../../type-defaults'
import { Rich } from '../rich'
import { pad } from '../shared'

/** Editor slots that replace the static heading / body / portrait with live inline editors. */
export interface AboutMeSlots {
  heading?: ReactNode
  body?: ReactNode
  portrait?: ReactNode
}

/**
 * A portrait and a short story introducing the MC or celebrant. Always
 * renders: even a portrait-less, textless block still holds its place in
 * the layout, since removing it entirely is the "hide block" toggle. The
 * rich-text body strips the first paragraph's top margin (`[&_p]:mt-0`) so
 * it aligns with the heading above it instead of doubling up on the
 * paragraph's own margin plus the heading's `mb-3`.
 */
export function RenderAboutMe({
  block,
  branding,
  variableValues,
  slots,
}: {
  block: AboutMeBlock
  branding: PublicBranding
  variableValues?: Record<string, string>
  slots?: AboutMeSlots
}) {
  const p = pad(branding)
  const headingStyle = resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))
  const bodyStyle = resolveTextStyle(block.bodyStyle, roleDefaults(branding, 'body'))
  const imageOnRight = block.imageSide === 'right'

  return (
    <div className={`grid gap-8 @md/doc:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center ${p.blockY}`}>
      <div className={imageOnRight ? '@md/doc:order-2' : ''}>
        {slots?.portrait ?? (block.portraitUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded portrait, no next/image
          <img
            src={block.portraitUrl}
            alt=""
            loading="lazy"
            className="aspect-[4/5] w-full object-cover"
            style={{ borderRadius: branding.corner_radius }}
          />
        ))}
      </div>
      <div>
        {(richTextHasContent(block.heading) || slots?.heading) && (
          <h2 className="m-0 mb-3" style={headingStyle}>{slots?.heading ?? <Rich value={block.heading} values={variableValues} inline />}</h2>
        )}
        {slots?.body ?? (
          <div
            className="[&_p]:mb-3 [&_p]:mt-0"
            style={bodyStyle}
            dangerouslySetInnerHTML={{ __html: renderRichText(block.body, variableValues ?? {}) }}
          />
        )}
      </div>
    </div>
  )
}
