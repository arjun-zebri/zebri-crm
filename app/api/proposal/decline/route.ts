/**
 * POST /api/proposal/decline: the couple declined the proposal.
 *
 * `decline_proposal` (token-gated, SECURITY DEFINER) stamps the reason and
 * moves the proposal to `declined`. The route reads the proposal id back
 * with the admin client (the RPC returns none) and fires the MC
 * notification; that send is best-effort and never blocks the couple's
 * response, since the decline itself is already recorded.
 *
 * @module app/api/proposal/decline/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/alerts/logger';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf, PROPOSAL_RATE_LIMITS } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { declineBodySchema } from '@/lib/proposals/accept-schemas';
import { notifyProposalDeclined } from '@/lib/proposals/notify';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// 5 / min / IP: declining is a one-shot event per couple; the cap only
// stops a scripted loop, not a normal retry after a flaky connection.
const limiter = inMemoryLimiter(PROPOSAL_RATE_LIMITS.decline);

export async function POST(request: NextRequest) {
  const { allowed, retryAfter } = await limiter.check(ipOf(request));
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const parsed = await parseJsonBody(request, declineBodySchema);
  if (!parsed.ok) return parsed.response;
  const { token, reason, message } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('decline_proposal', {
    p_token: token,
    p_reason: reason,
    ...(message !== undefined ? { p_message: message } : {}),
  });
  if (error) {
    // The share token is a bearer credential: never in a log context.
    logger.error('[proposal/decline] decline_proposal failed', error);
    return NextResponse.json({ error: 'Could not decline the proposal' }, { status: 500 });
  }
  const r = (data ?? {}) as { ok?: boolean; error?: string };
  if (r.error === 'not_found') {
    // Counted like a bad page load so token enumeration through this route
    // trips the same burst alert and long-window cap as the page itself.
    await recordInvalidTokenAttempt({ ip: ipOf(request), surface: 'proposal' });
  }
  if (r.error || !r.ok) {
    return NextResponse.json({ error: r.error ?? 'Could not decline the proposal' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: proposal } = await admin.from('proposals').select('id').eq('share_token', token).maybeSingle();
  if (proposal?.id) {
    // Fire-and-forget: the decline is already recorded, so a notify
    // failure (email or Slack unreachable) must never surface to the couple.
    void notifyProposalDeclined(admin, proposal.id).catch((err: unknown) => {
      logger.error('[proposal/decline] notify failed', err, { proposalId: proposal.id });
    });
  }

  return NextResponse.json({ ok: true });
}
