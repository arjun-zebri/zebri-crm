/**
 * Customer preview page for the branding editor.
 *
 * Authed via the dashboard session (not token-gated). Renders the current user's
 * saved branding for the chosen surface (invoice/contract/portal) with
 * sample data using the same shared renderers the public pages use, so the preview
 * matches exactly what the couple receives. Reads the surface from route params via
 * useParams for SSR safety (window.location during render breaks hydration).
 *
 * @module app/branding/preview/[surface]/page.tsx
 */
'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

import { SAMPLE_RUN_SHEET_EVENT, SAMPLE_RUN_SHEET_ITEMS } from '@/app/(dashboard)/branding/blocks/sample-run-sheet'
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style'
import type { Block, ContractBodyBlock, ContractSignBlock, VendorTimelineBodyBlock } from '@/app/(dashboard)/branding/blocks/types'
import { VendorTimeline } from '@/app/portal/[token]/vendor/vendor-timeline'
import { getTextColor } from '@/lib/branding/contrast'
import { DOC_CANVAS_BG, DOC_MAX_WIDTH_PX } from '@/lib/branding/document-frame'
import { googleFontsHref } from '@/lib/branding/fonts'
import { PublicBlockRenderer, type PublicDocData } from '@/lib/branding/public-renderer'
import { useBrandingHead, type PublicBranding } from '@/lib/branding/public-surface'
import { SAMPLE_CONTRACT_CLAUSES } from '@/lib/branding/sample-contract-body'
import { roleDefaults } from '@/lib/branding/type-defaults'
import { useCurrentBranding } from '@/lib/branding/use-current-branding'

/**
 * Validates a surface string and returns true if it is a valid BuilderSurface.
 */
function isValidSurface(s: unknown): s is 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire' {
  return s === 'invoice' || s === 'contract' || s === 'portal' || s === 'vendorTimeline' || s === 'questionnaire'
}

/**
 * Sample invoice data for preview.
 */
function sampleInvoiceDoc(): PublicDocData {
  const depositDue = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? ''
  const finalDue = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? ''
  return {
    title: 'Invoice',
    refNumber: 'INV-2024-001',
    expiresLabel: 'Due',
    // Due dates live in the schedule below, so suppress the header row (matches
    // the live invoice page).
    expiresAt: null,
    items: [
      { id: 'i1', description: 'Full-day wedding MC & hosting', amount: 2000 },
      { id: 'i2', description: 'Pre-wedding planning meeting', amount: 150 },
      { id: 'i3', description: 'Ceremony rehearsal attendance', amount: 600 },
    ],
    subtotal: 2750,
    taxRate: 10,
    // Sample three-stage payment schedule so the paymentSchedule block previews realistically.
    paymentSchedule: {
      stages: [
        { label: 'Deposit', amountCents: 125_000, dueDate: depositDue, paidAt: null },
        { label: 'Progress payment', amountCents: 250_000, dueDate: finalDue, paidAt: null },
        { label: 'Final balance', amountCents: 125_000, dueDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '', paidAt: null },
      ],
    },
  }
}

/**
 * Sample contract data for preview.
 */
function sampleContractDoc(): PublicDocData {
  return {
    title: 'Wedding Services Agreement',
    refNumber: 'CONTRACT-2024-001',
    expiresAt: null,
    items: [
      { id: 'i1', description: 'Wedding MC & hosting services', amount: 0 },
    ],
    subtotal: 0,
    taxRate: 0,
  }
}

/**
 * Main page component. Reads the surface segment via useParams, which is
 * SSR-safe in client components (window.location here previously made the
 * server and client render different trees and broke hydration).
 */
export default function BrandingPreviewPage() {
  const params = useParams<{ surface: string }>()
  const surface = params?.surface

  if (!surface || !isValidSurface(surface)) {
    return <UnknownSurfaceState surface={surface ?? 'unknown'} />
  }

  return <PreviewContent surface={surface} />
}

/**
 * Content renderer for a valid surface.
 */
function PreviewContent({ surface }: { surface: 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire' }) {
  const { branding, blocks: savedBlocks, loading } = useCurrentBranding(surface)
  useBrandingHead(branding)

  // Inject branding fonts (same pattern as the builder preview pane)
  useEffect(() => {
    if (!branding) return
    const id = 'zebri-branding-preview-fonts'
    const href = googleFontsHref([branding.font_heading, branding.font_body])
    const existing = document.getElementById(id) as HTMLLinkElement | null
    if (existing && existing.href !== href) existing.remove()
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = href
      document.head.appendChild(link)
    }
  }, [branding])

  if (loading || !branding) {
    return <LoadingState />
  }

  // Match the outward-facing document frame: the light-grey canvas sits behind
  // the white card so the preview reads like the sent document (and like the
  // builder). The portal is a wider dashboard-style surface, so it keeps its own
  // surface colour rather than the document canvas.
  const pageStyle = {
    background: surface === 'portal' ? branding.surface_color : DOC_CANVAS_BG,
    color: branding.text_color,
    minHeight: '100vh',
  }

  if (surface === 'invoice') {
    return <InvoicePreview branding={branding} blocks={savedBlocks} pageStyle={pageStyle} />
  }

  if (surface === 'contract') {
    return <ContractPreview branding={branding} blocks={savedBlocks} pageStyle={pageStyle} />
  }

  if (surface === 'portal') {
    return <PortalPreview branding={branding} blocks={savedBlocks} pageStyle={pageStyle} />
  }

  if (surface === 'vendorTimeline') {
    return <VendorTimelinePreview branding={branding} blocks={savedBlocks} pageStyle={pageStyle} />
  }

  if (surface === 'questionnaire') {
    return <QuestionnairePreview branding={branding} blocks={savedBlocks} pageStyle={pageStyle} />
  }

  return null
}

/**
 * Invoice surface preview with sample data.
 */
function InvoicePreview({
  branding,
  blocks,
  pageStyle,
}: {
  branding: PublicBranding
  blocks: Block[]
  pageStyle: Record<string, string | number>
}) {
  const doc = sampleInvoiceDoc()

  return (
    <div style={pageStyle}>
      <div className="mx-auto w-full p-4" style={{ maxWidth: DOC_MAX_WIDTH_PX }}>
        <div className="rounded-xl border shadow-sm overflow-hidden p-8 @container/doc" style={{ background: branding.surface_color, borderColor: branding.border_color }}>
          {/* Render the action (CTA) block: on the live payment page a functional
              button is injected separately (so it's hidden there to avoid a
              duplicate), but this static preview has no such button, so we let the
              block-tree CTA show — matching what the couple actually sees. */}
          <PublicBlockRenderer
            blocks={blocks}
            branding={branding}
            doc={doc}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Contract surface preview with sample data.
 */
function ContractPreview({
  branding,
  blocks,
  pageStyle,
}: {
  branding: PublicBranding
  blocks: Block[]
  pageStyle: Record<string, string | number>
}) {
  const doc = sampleContractDoc()

  // The contract body + sign form are render-split markers: the generic block
  // renderer emits nothing for them (on the live page the real signed body + the
  // sign / decline form are injected there). Walk the tree, flushing chrome runs
  // and injecting a mock body / sign section at each marker, mirroring
  // app/contract/[token] ContractBrandedCard.
  const contractBodyBlock = blocks.find(
    (b): b is ContractBodyBlock => b.type === 'contractBody',
  )
  const contractSignBlock = blocks.find(
    (b): b is ContractSignBlock => b.type === 'contractSign',
  )

  const nodes: React.ReactNode[] = []
  let buffer: Block[] = []
  let bufKey = 0
  const flush = () => {
    if (buffer.length > 0) {
      nodes.push(
        <PublicBlockRenderer key={`chrome-${bufKey++}`} blocks={buffer} branding={branding} doc={doc} hideAction />,
      )
      buffer = []
    }
  }
  for (const b of blocks) {
    if (b.type === 'contractBody') {
      flush()
      nodes.push(
        <PreviewContractBody key="body" branding={branding} {...(contractBodyBlock ? { block: contractBodyBlock } : {})} />,
      )
    } else if (b.type === 'contractSign') {
      flush()
      nodes.push(
        <PreviewContractSign key="sign" branding={branding} {...(contractSignBlock ? { block: contractSignBlock } : {})} />,
      )
    } else {
      buffer.push(b)
    }
  }
  flush()

  return (
    <div style={pageStyle}>
      <div className="mx-auto w-full p-4" style={{ maxWidth: DOC_MAX_WIDTH_PX }}>
        <div className="rounded-xl border shadow-sm overflow-hidden p-8 @container/doc" style={{ background: branding.surface_color, borderColor: branding.border_color }}>
          {nodes}
        </div>
      </div>
    </div>
  )
}

/**
 * Mock contract body for the preview — sample clauses + MC signature, rendered
 * with the branding's body / subheading / label type roles so the preview
 * reflects the MC's typography. Never sent; the couple's real body replaces it.
 */
function PreviewContractBody({
  branding,
  block,
}: {
  branding: PublicBranding
  block?: ContractBodyBlock
}) {
  // Layer the contract-scoped overrides (if any) on top of the global body /
  // section-heading roles. `resolveTextStyle` returns ready CSS, and with no
  // override it resolves exactly to the role defaults, so an unstyled preview
  // is unchanged.
  const headingCss = resolveTextStyle(block?.subheadingStyle, roleDefaults(branding, 'sectionHeading'))
  const bodyCss = resolveTextStyle(block?.bodyStyle, roleDefaults(branding, 'body'))
  return (
    <div className="space-y-6 border-t pt-8 mt-8" style={{ borderTopColor: branding.border_color }}>
      {SAMPLE_CONTRACT_CLAUSES.map((clause) => (
        <div key={clause.heading} className="space-y-1.5">
          <p style={headingCss}>{clause.heading}</p>
          <p style={bodyCss}>{clause.body}</p>
        </div>
      ))}
    </div>
  )
}

/**
 * Mock contract sign section for the preview — the prompt heading, a disabled
 * name field + agreement line, the Sign / Decline buttons, then the MC
 * countersignature, styled with the block's heading / label overrides layered
 * over the section-heading / body roles. Never sent; the live form replaces it.
 */
function PreviewContractSign({
  branding,
  block,
}: {
  branding: PublicBranding
  block?: ContractSignBlock
}) {
  const headingCss = resolveTextStyle(block?.headingStyle, roleDefaults(branding, 'sectionHeading'))
  const labelCss = resolveTextStyle(block?.labelStyle, roleDefaults(branding, 'body'))
  const buttonColor = block?.buttonColor ?? branding.brand_color
  const radius = Math.min(branding.corner_radius ?? 12, 12)
  const muted = roleDefaults(branding, 'finePrint').color
  return (
    <div className="space-y-4 border-t pt-8 mt-8" style={{ borderTopColor: branding.border_color }}>
      <p style={headingCss}>{block?.heading ?? 'Sign to accept'}</p>
      <div>
        <p className="mb-1.5" style={labelCss}>Your full legal name</p>
        <div
          className="w-full border px-3 py-2.5"
          style={{ borderRadius: radius, borderColor: branding.border_color }}
        >
          <span style={{ color: muted }}>Sarah &amp; James</span>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-4 h-4 rounded border shrink-0" style={{ borderColor: branding.border_color }} aria-hidden />
        <span style={labelCss}>
          I agree to the terms above and intend my typed name to serve as my legal signature.
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span
          className="px-5 py-2.5 inline-flex items-center text-sm font-semibold"
          style={{ backgroundColor: buttonColor, color: getTextColor(buttonColor), borderRadius: radius }}
        >
          {block?.primaryLabel ?? 'Sign contract'}
        </span>
        <span
          className="border px-4 py-2.5 text-sm font-medium"
          style={{ color: muted, borderColor: branding.border_color, borderRadius: radius }}
        >
          {block?.secondaryLabel ?? 'Decline'}
        </span>
      </div>
      <div className="border-t pt-6" style={{ borderTopColor: branding.border_color }}>
        <p className="mb-1" style={{ color: muted, fontSize: 12 }}>Signed by MC</p>
        <p style={{ fontSize: 28, lineHeight: 1, color: roleDefaults(branding, 'body').color, fontFamily: 'Caveat, "Brush Script MT", cursive' }}>
          Your name
        </p>
      </div>
    </div>
  )
}

/**
 * Portal surface preview with sample data.
 */
function PortalPreview({
  branding,
  blocks,
  pageStyle,
}: {
  branding: PublicBranding
  blocks: Block[]
  pageStyle: Record<string, string | number>
}) {
  const sampleDoc: PublicDocData = {
    title: 'Couple Portal',
    refNumber: '',
    expiresAt: null,
    items: [],
    subtotal: 0,
    taxRate: 0,
  }

  return (
    <div style={pageStyle}>
      <div className="mx-auto w-full p-4" style={{ maxWidth: DOC_MAX_WIDTH_PX }}>
        <div className="rounded-xl border shadow-sm overflow-hidden p-8 @container/doc" style={{ background: branding.surface_color, borderColor: branding.border_color }}>
          <PublicBlockRenderer
            blocks={blocks}
            branding={branding}
            doc={sampleDoc}
            hideAction
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Vendor timeline surface preview with sample data.
 */
function VendorTimelinePreview({
  branding,
  blocks,
  pageStyle,
}: {
  branding: PublicBranding
  blocks: Block[]
  pageStyle: Record<string, string | number>
}) {
  const sampleDoc: PublicDocData = {
    title: 'Run Sheet',
    refNumber: '',
    expiresAt: null,
    items: [],
    subtotal: 0,
    taxRate: 0,
  }

  // The run sheet body is a render-split marker (null in the generic renderer).
  // Split at it and inject a sample timeline so the preview shows a body, like
  // the public run sheet page does with live data.
  const markerIdx = blocks.findIndex((b) => b.type === 'vendorTimelineBody')
  const preBlocks = markerIdx >= 0 ? blocks.slice(0, markerIdx) : blocks
  const postBlocks = markerIdx >= 0 ? blocks.slice(markerIdx + 1) : []
  // Carry the run sheet body block's typography overrides into the injected
  // timeline, so the preview matches the sent run sheet. Absent block / no
  // overrides resolve to the historical defaults (identical render).
  const vtbBlock = markerIdx >= 0 ? (blocks[markerIdx] as VendorTimelineBodyBlock) : undefined
  const vtbStyles = vtbBlock
    ? { title: vtbBlock.titleStyle, subtitle: vtbBlock.subtitleStyle, body: vtbBlock.bodyStyle, note: vtbBlock.noteStyle }
    : undefined

  return (
    <div style={pageStyle}>
      <div className="mx-auto w-full p-4" style={{ maxWidth: DOC_MAX_WIDTH_PX }}>
        <div className="rounded-xl border shadow-sm overflow-hidden p-8 @container/doc" style={{ background: branding.surface_color, borderColor: branding.border_color }}>
          <PublicBlockRenderer blocks={preBlocks} branding={branding} doc={sampleDoc} hideAction />
          {markerIdx >= 0 ? (
            <div className="pt-6">
              <VendorTimeline events={[SAMPLE_RUN_SHEET_EVENT]} items={SAMPLE_RUN_SHEET_ITEMS} branding={branding} {...(vtbStyles ? { styles: vtbStyles } : {})} />
            </div>
          ) : null}
          {postBlocks.length > 0 ? (
            <PublicBlockRenderer blocks={postBlocks} branding={branding} doc={sampleDoc} hideAction />
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Questionnaire surface preview with sample data.
 */
function QuestionnairePreview({
  branding,
  blocks,
  pageStyle,
}: {
  branding: PublicBranding
  blocks: Block[]
  pageStyle: Record<string, string | number>
}) {
  const sampleDoc: PublicDocData = {
    title: 'Questionnaire',
    refNumber: '',
    expiresAt: null,
    items: [],
    subtotal: 0,
    taxRate: 0,
  }

  return (
    <div style={pageStyle}>
      <div className="mx-auto w-full p-4" style={{ maxWidth: DOC_MAX_WIDTH_PX }}>
        <div className="rounded-xl border shadow-sm overflow-hidden p-8 @container/doc" style={{ background: branding.surface_color, borderColor: branding.border_color }}>
          <PublicBlockRenderer
            blocks={blocks}
            branding={branding}
            doc={sampleDoc}
            hideAction
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Fallback state for unknown surface.
 */
function UnknownSurfaceState({ surface }: { surface: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface p-4">
      <div className="text-center">
        <p className="text-text-muted text-sm">Unknown surface: {surface}</p>
        <p className="text-text-subtle text-xs mt-2">Valid surfaces: invoice, contract, portal, vendorTimeline, questionnaire</p>
      </div>
    </div>
  )
}

/**
 * Loading state while branding data is fetched.
 */
function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface p-4">
      <div className="text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-surface-muted rounded w-48 mx-auto mb-2" />
          <div className="h-4 bg-surface-muted rounded w-32 mx-auto" />
        </div>
      </div>
    </div>
  )
}
