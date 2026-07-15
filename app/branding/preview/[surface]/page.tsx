/**
 * Customer preview page for the branding editor.
 *
 * Authed via the dashboard session (not token-gated). Renders the current user's
 * saved branding for the chosen surface (proposal/invoice/contract/portal) with
 * sample data using the same shared renderers the public pages use, so the preview
 * matches exactly what the couple receives.
 *
 * @module app/branding/preview/[surface]/page.tsx
 */
'use client'

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
function isValidSurface(s: unknown): s is 'proposal' | 'invoice' | 'contract' | 'portal' {
  return s === 'proposal' || s === 'invoice' || s === 'contract' || s === 'portal'
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
    title: 'Wedding Photography & Videography',
    coupleName: 'Emma & James',
    proposalNumber: 'PROP-2024-001',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '',
    notes: 'Package includes pre-wedding shoot and day-of coverage. Two operators on the day. All photos colour-corrected and delivered within two weeks.',
    options: [
      {
        id: 'opt-1',
        title: 'Standard Package',
        description: '8 hours coverage with two photographers',
        subtotal: 1800,
        deposit_percent: 50,
        gst_inclusive: true,
        is_popular: true,
        position: 0,
        items: [
          { id: 'i1', description: 'Engagement session (2 hours)', amount: 0, position: 0, is_addon: false, default_included: false },
          { id: 'i2', description: '8 hours day-of coverage', amount: 1200, position: 1, is_addon: false, default_included: false },
          { id: 'i3', description: 'Digital gallery (1000+ photos)', amount: 600, position: 2, is_addon: false, default_included: false },
        ],
      },
      {
        id: 'opt-2',
        title: 'Premium Package',
        description: '10 hours coverage with two photographers and videographer',
        subtotal: 2500,
        deposit_percent: 50,
        gst_inclusive: true,
        is_popular: false,
        position: 1,
        items: [
          { id: 'i4', description: 'Engagement session (2 hours)', amount: 0, position: 0, is_addon: false, default_included: false },
          { id: 'i5', description: '10 hours day-of coverage (2 photographers)', amount: 1500, position: 1, is_addon: false, default_included: false },
          { id: 'i6', description: 'Edited 4K video (same-day highlights)', amount: 500, position: 2, is_addon: false, default_included: false },
          { id: 'i7', description: 'Digital gallery (1500+ photos)', amount: 500, position: 3, is_addon: false, default_included: false },
        ],
      },
    ],
  }
}

/**
 * Sample invoice data for preview.
 */
function sampleInvoiceDoc(): PublicDocData {
  return {
    title: 'Invoice',
    refNumber: 'INV-2024-001',
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '',
    items: [
      { id: 'i1', description: 'Wedding Photography - Full Day Package', amount: 2000 },
      { id: 'i2', description: 'Travel fee', amount: 150 },
      { id: 'i3', description: 'Extra photographer (optional)', amount: 600 },
    ],
    subtotal: 2750,
    taxRate: 10,
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
      { id: 'i1', description: 'Event Photography Services', amount: 0 },
    ],
    subtotal: 0,
    taxRate: 0,
  }
}

/**
 * Main page component - extracts surface from params and renders preview.
 * Due to Next.js 16+ async params in client components, this uses window.location
 * to extract the surface from the URL path.
 */
export default function BrandingPreviewPage() {
  // Extract surface from window location in client component
  // (async params don't work well with 'use client' components in all situations)
  const pathSegments = typeof window !== 'undefined' ? window.location.pathname.split('/') : []
  const surface = pathSegments[3]

  if (!surface || !isValidSurface(surface)) {
    return <UnknownSurfaceState surface={surface ?? 'unknown'} />
  }

  return <PreviewContent surface={surface} />
}

/**
 * Content renderer for a valid surface.
 */
function PreviewContent({ surface }: { surface: 'proposal' | 'invoice' | 'contract' | 'portal' }) {
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
        <div className="rounded-xl border shadow-sm overflow-hidden" style={{ background: branding.surface_color }}>
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
            renderAccept={({ view, style }) => (
              <StaticAcceptCta expiresAt={sample.expiresAt} branding={view} style={style} />
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
        <div className="rounded-xl border shadow-sm overflow-hidden p-8" style={{ background: branding.surface_color }}>
          <PublicBlockRenderer
            blocks={blocks}
            branding={branding}
            doc={doc}
            hideAction
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
        <div className="rounded-xl border shadow-sm overflow-hidden p-8" style={{ background: branding.surface_color }}>
          <PublicBlockRenderer
            blocks={blocks}
            branding={branding}
            doc={doc}
            hideAction
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
        <div className="rounded-xl border shadow-sm overflow-hidden p-8" style={{ background: branding.surface_color }}>
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
        <p className="text-text-subtle text-xs mt-2">Valid surfaces: proposal, invoice, contract, portal</p>
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
