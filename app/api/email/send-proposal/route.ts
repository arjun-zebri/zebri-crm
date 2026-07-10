/**
 * Send a proposal email to a couple.
 *
 * POST `/api/email/send-proposal` — looks up the proposal (RLS-gated),
 * grabs the linked couple's email, enables the share token, flips a
 * draft to `sent`, fires the templated proposal email, and stamps
 * `email_sent_at`. Returns `{ ok: true }`.
 *
 * Mirrors `/api/email/send-quote` (which it will replace when quotes
 * are removed):
 * - **Zod-validated body** (`{ proposalId: uuid }`); anything else → 400.
 * - **Rate-limited** to 5/min/user via `EMAIL_RATE_LIMITS.sendProposal`
 *   — resends are legitimate; runaway loops are not.
 * - **Structured logging** + `sendAlert` on rate-limit hits.
 *
 * The share_token_enabled flip is what fires the `proposal_sent`
 * automation event (see `tg_proposals_emit_lifecycle`).
 *
 * @module app/api/email/send-proposal/route
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { EMAIL_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { resolveCoupleEmail } from '@/lib/couples/email';
import { sendProposalEmail } from '@/lib/email';
import { resolveSender } from '@/lib/email/sender-identity';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  proposalId: z.uuid(),
});

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
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
      },
    );
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { proposalId } = parsed.data;

  // RLS scopes the SELECT to the authenticated user — a forged
  // proposalId pointing at someone else's row returns nothing.
  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select(
      // The options relationship is named explicitly: proposals also
      // reference proposal_options via accepted_option_id (to-one),
      // and the ambiguity makes PostgREST/typing pick the wrong one.
      'id, proposal_number, title, share_token, share_token_enabled, status, proposal_options!proposal_options_proposal_id_fkey(id), couples(email, primary_email, name)',
    )
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .single();

  if (proposalError || !proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  if (proposal.status === 'accepted' || proposal.status === 'declined') {
    return NextResponse.json(
      { error: 'This proposal has already been responded to.' },
      { status: 400 },
    );
  }

  const couple = Array.isArray(proposal.couples) ? proposal.couples[0] : proposal.couples;
  const coupleEmail = resolveCoupleEmail(couple);
  const coupleName = couple?.name || 'there';

  if (!coupleEmail) {
    return NextResponse.json(
      { error: 'No email on file for this couple — add one in their profile' },
      { status: 400 },
    );
  }

  // Sending says "the couple may view this" and "no longer a draft".
  // Independent flips (see the send-quote history: bundling them
  // behind one gate silently skipped the status transition).
  const updates: Record<string, unknown> = {};
  if (!proposal.share_token_enabled) updates.share_token_enabled = true;
  if (proposal.status === 'draft') updates.status = 'sent';
  if (Object.keys(updates).length > 0) {
    await supabase.from('proposals').update(updates).eq('id', proposalId);
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/proposal/${proposal.share_token}`;
  const mcBusinessName =
    (user.user_metadata?.business_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    'Your MC';

  const result = await sendProposalEmail({
    coupleEmail,
    coupleName,
    proposalNumber: proposal.proposal_number,
    proposalTitle: proposal.title,
    shareUrl,
    mcBusinessName,
    optionCount: proposal.proposal_options?.length ?? 1,
    sender: await resolveSender(supabase, user.id, mcBusinessName),
  });

  if (!result.ok) {
    logger.error('[email/send-proposal] send failed', {
      userId: user.id,
      proposalId,
      error: result.error,
    });
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
  }

  await supabase
    .from('proposals')
    .update({ email_sent_at: new Date().toISOString() })
    .eq('id', proposalId);

  return NextResponse.json({ ok: true });
}
