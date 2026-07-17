/**
 * Public contract page — orchestrator.
 *
 * Reached via the share-token capability URL (`/contract/<token>`).
 * Loads `get_public_contract(token)`, derives page state, wires
 * sign/decline to the public-facing API routes, and composes the
 * right card variant:
 *
 * - `<ContractBrandedCard>` when the MC has a customised block tree
 * - `<ContractFallbackCard>` otherwise
 *
 * Phase 3.2 §5 DoD:
 * - Page is an orchestrator. Status banners, loading skeleton,
 *   unavailable card, sign actions, decline dialog, branded +
 *   fallback variants all live in co-located `_components/`.
 * - Tokens on Zebri-rendered chrome. User-branded inline styles
 *   on contract surfaces (`brand`, `textColor`, …) are preserved.
 * - Explicit loading + not_found + active + expired + signed +
 *   declined states.
 * - Works on desktop + mobile.
 *
 * @module app/contract/[token]/page
 */
'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { findActionStyle } from '@/lib/branding/public-renderer';
import {
  bodyFontFamily,
  DENSITY_PAD,
  headingFontFamily,
  useBrandingHead,
} from '@/lib/branding/public-surface';
import { htmlToPlainText } from '@/lib/branding/sanitize';
import { repairBlocks } from '@/lib/branding/validate-blocks';
import { generateAndPrintPdf, publicBrandingToPdfOpts } from '@/lib/pdf/generate-pdf';
import { createClient } from '@/lib/supabase/client';

import { ContractBrandedCard } from './_components/contract-branded-card';
import { ContractDeclineDialog } from './_components/contract-decline-dialog';
import { ContractFallbackCard } from './_components/contract-fallback-card';
import { ContractLoading } from './_components/contract-loading';
import { ContractSignActions } from './_components/contract-sign-actions';
import { ContractStatusBanner } from './_components/contract-status-banner';
import { ContractUnavailable } from './_components/contract-unavailable';
import {
  deriveState,
  type PageState,
  type PublicContract,
} from './_components/public-contract';

export default function PublicContractPage() {
  const params = useParams<{ token: string }>();
  const supabase = createClient();

  const [contract, setContract] = useState<PublicContract | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_public_contract', {
      token: params.token,
    });
    if (error || !data) {
      setPageState('not_found');
      return;
    }
    const c = data as unknown as PublicContract;
    setContract(c);
    setPageState(deriveState(c));
  }, [params.token, supabase]);

  useEffect(() => {
    void load();
  }, [load]);
  useBrandingHead(contract);

  const handleSign = async () => {
    if (!signerName.trim() || !agreed) return;
    setActionLoading(true);
    setActionError(null);
    const res = await fetch('/api/contract/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, signer_name: signerName }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    setActionLoading(false);
    if (!res.ok) {
      if (data.error === 'expired') {
        setPageState('expired');
      } else if (data.error === 'already_actioned') {
        await load();
      } else {
        setActionError(data.error || 'Something went wrong. Please try again.');
      }
      return;
    }
    await load();
  };

  const handleDecline = async () => {
    setActionLoading(true);
    setActionError(null);
    const res = await fetch('/api/contract/decline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, reason: declineReason }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    setActionLoading(false);
    if (!res.ok) {
      setActionError(data.error || 'Something went wrong. Please try again.');
      return;
    }
    setDeclineOpen(false);
    await load();
  };

  const downloadPdf = () => {
    if (!contract) return;
    generateAndPrintPdf(
      {
        type: 'contract',
        documentNumber: contract.contract_number,
        title: contract.title,
        status: contract.status,
        coupleName: contract.couple_name,
        businessName: htmlToPlainText(contract.business_name ?? ''),
        items: [],
        subtotal: 0,
        total: 0,
        contractHtml: contract.locked_content_html ?? '',
        signerName: contract.signer_name,
        signedAt: contract.signed_at,
        signerIp: contract.signer_ip,
        signerUserAgent: contract.signer_user_agent,
        mcSignatureName: contract.mc_signature_name,
      },
      // Pass the contract's branding directly (it extends PublicBranding).
      publicBrandingToPdfOpts(contract),
    );
  };

  /* ─── Branding-derived values ─── */
  const pageBg = contract?.surface_color || '#fafafa';
  const textColor = contract?.text_color || '#111827';
  const mutedColor = contract?.muted_color || '#6B7280';
  const brand = contract?.brand_color || '#A7F3D0';
  const radius = contract?.corner_radius ?? 16;
  const headingStack = contract ? headingFontFamily(contract) : undefined;
  const bodyStack = contract ? bodyFontFamily(contract) : undefined;
  const headingWeight = contract?.font_weight ?? 600;
  const pad = DENSITY_PAD[contract?.density ?? 'cozy'];

  // Repair block tree when present so all required blocks are available.
  const repairedBlocks = contract?.branding_blocks && contract.branding_blocks.length > 0
    ? repairBlocks('contract', contract.branding_blocks)
    : null;

  const showHeaderBanner =
    contract?.header_image_url &&
    !repairedBlocks &&
    pageState !== 'loading' &&
    pageState !== 'not_found';

  const hasBlockTree = !!repairedBlocks;

  const actionStyle = contract
    ? findActionStyle(repairedBlocks, {
        brandColor: brand,
        cornerRadius: contract.corner_radius ?? 16,
      })
    : null;

  // Compose the body-trailing content (status banner above; sign
  // actions when active). Passed to whichever card variant we use.
  const bodyTrailing =
    contract && pageState !== 'not_found' && pageState !== 'loading' ? (
      <div className="space-y-6">
        {pageState === 'signed' ? (
          <ContractStatusBanner
            kind="signed"
            signerName={contract.signer_name}
            signedAt={contract.signed_at}
            signerIp={contract.signer_ip}
            onDownloadPdf={downloadPdf}
          />
        ) : null}
        {pageState === 'declined' ? (
          <ContractStatusBanner
            kind="declined"
            declinedAt={contract.declined_at}
            declinedReason={contract.declined_reason}
          />
        ) : null}
        {pageState === 'expired' ? (
          <ContractStatusBanner
            kind="expired"
            expiresAt={contract.expires_at}
            businessName={contract.business_name}
          />
        ) : null}
        {pageState === 'active' && actionStyle ? (
          <ContractSignActions
            signerName={signerName}
            onSignerNameChange={setSignerName}
            agreed={agreed}
            onAgreedChange={setAgreed}
            onSign={handleSign}
            onDecline={() => setDeclineOpen(true)}
            actionLoading={actionLoading}
            actionError={actionError}
            coupleName={contract.couple_name}
            textColor={textColor}
            mutedColor={mutedColor}
            radius={radius}
            actionStyle={actionStyle}
          />
        ) : null}
      </div>
    ) : null;

  return (
    <div
      className="min-h-screen"
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <div className={`max-w-3xl mx-auto ${pad.page} px-4 @container/doc`}>
        {showHeaderBanner ? (
          <div className="mb-5 overflow-hidden" style={{ borderRadius: radius }}>
            {/* User-uploaded brand asset — no next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={contract!.header_image_url!}
              alt=""
              className="block w-full h-44 object-cover"
            />
          </div>
        ) : null}

        {pageState === 'loading' ? <ContractLoading radius={radius} /> : null}

        {pageState === 'not_found' ? (
          <ContractUnavailable
            radius={radius}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        ) : null}

        {contract && pageState !== 'not_found' && pageState !== 'loading' ? (
          hasBlockTree ? (
            <ContractBrandedCard
              contract={{
                ...contract,
                branding_blocks: repairedBlocks || [],
              }}
              pageState={pageState}
              textColor={textColor}
              mutedColor={mutedColor}
              radius={radius}
              bodyTrailing={bodyTrailing}
            />
          ) : (
            <ContractFallbackCard
              contract={contract}
              pageState={pageState}
              textColor={textColor}
              mutedColor={mutedColor}
              brand={brand}
              radius={radius}
              headingStack={headingStack}
              headingWeight={headingWeight}
              bodyTrailing={bodyTrailing}
            />
          )
        ) : null}

        <p
          className="text-xs text-center mt-6"
          style={{ color: mutedColor }}
        >
          Secured by Zebri ·{' '}
          <a href="https://zebri.com.au" className="hover:opacity-70">
            zebri.com.au
          </a>
        </p>
      </div>

      <ContractDeclineDialog
        open={declineOpen}
        onCancel={() => setDeclineOpen(false)}
        onConfirm={handleDecline}
        reason={declineReason}
        onReasonChange={setDeclineReason}
        loading={actionLoading}
        error={actionError}
        businessName={contract?.business_name}
        textColor={textColor}
        mutedColor={mutedColor}
        headingStack={headingStack}
      />
    </div>
  );
}
