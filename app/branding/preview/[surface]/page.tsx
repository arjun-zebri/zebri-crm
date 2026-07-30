/**
 * Customer preview page for the branding editor.
 *
 * Authed via the dashboard session (not token-gated). Renders the current user's
 * saved branding for the chosen surface (proposal/invoice/contract/portal) with
 * sample data using the same shared renderers the public pages use, so the preview
 * matches exactly what the couple receives. Reads the surface from route params via
 * useParams for SSR safety (window.location during render breaks hydration).
 *
 * @module app/branding/preview/[surface]/page.tsx
 */
'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

import type { Block } from '@/app/(dashboard)/branding/blocks/types'
import { ProposalDocumentBody } from '@/components/proposal/proposal-document-body'
import { StaticAcceptCta } from '@/components/proposal/proposal-page-view'
import { googleFontsHref } from '@/lib/branding/fonts'
import { PublicBlockRenderer, type PublicDocData } from '@/lib/branding/public-renderer'
import { useBrandingHead, type PublicBranding } from '@/lib/branding/public-surface'
import { useCurrentBranding } from '@/lib/branding/use-current-branding'
import type { PublicProposalOption } from '@/lib/payments/proposal-view'

/**
 * Validates a surface string and returns true if it is a valid BuilderSurface.
 */
function isValidSurface(s: unknown): s is 'proposal' | 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire' {
  return s === 'proposal' || s === 'invoice' || s === 'contract' || s === 'portal' || s === 'vendorTimeline' || s === 'questionnaire'
}

/**
 * Sample proposal data for preview.
 */
function sampleProposal(): {
  options: PublicProposalOption[]
  title: string
  coupleName: string
  proposalNumber: string
  expiresAt: string
  notes: string
} {
  return {
    title: 'Wedding MC & Hosting',
    coupleName: 'Emma & James',
    proposalNumber: 'PROP-2024-001',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '',
    notes: 'Includes a pre-wedding planning meeting, a detailed run sheet, and full hosting of your ceremony and reception. Vendor coordination on the day so everything runs to time.',
    options: [
      {
        id: 'opt-1',
        title: 'Standard Package',
        description: 'Ceremony hosting plus reception MC',
        subtotal: 1800,
        deposit_percent: 50,
        gst_inclusive: true,
        is_popular: true,
        position: 0,
        items: [
          { id: 'i1', description: 'Pre-wedding planning meeting', amount: 0, position: 0, is_addon: false, default_included: false },
          { id: 'i2', description: 'Ceremony & reception hosting', amount: 1200, position: 1, is_addon: false, default_included: false },
          { id: 'i3', description: 'Run sheet & vendor coordination', amount: 600, position: 2, is_addon: false, default_included: false },
        ],
      },
      {
        id: 'opt-2',
        title: 'Premium Package',
        description: 'Full-day hosting with rehearsal attendance',
        subtotal: 2500,
        deposit_percent: 50,
        gst_inclusive: true,
        is_popular: false,
        position: 1,
        items: [
          { id: 'i4', description: 'Pre-wedding planning meeting', amount: 0, position: 0, is_addon: false, default_included: false },
          { id: 'i5', description: 'Full-day ceremony & reception hosting', amount: 1500, position: 1, is_addon: false, default_included: false },
          { id: 'i6', description: 'Ceremony rehearsal attendance', amount: 500, position: 2, is_addon: false, default_included: false },
          { id: 'i7', description: 'Run sheet & vendor coordination', amount: 500, position: 3, is_addon: false, default_included: false },
        ],
      },
    ],
  }
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
function PreviewContent({ surface }: { surface: 'proposal' | 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire' }) {
  const { branding, blocks: savedBlocks, loading } = useCurrentBranding(surface)
  useBrandingHead(branding)

  // Inject branding fonts (same pattern as proposal-preview-pane)
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

  const pageStyle = {
    background: branding.surface_color,
    color: branding.text_color,
    minHeight: '100vh',
  }

  if (surface === 'proposal') {
    return <ProposalPreview branding={branding} blocks={savedBlocks} pageStyle={pageStyle} />
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
 * Proposal surface preview with sample couple data.
 */
function ProposalPreview({
  branding,
  blocks,
  pageStyle,
}: {
  branding: PublicBranding
  blocks: Block[]
  pageStyle: Record<string, string | number>
}) {
  const sample = sampleProposal()
  const chosen = sample.options[0]!

  // Compute selection (pre-select first item of each add-on)
  const selection: Record<string, boolean> = {}
  for (const item of chosen.items) {
    if (item.is_addon) selection[item.id] = item.default_included
  }

  return (
    <div style={pageStyle}>
      <div className="mx-auto max-w-2xl p-4">
        <div className="rounded-xl border shadow-sm overflow-hidden @container/doc" style={{ background: branding.surface_color }}>
          <ProposalDocumentBody
            blocks={blocks}
            branding={branding}
            title={sample.title}
            coupleName={sample.coupleName}
            proposalNumber={sample.proposalNumber}
            notes={sample.notes}
            expiresAt={sample.expiresAt}
            options={sample.options}
            state="active"
            chosenId={chosen.id}
            selection={selection}
            renderAccept={({ view, style, publicBranding }) => (
              <StaticAcceptCta expiresAt={sample.expiresAt} branding={view} publicBranding={publicBranding} style={style} />
            )}
          />
        </div>
      </div>
    </div>
  )
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
      <div className="mx-auto max-w-2xl p-4">
        <div className="rounded-xl border shadow-sm overflow-hidden p-8 @container/doc" style={{ background: branding.surface_color }}>
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

  return (
    <div style={pageStyle}>
      <div className="mx-auto max-w-2xl p-4">
        <div className="rounded-xl border shadow-sm overflow-hidden p-8 @container/doc" style={{ background: branding.surface_color }}>
          {/* Show the CTA block (see InvoicePreview note). */}
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
      <div className="mx-auto max-w-2xl p-4">
        <div className="rounded-xl border shadow-sm overflow-hidden p-8 @container/doc" style={{ background: branding.surface_color }}>
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

  return (
    <div style={pageStyle}>
      <div className="mx-auto max-w-2xl p-4">
        <div className="rounded-xl border shadow-sm overflow-hidden p-8 @container/doc" style={{ background: branding.surface_color }}>
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
      <div className="mx-auto max-w-2xl p-4">
        <div className="rounded-xl border shadow-sm overflow-hidden p-8 @container/doc" style={{ background: branding.surface_color }}>
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
        <p className="text-text-subtle text-xs mt-2">Valid surfaces: proposal, invoice, contract, portal, vendorTimeline, questionnaire</p>
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
