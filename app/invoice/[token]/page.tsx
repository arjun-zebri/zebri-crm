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
  headingFontFamily,
  useBrandingHead,
} from '@/lib/branding/public-surface';
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
  const headingStack = invoice ? headingFontFamily(invoice) : undefined;
  const bodyStack = invoice ? bodyFontFamily(invoice) : undefined;
  const headingWeight = invoice?.font_weight ?? 600;
  const pad = DENSITY_PAD[invoice?.density ?? 'cozy'];
  // Action-style: the brand-customised colour + radius for the Pay
  // buttons. Read from the saved action block (if any) so the MC's
  // customisation flows through even though we hide the action
  // block itself in the renderer.
  const actionStyle = findActionStyle(invoice?.branding_blocks, {
    brandColor: invoice?.brand_color || '#000000',
    cornerRadius: invoice?.corner_radius ?? 16,
  });

  // Split the block tree at the `paymentSchedule` marker — anything
  // before it renders the invoice body (header + items + totals),
  // and anything after renders the footer (notes, contact, etc).
  // The schedule + pay buttons get rendered by Zebri between the
  // two halves.
  const psIdx =
    invoice?.branding_blocks?.findIndex((b) => b.type === 'paymentSchedule') ?? -1;
  const preBlocks = invoice?.branding_blocks
    ? psIdx >= 0
      ? invoice.branding_blocks.slice(0, psIdx)
      : invoice.branding_blocks
    : [];
  const postBlocks =
    invoice?.branding_blocks && psIdx >= 0
      ? invoice.branding_blocks.slice(psIdx + 1)
      : [];

  const showHeaderBannerImage =
    invoice?.header_image_url &&
    (!invoice.branding_blocks || invoice.branding_blocks.length === 0) &&
    pageState !== 'loading' &&
    pageState !== 'not_found' &&
    pageState !== 'cancelled';

  return (
    <div
      className={`min-h-screen ${pad.page} px-4`}
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <div className="max-w-lg mx-auto">
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
          <InvoiceStatusBanner kind="paid" paidAt={invoice.paid_at} />
        ) : null}
        {invoice && pageState === 'overdue' ? (
          <InvoiceStatusBanner kind="overdue" businessName={invoice.business_name} />
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
              buttonColor={actionStyle.color}
              buttonRadius={actionStyle.radius}
              textColor={textColor}
              mutedColor={mutedColor}
              radius={radius}
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
              buttonColor={actionStyle.color}
              buttonRadius={actionStyle.radius}
              textColor={textColor}
              mutedColor={mutedColor}
              radius={radius}
              headingStack={headingStack}
              headingWeight={headingWeight}
            />
          )
        ) : null}
      </div>
    </div>
  );
}
