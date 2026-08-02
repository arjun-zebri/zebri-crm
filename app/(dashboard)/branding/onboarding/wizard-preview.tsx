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

/**
 * Props for the live wizard preview pane.
 * @internal
 */
interface WizardPreviewProps {
  businessName: string
  tagline: string
  logoUrl: string
  /** Heading colour for page titles and key headlines. */
  headingColor: string
  /** Subheading colour for secondary headings and hierarchy levels. */
  subheadingColor: string
  /** Body text colour. */
  bodyColor: string
  /** Page background colour. */
  backgroundColor: string
  /** Primary button colour; persisted as brand_color. */
  primaryButtonColor: string
  /** Secondary button colour; persisted as secondary_color. */
  secondaryButtonColor: string
  fontHeading: HeadingFont
  fontBody: BodyFont
  density: Density
  /** Current wizard step. The pane is only rendered on steps 1-2 (and the
   *  intro); 3-4 are in the type so the wizard can pass its step through. */
  step: 1 | 2 | 3 | 4
  /** True on the welcome screen: the full document shows undimmed. */
  intro?: boolean
}

/** Unscaled document widths per step. Step 1 renders a narrower page, which
 *  reads as a zoom on the identity header at the same pane width; the other
 *  steps show the whole document. Both stay >= the 384px @sm/doc container
 *  breakpoint so the layout is the desktop one. */
const DOC_WIDTH_FOCUS = 400
const DOC_WIDTH_FULL = 560

/** The preview pane's fixed content width (pane w-[380px] minus p-5 both
 *  sides). The scale is a constant derived from it: container-query units
 *  proved flaky inside the transformed subtree, and the pane width is ours. */
const PANE_CONTENT_WIDTH = 340

/** Sample wedding line items so the preview reads as a real document. */
const SAMPLE_DOC: PublicDocData = {
  title: 'Wedding invoice',
  refNumber: 'INV-0412',
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
 *  the parts a step does not touch can dim (fixed ids keep React stable).
 *  Includes a title with subtitle block to demonstrate both heading and subheading colours. */
const IDENTITY_BLOCKS: Block[] = [
  { id: 'pv-bn', type: 'businessName' },
  { id: 'pv-tg', type: 'tagline' },
  { id: 'pv-title', type: 'title', title: 'Your complete celebration', subtitle: 'From coordination to memories', showRef: false, showExpires: false, showAbn: false },
]
const BODY_BLOCKS: Block[] = [
  { id: 'pv-tx', type: 'text', text: 'We would love to be part of your day. Everything you need to lock in your date is below.' },
  { id: 'pv-li', type: 'lineItems', colSpread: true },
  { id: 'pv-to', type: 'totals', taxRate: 10, showSubtotal: true },
  { id: 'pv-ac', type: 'action', primary: 'Pay now', secondary: null },
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
const GROUP_OPACITY: Record<1 | 2 | 3 | 4, { identity: string; body: string }> = {
  // Step 1 reaches this branch only on the intro screen (full document).
  1: { identity: 'opacity-100', body: 'opacity-100' },
  2: { identity: 'opacity-100', body: 'opacity-100' },
  3: { identity: 'opacity-100', body: 'opacity-100' },
  // Step 4 never renders the pane; the entry keeps the record total.
  4: { identity: 'opacity-100', body: 'opacity-100' },
}


/**
 * WizardPreview: a real document, not a mock. Renders the shared
 * PublicBlockRenderer (the exact code live invoices use) with a sample
 * wedding invoice, branded by the wizard's current choices, scaled to fill
 * the pane. Below it, the document types show their on/off state so the
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
        heading_color: props.headingColor,
        subheading_color: props.subheadingColor,
        text_color: props.bodyColor,
        surface_color: props.backgroundColor,
        brand_color: props.primaryButtonColor,
        secondary_color: props.secondaryButtonColor,
        font_heading: props.fontHeading,
        font_body: props.fontBody,
        density: props.density,
      }),
    [props.businessName, props.tagline, props.logoUrl, props.headingColor, props.subheadingColor, props.bodyColor, props.backgroundColor, props.primaryButtonColor, props.secondaryButtonColor, props.fontHeading, props.fontBody, props.density],
  )

  const docWidth = props.step === 1 && !props.intro ? DOC_WIDTH_FOCUS : DOC_WIDTH_FULL

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Scaled real document. The wrapper reserves the scaled footprint and
          fades out at the bottom edge so a taller document reads as a page
          peeking out, not a cropped bug. */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="absolute inset-0 flex items-center">
          {/* Keyed by width: a zoom change remounts and fades in at its final
              size, instead of tweening width and scale against each other. */}
          <ScaledDoc key={docWidth} docWidth={docWidth}>
            <div
              className="@container/doc border border-border shadow-sm overflow-hidden animate-fade-in motion-reduce:animate-none [&_*]:transition-[padding,margin,gap,border-radius] [&_*]:duration-300 motion-reduce:[&_*]:transition-none"
              style={{ width: docWidth, background: branding.surface_color, borderRadius: 8 }}
            >
              {props.step === 1 && !props.intro ? (
                // Business step: the identity header renders for real and
                // zoomed; everything not configured yet stays a skeleton.
                <>
                  <PublicBlockRenderer blocks={IDENTITY_BLOCKS} branding={branding} doc={SAMPLE_DOC} />
                  <DocSkeleton />
                </>
              ) : (
                <>
                  <div className={`transition-opacity duration-300 ${GROUP_OPACITY[props.step].identity}`}>
                    <PublicBlockRenderer blocks={IDENTITY_BLOCKS} branding={branding} doc={SAMPLE_DOC} />
                  </div>
                  <div className={`transition-opacity duration-300 ${GROUP_OPACITY[props.step].body}`}>
                    <PublicBlockRenderer blocks={BODY_BLOCKS} branding={branding} doc={SAMPLE_DOC} />
                  </div>
                  <div className={`transition-opacity duration-300 ${GROUP_OPACITY[props.step].identity}`}>
                    <PublicBlockRenderer blocks={FOOTER_BLOCKS} branding={branding} doc={SAMPLE_DOC} />
                  </div>
                </>
              )}
            </div>
          </ScaledDoc>
        </div>
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-surface-muted to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-muted to-transparent pointer-events-none" />
      </div>

    </div>
  )
}


/**
 * ScaledDoc: scales the fixed-width document down to the pane's content
 * width, so the whole page width is always visible. A narrower docWidth
 * therefore reads as zooming in.
 * @internal
 */
function ScaledDoc({ docWidth, children }: { docWidth: number; children: React.ReactNode }) {
  return (
    <div
      style={{ transform: `scale(${PANE_CONTENT_WIDTH / docWidth})`, transformOrigin: 'left center' }}
    >
      {children}
    </div>
  )
}

/**
 * DocSkeleton: loading-skeleton placeholder for the parts of the document
 * the user has not configured yet. Grey bars in a document rhythm: intro
 * lines, priced rows, a totals row, an action button, a footer line.
 * @internal
 */
function DocSkeleton() {
  return (
    <div className="px-6 pb-6 pt-1 flex flex-col gap-5" aria-hidden>
      <div className="flex flex-col gap-2">
        <div className="h-2 rounded-full bg-gray-200 w-full" />
        <div className="h-2 rounded-full bg-gray-200 w-4/5" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className={`h-2 rounded-full bg-gray-200 ${i === 1 ? 'w-1/3' : 'w-2/5'}`} />
            <div className="h-2 rounded-full bg-gray-200 w-12" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="h-2.5 rounded-full bg-gray-300 w-16" />
        <div className="h-2.5 rounded-full bg-gray-300 w-20" />
      </div>
      <div className="h-9 rounded-lg bg-gray-200 w-full" />
      <div className="h-2 rounded-full bg-gray-100 w-1/2 mx-auto" />
    </div>
  )
}
