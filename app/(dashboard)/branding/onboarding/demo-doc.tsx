'use client'

import { useLayoutEffect, useRef } from 'react'

import type { HeadingFont } from '@/lib/branding/fonts'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import type { PublicDocData } from '@/lib/branding/public-renderer'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'

// Blocks are co-located with the editor; same layering direction as
// wizard-preview.
import type { Block } from '../blocks/types'

/** The green the demo picks for headings (global). @internal */
export const DEMO_GREEN = '#2F5D43'
/** The bronze the demo picks for the one button block (individual). Dark
 *  enough (luminance < 0.4) that getTextColor flips the label to white,
 *  exactly as the real action block does. @internal */
export const DEMO_GOLD = '#8C4F27'

/** Unscaled document width; >= the 384px @sm/doc breakpoint so the layout
 *  is the desktop one, exactly like wizard-preview. @internal */
const DOC_WIDTH = 560
const SCALE = 0.55

/** Same sample wedding line items the wizard preview uses. */
const SAMPLE_DOC: PublicDocData = {
  title: 'Wedding proposal',
  refNumber: 'PROP-0412',
  expiresAt: null,
  items: [
    { id: 'p1', description: 'MC and hosting, reception', amount: 1200 },
    { id: 'p2', description: 'Ceremony coordination', amount: 400 },
    { id: 'p3', description: 'Rehearsal walkthrough', amount: 150 },
  ],
  subtotal: 1750,
  taxRate: 10,
}

/**
 * Props for the demo canvas document.
 * @internal
 */
interface DemoDocProps {
  /** Heading colour — global brand-kit state. */
  headingHex: string
  /** Heading font — global brand-kit state. */
  fontHeading: HeadingFont
  /** Heading size in px — global brand-kit state. */
  headingSize: number
  /** Per-block override for the action block's primary button. */
  buttonColor?: string
  /** The action block is selected (ring). */
  selected: boolean
  /** The block toolbar is up; closes on the pick, before the ring clears. */
  toolbarOpen: boolean
}

/**
 * DemoDoc — the real proposal document on the demo's canvas.
 *
 * Not a mock: this renders the shared PublicBlockRenderer (the exact code
 * live proposals use) through buildPublicBranding, scaled down, so every
 * change the pointer makes flows through the real branding pipeline. The
 * selection overlay is positioned by measuring the real Accept button
 * (`data-subtarget="primary"`) and carries the `doc-accept` cursor target.
 * @internal
 */
export function DemoDoc({ headingHex, fontHeading, headingSize, buttonColor, selected, toolbarOpen }: DemoDocProps) {
  const branding = buildPublicBranding({
    business_name: 'Forever & Always',
    tagline: 'Wedding MC & host',
    heading_color: headingHex,
    font_heading: fontHeading,
    heading_size: headingSize,
  })
  const blocks: Block[] = [
    { id: 'd-bn', type: 'businessName' },
    { id: 'd-tg', type: 'tagline' },
    { id: 'd-title', type: 'title', title: 'Wedding proposal', showRef: true, showExpires: false, showAbn: false },
    { id: 'd-li', type: 'lineItems', colSpread: true },
    { id: 'd-to', type: 'totals', taxRate: 10, showSubtotal: true },
    { id: 'd-act', type: 'action', primary: 'Accept proposal', secondary: 'Decline', ...(buttonColor ? { buttonColor } : {}) },
  ]

  const wrapRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Keep the selection overlay glued to the real button through every global
  // restyle (font and size changes move it). Rects are in screen px on both
  // sides, so the scale transform cancels out.
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const overlay = overlayRef.current
    if (!wrap || !overlay) return
    const btn = wrap.querySelector<HTMLElement>('[data-subtarget="primary"]')
    if (!btn) return
    const wr = wrap.getBoundingClientRect()
    const br = btn.getBoundingClientRect()
    overlay.style.left = `${br.left - wr.left}px`
    overlay.style.top = `${br.top - wr.top}px`
    overlay.style.width = `${br.width}px`
    overlay.style.height = `${br.height}px`
  }, [selected, headingHex, fontHeading, headingSize, buttonColor])

  return (
    <div ref={wrapRef} className="relative" style={{ width: DOC_WIDTH * SCALE }}>
      <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left', width: DOC_WIDTH }}>
        <div
          data-demo-doc
          className="@container/doc border border-border shadow-sm overflow-hidden [&_*]:transition-[color,background-color,font-size] [&_*]:duration-500 motion-reduce:[&_*]:transition-none"
          style={{ width: DOC_WIDTH, background: branding.surface_color, borderRadius: 8 }}
        >
          <PublicBlockRenderer blocks={blocks} branding={branding} doc={SAMPLE_DOC} />
        </div>
      </div>

      {/* Selection overlay: always mounted so the pointer can glide onto the
          button before the click lands; ring + toolbar show once selected. */}
      <div
        ref={overlayRef}
        data-cursor="doc-accept"
        className={`absolute pointer-events-none rounded-md ${selected ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`}
      >
        {toolbarOpen && (
          <div
            data-testid="demo-block-toolbar"
            className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 rounded-xl border border-gray-200 bg-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)] animate-modal-in"
          >
            {/* Mirrors the real block toolbar: type label, then controls. */}
            <p className="px-2 pt-1 text-[9px] font-medium text-gray-600 capitalize">action</p>
            <div className="flex items-center gap-1 px-2 pb-1.5 pt-0.5">
              {[branding.brand_color, DEMO_GREEN, DEMO_GOLD].map((c) => (
                <span
                  key={c}
                  data-cursor={c === DEMO_GOLD ? 'toolbar-gold' : undefined}
                  className={`size-3.5 rounded-full border border-black/10 ${
                    (buttonColor ?? branding.brand_color) === c ? 'ring-2 ring-gray-900 ring-offset-1' : ''
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
