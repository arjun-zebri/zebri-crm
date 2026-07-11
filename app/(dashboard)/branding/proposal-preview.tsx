/**
 * The branding editor's Proposal surface — a live render of the REAL
 * proposal page ({@link ProposalPageView}, the same component the
 * public page and the composer preview use) fed with sample data and
 * the kit values being edited.
 *
 * Proposals deliberately have no block-tree layout (a block tree
 * can't express the option chooser), so unlike the invoice/contract
 * surfaces this canvas is not block-editable: the kit's scalar values
 * (colors, fonts, density, radius, logo, banner, business name) are
 * exactly what flows to the couple, and this preview shows precisely
 * that — nothing else can drift.
 *
 * @module app/(dashboard)/branding/proposal-preview
 */
'use client'

import {
  ProposalPageView,
  StaticAcceptCta,
} from '@/components/proposal/proposal-page-view'
import type { ProposalViewBranding, PublicProposalOption } from '@/lib/payments/proposal-view'

/** Fixed sample content so the canvas reads like a real send. */
const SAMPLE_EXPIRES = '2026-08-30'

const SAMPLE_OPTIONS: PublicProposalOption[] = [
  {
    id: 'sample-essentials',
    title: 'The Essentials',
    description: 'A beautiful record of the day itself.',
    deposit_percent: 25,
    gst_inclusive: true,
    is_popular: false,
    subtotal: 1100,
    position: 0,
    items: [
      { id: 's1', description: 'Ceremony hosting', amount: 550, is_addon: false, default_included: false, position: 0 },
      { id: 's2', description: 'Reception MC & run sheet', amount: 550, is_addon: false, default_included: false, position: 1 },
    ],
  },
  {
    id: 'sample-timeless',
    title: 'The Full Day',
    description: 'Ceremony and reception, start to finish.',
    deposit_percent: 25,
    gst_inclusive: true,
    is_popular: true,
    subtotal: 1450,
    position: 1,
    items: [
      { id: 's3', description: 'Pre-wedding consultation', amount: 0, is_addon: false, default_included: false, position: 0 },
      { id: 's4', description: 'Ceremony hosting', amount: 550, is_addon: false, default_included: false, position: 1 },
      { id: 's5', description: 'Reception MC & run sheet', amount: 900, is_addon: false, default_included: false, position: 2 },
      { id: 's6', description: 'Rehearsal attendance', amount: 150, is_addon: true, default_included: true, position: 3 },
      { id: 's7', description: 'After-party hosting', amount: 250, is_addon: true, default_included: false, position: 4 },
    ],
  },
]

const SAMPLE_SELECTION: Record<string, boolean> = { s6: true, s7: false }

export interface ProposalSurfacePreviewProps {
  branding: ProposalViewBranding
}

/** The document card on the branding canvas. */
export function ProposalSurfacePreview({ branding }: ProposalSurfacePreviewProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-gray-200 px-6 py-8 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.28)] sm:px-8 sm:py-10"
      style={{
        background: branding.pageBg,
        color: branding.textColor,
        fontFamily: branding.bodyFontFamily,
      }}
    >
      <ProposalPageView
        coupleName="Alex & Jordan"
        proposalNumber="PR-001"
        notes={
          'We loved hearing about your day and would be honoured to be part of it. Everything here is tailored to what you shared with us.'
        }
        expiresAt={SAMPLE_EXPIRES}
        options={SAMPLE_OPTIONS}
        state="active"
        branding={branding}
        chosenId="sample-timeless"
        selection={SAMPLE_SELECTION}
        actions={<StaticAcceptCta expiresAt={SAMPLE_EXPIRES} branding={branding} />}
      />
    </div>
  )
}
