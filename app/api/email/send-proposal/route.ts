/**
 * Send a proposal email to a couple.
 *
 * POST `/api/email/send-proposal` `{ proposalId }`: RLS-gated lookup,
 * enables the share token (what makes the link resolvable), flips draft
 * to sent, emails the link via Resend, stamps `email_sent_at`, and logs a
 * `couple_emails` row so the send shows on the couple's Emails tab.
 * Rate-limited 5/min/user. Delegates the send itself to
 * `lib/proposals/send.ts`, shared with the `send_proposal` workflow action.
 *
 * @module app/api/email/send-proposal/route
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { sendAlert } from '@/lib/alerts';
import { EMAIL_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { resolveVendorRole } from '@/lib/branding/vendor-role';
import { resolveCoupleEmail } from '@/lib/couples/email';
import { emailBrandingForUser } from '@/lib/email/branding';
import { resolveSender } from '@/lib/email/sender-identity';
import { PROPOSAL_SEND_BLOCK_COPY, proposalSendBlock, sendProposalToCouple, type SendableProposal } from '@/lib/proposals/send';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({ proposalId: z.uuid() });
const limiter = inMemoryLimiter(EMAIL_RATE_LIMITS.sendProposal);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { allowed, retryAfter } = await limiter.check(`sendProposal:${user.id}`);
  if (!allowed) {
    await sendAlert({
      type: 'email_rate_limit_hit',
      severity: 'warn',
      action: 'sendProposal',
      userId: user.id,
      ip: ipOf(request),
    });
    return NextResponse.json(
      { error: 'Too many emails sent recently. Try again in a moment.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) } },
    );
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { proposalId } = parsed.data;

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select(
      'id, couple_id, proposal_number, title, share_token, share_token_enabled, status, expires_at, contract_template_id, email_sent_at, couples(email, primary_email, name)',
    )
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .single();
  if (error || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

  const couple = Array.isArray(proposal.couples) ? proposal.couples[0] : proposal.couples;
  const coupleEmail = resolveCoupleEmail(couple);
  const block = proposalSendBlock(proposal, coupleEmail);
  if (block) {
    return NextResponse.json(
      { error: PROPOSAL_SEND_BLOCK_COPY[block] },
      { status: block === 'accepted' ? 409 : 400 },
    );
  }

  const mcBusinessName =
    (user.user_metadata?.business_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    `Your ${resolveVendorRole(user.user_metadata)}`;

  // The `couples(...)` embed makes `proposal` a superset of SendableProposal;
  // list the columns explicitly rather than destructure-and-drop the embed
  // key (which ESLint flags as an unused variable).
  const proposalRow: SendableProposal = {
    id: proposal.id,
    couple_id: proposal.couple_id,
    proposal_number: proposal.proposal_number,
    title: proposal.title,
    share_token: proposal.share_token,
    share_token_enabled: proposal.share_token_enabled,
    status: proposal.status,
    expires_at: proposal.expires_at,
    contract_template_id: proposal.contract_template_id,
    email_sent_at: proposal.email_sent_at,
  };

  const result = await sendProposalToCouple(supabase, {
    proposal: proposalRow,
    userId: user.id,
    coupleEmail: coupleEmail!,
    coupleName: couple?.name || 'there',
    mcBusinessName,
    sender: await resolveSender(supabase, user.id, mcBusinessName),
    // Render the email with the sender's brand colors, fonts, and logo;
    // continues without branding if the fetch fails.
    branding: await emailBrandingForUser(supabase, user.id),
    source: 'manual',
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.stage === 'enable_link'
            ? 'Could not enable the proposal link. Please try again.'
            : result.error,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
