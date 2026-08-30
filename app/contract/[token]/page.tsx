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

import { contractPrintElement, printContract } from '@/components/print/print-contract';
import { DOC_CANVAS_BG, DOC_MAX_WIDTH_PX } from '@/lib/branding/document-frame';
import { FONT_STACKS } from '@/lib/branding/fonts';
import {
  bodyFontFamily,
  DENSITY_PAD,
  useBrandingHead,
} from '@/lib/branding/public-surface';
import { roleDefaults } from '@/lib/branding/type-defaults';
import { repairBlocks } from '@/lib/branding/validate-blocks';
import { createClient } from '@/lib/supabase/client';

import { ContractDeclineDialog } from './_components/contract-decline-dialog';
import { ContractLoading } from './_components/contract-loading';
import { ContractSignSection } from './_components/contract-sign-section';
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

  // Log the first open per signer. Fire-and-forget: an audit beacon must never
  // block or break the page the couple came here to read.
  useEffect(() => {
    void fetch('/api/contract/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token }),
    }).catch(() => undefined);
  }, [params.token]);

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
    // Prints this same page's branded card, so the file matches the link.
    printContract(contract);
  };

  /* ─── Branding-derived values ─── */
  const pageBg = DOC_CANVAS_BG;
  const textColor = contract?.text_color || '#111827';
  const mutedColor = contract?.muted_color || '#6B7280';
  const brand = contract?.brand_color || '#A7F3D0';
  const radius = contract?.corner_radius ?? 16;
  const bodyStack = contract ? bodyFontFamily(contract) : undefined;
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


  // The sign section (status banner or live sign form, plus the MC
  // countersignature). Rendered at the `contractSign` marker inside whichever
  // card variant we use; on legacy contracts with no marker the card injects it
  // right after the body. The signing state machine + decline dialog below are
  // unchanged — this slot only relocates WHERE the form renders.
  const signSlot =
    contract && pageState !== 'not_found' && pageState !== 'loading' ? (
      <ContractSignSection
        contract={contract}
        pageState={pageState}
        signerName={signerName}
        onSignerNameChange={setSignerName}
        agreed={agreed}
        onAgreedChange={setAgreed}
        onSign={handleSign}
        onDecline={() => setDeclineOpen(true)}
        actionLoading={actionLoading}
        actionError={actionError}
        onDownloadPdf={downloadPdf}
        textColor={textColor}
        mutedColor={mutedColor}
        brand={brand}
        radius={radius}
      />
    ) : null;

  return (
    <div
      className="min-h-screen"
      style={{ background: pageBg, color: textColor, fontFamily: bodyStack }}
    >
      <div className={`mx-auto w-full ${pad.page} px-4 @container/doc`} style={{ maxWidth: DOC_MAX_WIDTH_PX }}>
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

        {contract && pageState !== 'not_found' && pageState !== 'loading'
          ? // The SAME composition the builder preview and the PDF render, so
            // the link the couple opens is exactly what was previewed. Only
            // the sign slot differs: here it is the live form.
            contractPrintElement(contract, { signSlot })
          : null}

        {contract ? (
          <p
            className="text-center mt-6 hover:opacity-70"
            style={{
              color: mutedColor,
              fontSize: `${roleDefaults(contract, 'finePrint').fontSize}px`,
              fontFamily: FONT_STACKS[roleDefaults(contract, 'finePrint').fontFamily as never],
            }}
          >
            Secured by Zebri ·{' '}
            <a href="https://zebri.com.au" className="hover:opacity-70">
              zebri.com.au
            </a>
          </p>
        ) : null}
      </div>

      {contract ? (
        <ContractDeclineDialog
          open={declineOpen}
          onCancel={() => setDeclineOpen(false)}
          onConfirm={handleDecline}
          reason={declineReason}
          onReasonChange={setDeclineReason}
          loading={actionLoading}
          error={actionError}
          businessName={contract.business_name}
          textColor={textColor}
          mutedColor={mutedColor}
          branding={contract}
        />
      ) : null}
    </div>
  );
}
