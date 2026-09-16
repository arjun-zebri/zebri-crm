'use client'

import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

// eslint-disable-next-line no-restricted-imports
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
// eslint-disable-next-line no-restricted-imports
import type { FaqBlock, FaqItem } from '@/app/(dashboard)/branding/blocks/types'

import type { PublicBranding } from '../../public-surface'
import { richTextHasContent } from '../../render-rich-text'
import { roleDefaults } from '../../type-defaults'
import { Rich } from '../rich'
import { pad } from '../shared'

/** Editor slots: a heading replacement and a per-item renderer (question + answer editing). */
export interface FaqSlots {
  heading?: ReactNode
  item?: (item: FaqItem, index: number) => ReactNode
}

/**
 * A list of common couple questions, each collapsed to its question until
 * clicked. Renders nothing on an untouched block (no items, no editor slot)
 * so a sent proposal never shows an empty FAQ section.
 */
export function RenderFaq({
  block,
  branding,
  slots,
  variableValues,
}: {
  block: FaqBlock
  branding: PublicBranding
  slots?: FaqSlots
  variableValues?: Record<string, string>
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (block.items.length === 0 && !slots?.item) return null

  const p = pad(branding)
  const headingStyle = resolveTextStyle(block.headingStyle, roleDefaults(branding, 'sectionHeading'))
  const bodyStyle = resolveTextStyle(undefined, roleDefaults(branding, 'body'))

  return (
    <div className={p.blockY}>
      {(richTextHasContent(block.heading) || slots?.heading) && (
        <h2 className="m-0 mb-4" style={headingStyle}>
          {slots?.heading ?? <Rich value={block.heading} values={variableValues} inline />}
        </h2>
      )}
      <div>
        {block.items.map((item, i) => {
          const open = openId === item.id
          const panelId = `faq-panel-${item.id}`
          return (
            <div key={item.id} style={{ borderBottom: i < block.items.length - 1 ? `1px solid ${branding.border_color}` : undefined }}>
              {slots?.item?.(item, i) ?? (
                <>
                  <h3 className="m-0">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenId(open ? null : item.id)}
                      className="flex w-full items-center justify-between gap-4 py-4 text-left"
                      style={bodyStyle}
                    >
                      <span><Rich value={item.question} values={variableValues} inline /></span>
                      <ChevronDown
                        size={18}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </h3>
                  <div id={panelId} hidden={!open} className="pb-4" style={bodyStyle}>
                    <Rich value={item.answer} values={variableValues} className="[&_p]:m-0 [&_p]:mb-2 [&_p:last-child]:mb-0" />
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
