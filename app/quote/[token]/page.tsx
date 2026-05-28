/**
 * Public quote page — orchestrator.
 *
 * Reached via the share-token capability URL (`/quote/<token>`).
 * Loads the `get_public_quote(token)` RPC payload, computes page
 * state, wires accept/decline to the `accept_quote` / `decline_quote`
 * RPCs, and composes the right card variant:
 *
 * - `<QuoteBrandedCard>` when the MC has a customised block tree
 * - `<QuoteFallbackCard>` otherwise
 *
 * Phase 2D.2 §5 DoD:
 * - Page is an orchestrator. Status banners, loading skeleton,
 *   unavailable card, action row, branded + fallback variants all
 *   live in co-located `_components/`.
 * - Design-token compliance on Zebri-rendered chrome
 *   (status banners, loading, unavailable). User-branded surfaces
 *   keep their inline-style branding untouched.
 * - Explicit loading + not_found + active + expired + accepted +
 *   declined states.
 * - Works on desktop + mobile.
 *
 * @module app/quote/[token]/page
 */
'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  bodyFontFamily,
  DENSITY_PAD,
  headingFontFamily,
  useBrandingHead,
} from '@/lib/branding/public-surface';
import { createClient } from '@/lib/supabase/client';

import { QuoteBrandedCard } from './_components/quote-branded-card';
import { QuoteFallbackCard } from './_components/quote-fallback-card';
import { QuoteLoading } from './_components/quote-loading';
import { QuoteStatusBanner } from './_components/quote-status-banner';
import { QuoteUnavailable } from './_components/quote-unavailable';
import {
  deriveState,
  type PageState,
  type PublicQuote,
} from './_components/public-quote';

export default function PublicQuotePage() {
  const params = useParams<{ token: string }>();
  const supabase = createClient();

  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_public_quote', {
      token: params.token,
    });
    if (error || !data) {
      setPageState('not_found');
      return;
    }
    const q = data as unknown as PublicQuote;
    setQuote(q);
    setPageState(deriveState(q));
  }, [params.token, supabase]);

  useEffect(() => {
    void load();
  }, [load]);
  useBrandingHead(quote);

  const handleAccept = async () => {
    setActionLoading(true);
    setActionError(null);
    const { data } = await supabase.rpc('accept_quote', { token: params.token });
    setActionLoading(false);
    const res = data as { error?: string } | null;
    if (res?.error) {
      if (res.error === 'expired') setPageState('expired');
      else if (res.error === 'already_actioned') await load();
      else setActionError('Something went wrong. Please try again.');
      return;
    }
    await load();
  };

  const handleDecline = async () => {
    setActionLoading(true);
    setActionError(null);
    const { data } = await supabase.rpc('decline_quote', { token: params.token });
    setActionLoading(false);
    const res = data as { error?: string } | null;
    if (res?.error) {
      if (res.error === 'already_actioned') await load();
      else setActionError('Something went wrong. Please try again.');
      return;
    }
    await load();
  };

  /* ─── Branding-derived values ─── */
  const pageBg = quote?.surface_color || '#fafafa';
  const textColor = quote?.text_color || '#111827';
  const mutedColor = quote?.muted_color || '#6B7280';
  const brand = quote?.brand_color || '#111827';
  const radius = quote?.corner_radius ?? 16;
  const headingStack = quote ? headingFontFamily(quote) : undefined;
  const bodyStack = quote ? bodyFontFamily(quote) : undefined;
  const headingWeight = quote?.font_weight ?? 600;
  const pad = DENSITY_PAD[quote?.density ?? 'cozy'];

  const showHeaderBanner =
    quote?.header_image_url &&
    (!quote.branding_blocks || quote.branding_blocks.length === 0) &&
    pageState !== 'loading' &&
    pageState !== 'not_found';

  const hasBlockTree =
    !!quote?.branding_blocks && quote.branding_blocks.length > 0;

  return (
    <div
      className={`min-h-screen ${pad.page} px-4`}
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <div className="max-w-lg mx-auto">
        {showHeaderBanner ? (
          <div
            className="mb-5 overflow-hidden"
            style={{ borderRadius: radius }}
          >
            {/* User-uploaded brand asset — no next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={quote!.header_image_url!}
              alt=""
              className="block w-full h-40 object-cover"
            />
          </div>
        ) : null}

        {quote && pageState === 'accepted' ? (
          <QuoteStatusBanner
            kind="accepted"
            acceptedAt={quote.accepted_at}
            businessName={quote.business_name}
          />
        ) : null}
        {quote && pageState === 'declined' ? (
          <QuoteStatusBanner kind="declined" mutedColor={mutedColor} />
        ) : null}
        {quote && pageState === 'expired' ? (
          <QuoteStatusBanner
            kind="expired"
            expiresAt={quote.expires_at}
            businessName={quote.business_name}
          />
        ) : null}

        {pageState === 'loading' ? <QuoteLoading radius={radius} /> : null}

        {pageState === 'not_found' ? (
          <QuoteUnavailable
            radius={radius}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        ) : null}

        {quote && pageState !== 'not_found' && pageState !== 'loading' ? (
          hasBlockTree ? (
            <QuoteBrandedCard
              quote={quote}
              pageState={pageState}
              onAccept={handleAccept}
              onDecline={handleDecline}
              actionLoading={actionLoading}
              actionError={actionError}
              mutedColor={mutedColor}
              radius={radius}
            />
          ) : (
            <QuoteFallbackCard
              quote={quote}
              pageState={pageState}
              onAccept={handleAccept}
              onDecline={handleDecline}
              actionLoading={actionLoading}
              actionError={actionError}
              brand={brand}
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
