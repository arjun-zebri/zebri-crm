'use client'

import { useMemo } from 'react'

// Blocks and their types are co-located with the editor; this is the same
// documented layering direction the shared lib helpers use.
import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import type { BodyFont, HeadingFont } from '@/lib/branding/fonts'
import { buildPublicBranding } from '@/lib/branding/public-branding'
import type { PublicDocData } from '@/lib/branding/public-renderer'
import { PublicBlockRenderer } from '@/lib/branding/public-renderer'
import type { Density } from '@/lib/branding/themes'
import type { SurfaceTab } from '@/types/branding-preview'

/**
 * Props for the live wizard preview pane.
 * @internal
 */
interface WizardPreviewProps {
  businessName: string
  tagline: string
  logoUrl: string
  brandColor: string
  fontHeading: HeadingFont
  fontBody: BodyFont
  density: Density
  enabledSurfaces: SurfaceTab[]
  /** Current wizard step; step 3 highlights the document list. */
  step: 1 | 2 | 3
}

/** The unscaled document width. 560px keeps the @container/doc queries in
 *  their desktop range so the mini document lays out like a real one. */
const DOC_WIDTH = 560

/** The preview pane's fixed content width (pane w-[340px] minus p-5 both
 *  sides). The scale is a constant derived from it: container-query units
 *  proved flaky inside the transformed subtree, and the pane width is ours. */
const PANE_CONTENT_WIDTH = 300
const DOC_SCALE = PANE_CONTENT_WIDTH / DOC_WIDTH

/** Sample wedding line items so the preview reads as a real document. */
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

/** Static block tree for the preview document, in three contiguous groups so
 *  the parts a step does not touch can dim (fixed ids keep React stable). */
const IDENTITY_BLOCKS: Block[] = [
  { id: 'pv-bn', type: 'businessName' },
  { id: 'pv-tg', type: 'tagline' },
]
const BODY_BLOCKS: Block[] = [
  { id: 'pv-tx', type: 'text', text: 'We would love to be part of your day. Everything you need to lock in your date is below.' },
  { id: 'pv-li', type: 'lineItems', colSpread: true },
  { id: 'pv-to', type: 'totals', taxRate: 10, showSubtotal: true },
  { id: 'pv-ac', type: 'action', primary: 'Accept proposal', secondary: null },
]
const FOOTER_BLOCKS: Block[] = [
  { id: 'pv-ft', type: 'footer', closingNote: 'Thank you for thinking of us.' },
]

/**
 * Per-step emphasis: what the current step edits stays at full opacity, the
 * rest of the document greys back. Step 1 edits identity (name, tagline,
 * logo, footer contact); step 2 restyles everything; step 3 is about the
 * document list below, so the whole page recedes.
 */
const GROUP_OPACITY: Record<1 | 2 | 3, { identity: string; body: string }> = {
  1: { identity: 'opacity-100', body: 'opacity-30' },
  2: { identity: 'opacity-100', body: 'opacity-100' },
  3: { identity: 'opacity-40', body: 'opacity-40' },
}

const SURFACE_LABELS: ReadonlyArray<[SurfaceTab, string]> = [
  ['proposal', 'Proposals'],
  ['invoice', 'Invoices'],
  ['contract', 'Contracts'],
  ['portal', 'Client portal'],
  ['vendorTimeline', 'Run sheet'],
  ['questionnaire', 'Questionnaires'],
]

/**
 * WizardPreview: a real document, not a mock. Renders the shared
 * PublicBlockRenderer (the exact code live proposals use) with a sample
 * wedding proposal, branded by the wizard's current choices, scaled to fill
 * the pane. Below it, the six document types show their on/off state so the
 * step-3 toggles have visible consequences.
 * @internal
 */
export function WizardPreview(props: WizardPreviewProps) {
  // buildPublicBranding fills every PublicBranding field from partial
  // metadata, so the preview inherits the same defaults real pages get.
  const branding = useMemo(
    () =>
      buildPublicBranding({
        business_name: props.businessName.trim() || 'Your business',
        tagline: props.tagline,
        logo_url: props.logoUrl || undefined,
        brand_color: props.brandColor,
        font_heading: props.fontHeading,
        font_body: props.fontBody,
        density: props.density,
      }),
    [props.businessName, props.tagline, props.logoUrl, props.brandColor, props.fontHeading, props.fontBody, props.density],
  )

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      <p className="text-[11px] uppercase tracking-wide text-text-subtle shrink-0">Live preview</p>

      {/* Scaled real document. The wrapper reserves the scaled footprint and
          fades out at the bottom edge so a taller document reads as a page
          peeking out, not a cropped bug. */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="absolute inset-0">
          <ScaledDoc>
            <div
              className="@container/doc rounded-lg border border-border shadow-sm overflow-hidden"
              style={{ width: DOC_WIDTH, background: branding.surface_color }}
            >
              <div className={`transition-opacity duration-300 ${GROUP_OPACITY[props.step].identity}`}>
                <PublicBlockRenderer blocks={IDENTITY_BLOCKS} branding={branding} doc={SAMPLE_DOC} />
              </div>
              <div className={`transition-opacity duration-300 ${GROUP_OPACITY[props.step].body}`}>
                <PublicBlockRenderer blocks={BODY_BLOCKS} branding={branding} doc={SAMPLE_DOC} />
              </div>
              <div className={`transition-opacity duration-300 ${GROUP_OPACITY[props.step].identity}`}>
                <PublicBlockRenderer blocks={FOOTER_BLOCKS} branding={branding} doc={SAMPLE_DOC} />
              </div>
            </div>
          </ScaledDoc>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-muted to-transparent pointer-events-none" />
      </div>

      {/* Document types, so step 3's toggles have visible consequences. */}
      <div className={`shrink-0 transition-opacity duration-300 ${props.step === 3 ? 'opacity-100' : 'opacity-70'}`}>
        <p className="text-[11px] uppercase tracking-wide text-text-subtle mb-2">Your documents</p>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {SURFACE_LABELS.map(([key, label]) => {
            const on = props.enabledSurfaces.includes(key)
            return (
              <li key={key} className={`flex items-center gap-1.5 text-xs ${on ? 'text-text' : 'text-text-subtle line-through'}`}>
                <span
                  aria-hidden
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${on ? 'bg-brand-fg' : 'border border-border'}`}
                />
                {label}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/**
 * ScaledDoc: scales the fixed-width document down to the pane's content
 * width with a constant factor, so the whole page width is always visible.
 * @internal
 */
function ScaledDoc({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ transform: `scale(${DOC_SCALE})`, transformOrigin: 'top left' }}>
      {children}
    </div>
  )
}
