/**
 * Send a proposal email to a couple.
 *
 * POST `/api/email/send-proposal` `{ proposalId }`: RLS-gated lookup,
 * enables the share token (what makes the link resolvable), flips draft
 * to sent, emails the link via Resend, stamps `email_sent_at`, and logs a
 * `couple_emails` row so the send shows on the couple's Emails tab.
 * Rate-limited 5/min/user.
 *
 * @module app/api/email/send-proposal/route
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { EMAIL_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { resolveVendorRole } from '@/lib/branding/vendor-role';
import { resolveCoupleEmail } from '@/lib/couples/email';
import { sendProposalEmail } from '@/lib/email';
import { emailBrandingForUser } from '@/lib/email/branding';
import { resolveSender } from '@/lib/email/sender-identity';
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
      'id, couple_id, proposal_number, title, share_token, share_token_enabled, status, expires_at, contract_template_id, couples(email, primary_email, name)',
    )
    .eq('id', proposalId)
    .eq('user_id', user.id)
    .single();
  if (error || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  if (proposal.status === 'accepted') {
    return NextResponse.json({ error: 'This proposal has already been accepted.' }, { status: 409 });
  }
  if (!proposal.contract_template_id) {
    return NextResponse.json({ error: 'Choose a contract template before sending.' }, { status: 400 });
  }

  const couple = Array.isArray(proposal.couples) ? proposal.couples[0] : proposal.couples;
  const coupleEmail = resolveCoupleEmail(couple);
  const coupleName = couple?.name || 'there';
  if (!coupleEmail) {
    return NextResponse.json(
      { error: 'No email on file for this couple. Add one in their profile.' },
      { status: 400 },
    );
  }

  // Sending implicitly says "the couple may view this" and "this is no
  // longer a draft". The two flips are independent, mirroring the
  // send-invoice route: share_token_enabled defaults to FALSE on a
  // proposal (see the Phase A migration), so an unsent draft's link is
  // dead, and a proposal reverted to draft has the flag cleared again
  // while keeping its token.
  const updates: Record<string, unknown> = {};
  if (!proposal.share_token_enabled) updates.share_token_enabled = true;
  if (proposal.status === 'draft') updates.status = 'sent';
  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await supabase.from('proposals').update(updates).eq('id', proposalId);
    if (updErr) {
      return NextResponse.json(
        { error: 'Could not enable the proposal link. Please try again.' },
        { status: 500 },
      );
    }
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/proposal/${proposal.share_token}`;
  const mcBusinessName =
    (user.user_metadata?.business_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    `Your ${resolveVendorRole(user.user_metadata)}`;
  const expiresAt = proposal.expires_at
    ? new Date(proposal.expires_at).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Fetch the sender's branding to render the email with their brand colors,
  // fonts, and logo. Gracefully continues without branding if fetch fails.
  const branding = await emailBrandingForUser(supabase, user.id);

  const result = await sendProposalEmail({
    coupleEmail,
    coupleName,
    proposalNumber: proposal.proposal_number,
    proposalTitle: proposal.title,
    expiresAt,
    shareUrl,
    mcBusinessName,
    sender: await resolveSender(supabase, user.id, mcBusinessName),
    branding,
  });
  if (!result.ok) {
    logger.error('[email/send-proposal] resend failed', {
      userId: user.id,
      proposalId,
      error: result.error,
    });
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
  }

  await supabase.from('proposals').update({ email_sent_at: new Date().toISOString() }).eq('id', proposalId);

  // Best effort: a log failure must not fail an email that already went out.
  const { error: logErr } = await supabase.from('couple_emails').insert({
    user_id: user.id,
    couple_id: proposal.couple_id,
    template_id: null,
    template_name: 'Proposal',
    subject: `A proposal from ${mcBusinessName} - ${proposal.proposal_number}`,
    to_email: coupleEmail,
    source: 'manual',
    status: 'sent',
  });
  if (logErr) {
    logger.error('[email/send-proposal] couple_emails log failed', {
      userId: user.id,
      proposalId,
      error: logErr.message,
    });
  }

  return NextResponse.json({ ok: true });
}
