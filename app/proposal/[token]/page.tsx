/**
 * Public proposal page (server component), reached by the share-token
 * capability URL `/proposal/<token>`. Loads `get_public_proposal`, gates
 * the token through the public-token limiter, and composes the page-mode
 * block tree or an unavailable card. Phase C mounts the accept stepper;
 * Phase D mounts the tracker.
 *
 * @module app/proposal/[token]/page
 */
import { createServerClient } from '@supabase/ssr';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { defaultBlocksFor } from '@/app/(dashboard)/branding/blocks/defaults';
import { parseProposalLayout, type ProposalLayout } from '@/features/proposals';
import { logger } from '@/lib/alerts/logger';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { ipOfHeaders } from '@/lib/api/rate-limit';
import { DOC_CANVAS_BG, DOC_MAX_WIDTH_PX } from '@/lib/branding/document-frame';
import { repairBlocks } from '@/lib/branding/validate-blocks';

import { ProposalPageClient } from './_components/proposal-page';
import { ProposalUnavailable } from './_components/proposal-unavailable';
import { deriveState, type PublicProposal } from './_components/public-proposal';
import { selfHealProposal } from './_lib/self-heal';

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );

  const load = async () => {
    const { data, error } = await supabase.rpc('get_public_proposal', { token });
    return error ? null : (data as unknown as PublicProposal | null);
  };
  const loaded = await load();

  // The token column is a uuid; a non-uuid path segment makes the RPC error
  // rather than return null. Both are the same "not found" from the couple's
  // perspective: never distinguish an invalid shape from a valid-but-unknown
  // token in the response, or a scanner learns something from the difference.
  if (!loaded) {
    // Count the miss so bursts alert and sustained scanning gets a 404 either way.
    await recordInvalidTokenAttempt({ ip: ipOfHeaders(await headers()), surface: 'proposal' });
    notFound();
  }

  // A signed contract with no accepted stamp means finalize never landed;
  // repair it (idempotent, admin) and re-read before rendering (W3b).
  const proposal = await selfHealProposal(loaded, load);

  const state = deriveState(proposal);

  if (state === 'expired' || state === 'declined') {
    return (
      <div className="min-h-screen px-4 py-8" style={{ background: DOC_CANVAS_BG }}>
        <div className="mx-auto w-full" style={{ maxWidth: DOC_MAX_WIDTH_PX }}>
          <ProposalUnavailable
            kind={state}
            businessName={proposal.business_name}
            // `PublicBranding` carries a phone but no MC email field today; the
            // component drops the email half of the line when it is null.
            contact={{ phone: proposal.phone, email: null }}
            branding={proposal}
          />
        </div>
      </div>
    );
  }

  // Proposal Layout v2 (Phase 1): the RPC returns only the proposal's OWN
  // layout (no default-template fallback), so v2 renders here only once
  // the proposal itself has one, which nothing writes until Phase 4 -
  // templates never render on a couple link. An invalid stored layout is a
  // bug we want to hear about, never a blank page for the couple. Called
  // only for a live proposal: an expired/declined one never reaches here.
  let layout: ProposalLayout | null = null;
  const { data: rawLayout } = await supabase.rpc('get_public_proposal_layout', { token });
  if (rawLayout) {
    const parsed = parseProposalLayout(rawLayout);
    if (parsed.ok) layout = parsed.layout;
    else logger.error('proposal_layout_invalid', undefined, { proposalId: proposal.id, issues: parsed.issues.slice(0, 5) });
  }

  const blocks =
    proposal.branding_blocks && proposal.branding_blocks.length > 0
      ? repairBlocks('proposal', proposal.branding_blocks)
      : defaultBlocksFor('proposal');

  return <ProposalPageClient proposal={proposal} blocks={blocks} layout={layout} token={token} />;
}
