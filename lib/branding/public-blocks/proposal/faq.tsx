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
import { inheritAlign, pad } from '../shared'

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
  // Item text follows the section's alignment (`inheritAlign`'s own doc).
  const bodyStyle = inheritAlign(resolveTextStyle(undefined, roleDefaults(branding, 'body')))
  // A question left blank in the editor (an "Add question" never filled in)
  // would render as an empty row on the sent proposal; the editor's own
  // slot still shows every item so it can be filled in or deleted.
  const visible = slots?.item ? block.items : block.items.filter((item) => richTextHasContent(item.question))
  // Unset reads as on: every FAQ block saved before this field existed
  // keeps today's always-collapsible behaviour (`FaqBlock.collapsible`'s
  // own doc).
  const collapsible = block.collapsible ?? true

  return (
    <div className={p.blockY}>
      {(richTextHasContent(block.heading) || slots?.heading) && (
        <h2 className="m-0 mb-4" style={headingStyle}>
          {slots?.heading ?? <Rich value={block.heading} values={variableValues} inline />}
        </h2>
      )}
      <div>
        {visible.map((item, i) => {
          const open = openId === item.id
          const panelId = `faq-panel-${item.id}`
          return (
            <div key={item.id} style={{ borderBottom: i < visible.length - 1 ? `1px solid ${branding.border_color}` : undefined }}>
              {slots?.item?.(item, i) ?? (collapsible ? (
                <>
                  <h3 className="m-0">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenId(open ? null : item.id)}
                      className="flex w-full items-center justify-between gap-4 py-4"
                      style={bodyStyle}
                    >
                      {/* `flex-1`: the question fills the row so the section's
                          alignment (inherited through `bodyStyle`) has room
                          to act; a content-sized span just sat at the row's
                          start whatever the alignment said. */}
                      <span className="flex-1"><Rich value={item.question} values={variableValues} inline /></span>
                      <ChevronDown
                        size={18}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className={`shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </h3>
                  {/* A grid-rows transition, not the old `hidden` attribute's
                      instant snap (live feedback): `0fr`/`1fr` animates the
                      row's own height without measuring the answer's pixel
                      height in JS. `inert` (not `hidden`) keeps the closed
                      panel out of tab order and the a11y tree while still
                      letting its height transition. */}
                  <div
                    id={panelId}
                    inert={!open}
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="pb-4" style={bodyStyle}>
                        <Rich value={item.answer} values={variableValues} className="[&_p]:m-0 [&_p]:mb-2 [&_p:last-child]:mb-0" />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="m-0 py-4" style={bodyStyle}>
                    <Rich value={item.question} values={variableValues} inline />
                  </h3>
                  <div className="pb-4" style={bodyStyle}>
                    <Rich value={item.answer} values={variableValues} className="[&_p]:m-0 [&_p]:mb-2 [&_p:last-child]:mb-0" />
                  </div>
                </>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
