/**
 * Public invoice page — orchestrator.
 *
 * Reached via the share-token capability URL (`/invoice/<token>`).
 * Loads the `get_public_invoice(token)` RPC payload, computes the
 * derived page state + render-helpers, then composes the right
 * pieces:
 *
 * - Status banner above the card (paid / overdue)
 * - Header banner image (when the MC hasn't customised their
 *   branding block tree)
 * - Loading skeleton OR
 * - Invoice unavailable card (not found / cancelled) OR
 * - `<InvoiceBrandedCard>` when `branding_blocks` is non-empty, OR
 * - `<InvoiceFallbackCard>` otherwise
 *
 * Phase 2D.2 §5 DoD:
 * - Page is an orchestrator; no business logic / payment buttons
 *   inline. All UI lives in `_components/`.
 * - Design-token compliance on Zebri chrome (loading skeleton,
 *   unavailable card, status banners). User-branded surfaces
 *   keep their inline-style branding untouched.
 * - Explicit loading + not-found + cancelled + active + overdue
 *   + paid states.
 * - Works on desktop + mobile (Tailwind responsive classes).
 *
 * Stays a client component for now — the loading-state UX
 * (immediate render then RPC fetch) would change shape if
 * converted to a server component. The conversion is feasible
 * (anon-key RPC, no auth required) but out of scope for 2D.2.
 *
 * @module app/invoice/[token]/page
 */
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { findActionStyle } from '@/lib/branding/public-renderer';
import {
  bodyFontFamily,
  DENSITY_PAD,
  useBrandingHead,
} from '@/lib/branding/public-surface';
import { repairBlocks } from '@/lib/branding/validate-blocks';
import { createClient } from '@/lib/supabase/client';

import { InvoiceBrandedCard } from './_components/invoice-branded-card';
import { InvoiceFallbackCard } from './_components/invoice-fallback-card';
import { InvoiceLoading } from './_components/invoice-loading';
import { InvoiceStatusBanner } from './_components/invoice-status-banner';
import { InvoiceUnavailable } from './_components/invoice-unavailable';
import {
  deriveState,
  type PageState,
  type PublicInvoice,
} from './_components/public-invoice';

export default function PublicInvoicePage() {
  const params = useParams<{ token: string }>();
  const supabase = createClient();

  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc('get_public_invoice', {
        token: params.token,
      });
      if (error || !data) {
        setPageState('not_found');
        return;
      }
      const inv = data as unknown as PublicInvoice;
      setInvoice(inv);
      setPageState(deriveState(inv));
    };
    void load();
  }, [params.token, supabase]);
  useBrandingHead(invoice);

  /* ─── Derived values (cheap, recomputed on every render) ─── */
  const taxAmount = invoice ? invoice.subtotal * ((invoice.tax_rate || 0) / 100) : 0;
  const total = invoice ? invoice.subtotal + taxAmount : 0;
  const hasSchedule = invoice?.deposit_percent != null;
  const depositAmount = hasSchedule
    ? total * ((invoice!.deposit_percent ?? 0) / 100)
    : 0;
  const finalAmount = hasSchedule ? total - depositAmount : 0;
  const stripeReady =
    invoice?.stripe_payment_enabled && invoice?.stripe_connect_enabled;
  const showFullButton =
    !!stripeReady && !hasSchedule && pageState !== 'paid' && pageState !== 'cancelled';
  const showDepositButton =
    !!stripeReady &&
    hasSchedule &&
    !invoice?.deposit_paid_at &&
    pageState !== 'paid' &&
    pageState !== 'cancelled';
  const showFinalButton =
    !!stripeReady &&
    hasSchedule &&
    !!invoice?.deposit_paid_at &&
    !invoice?.final_paid_at &&
    pageState !== 'cancelled';

  /* ─── Branding-derived values ─── */
  const pageBg = invoice?.surface_color || '#fafafa';
  const textColor = invoice?.text_color || '#111827';
  const mutedColor = invoice?.muted_color || '#6B7280';
  const radius = invoice?.corner_radius ?? 16;
  const bodyStack = invoice ? bodyFontFamily(invoice) : undefined;
  const pad = DENSITY_PAD[invoice?.density ?? 'cozy'];

  // Repair block tree when present, then split at the `paymentSchedule` marker.
  // Anything before it renders the invoice body (header + items + totals),
  // and anything after renders the footer (notes, contact, etc).
  // The schedule + pay buttons get rendered by Zebri between the two halves.
  const repairedBlocks = invoice?.branding_blocks && invoice.branding_blocks.length > 0
    ? repairBlocks('invoice', invoice.branding_blocks)
    : null;
  const psIdx =
    repairedBlocks?.findIndex((b) => b.type === 'paymentSchedule') ?? -1;
  const preBlocks = repairedBlocks
    ? psIdx >= 0
      ? repairedBlocks.slice(0, psIdx)
      : repairedBlocks
    : [];
  const postBlocks =
    repairedBlocks && psIdx >= 0
      ? repairedBlocks.slice(psIdx + 1)
      : [];

  const showHeaderBannerImage =
    invoice?.header_image_url &&
    (!invoice.branding_blocks || invoice.branding_blocks.length === 0) &&
    pageState !== 'loading' &&
    pageState !== 'not_found' &&
    pageState !== 'cancelled';

  // Extract action block's button color and radius overrides.
  // Falls back to brand color and corner radius when not customised.
  const actionStyle = invoice
    ? findActionStyle(repairedBlocks, {
        brandColor: invoice.brand_color,
        cornerRadius: invoice.corner_radius,
      })
    : null;

  return (
    <div
      className={`min-h-screen ${pad.page} px-4`}
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <div className="max-w-lg mx-auto @container/doc">
        {showHeaderBannerImage ? (
          <div
            className="mb-5 overflow-hidden"
            style={{ borderRadius: radius }}
          >
            {/* User-uploaded brand asset — no next/image to avoid
                domain-allowlist friction for self-hosted MCs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={invoice!.header_image_url!}
              alt=""
              className="block w-full h-40 object-cover"
            />
          </div>
        ) : null}

        {invoice && pageState === 'paid' ? (
          <InvoiceStatusBanner kind="paid" paidAt={invoice.paid_at} branding={invoice} />
        ) : null}
        {invoice && pageState === 'overdue' ? (
          <InvoiceStatusBanner kind="overdue" businessName={invoice.business_name} branding={invoice} />
        ) : null}

        {pageState === 'loading' ? <InvoiceLoading radius={radius} /> : null}

        {pageState === 'not_found' || pageState === 'cancelled' ? (
          <InvoiceUnavailable
            kind={pageState}
            radius={radius}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        ) : null}

        {invoice &&
        pageState !== 'not_found' &&
        pageState !== 'cancelled' &&
        pageState !== 'loading' ? (
          invoice.branding_blocks && invoice.branding_blocks.length > 0 ? (
            <InvoiceBrandedCard
              invoice={invoice}
              preBlocks={preBlocks}
              postBlocks={postBlocks}
              hasSchedule={hasSchedule}
              depositAmount={depositAmount}
              finalAmount={finalAmount}
              showFullButton={showFullButton}
              showDepositButton={showDepositButton}
              showFinalButton={showFinalButton}
              branding={invoice}
              radius={radius}
              actionStyle={actionStyle}
            />
          ) : (
            <InvoiceFallbackCard
              invoice={invoice}
              pageState={pageState}
              hasSchedule={hasSchedule}
              taxAmount={taxAmount}
              total={total}
              depositAmount={depositAmount}
              finalAmount={finalAmount}
              showFullButton={showFullButton}
              showDepositButton={showDepositButton}
              showFinalButton={showFinalButton}
              branding={invoice}
              radius={radius}
              actionStyle={actionStyle}
            />
          )
        ) : null}
      </div>
    </div>
  );
}
