/**
 * POST /api/proposal/accept: the couple chose a package.
 *
 * `accept_proposal` (token-gated, SECURITY DEFINER) snapshots the choice and
 * creates the draft contract plus the couple's signer row atomically. The
 * route then renders and countersigns the body with the admin client (the
 * request is anonymous; the MC's metadata is needed for merge fields and the
 * countersignature) and returns the signer token the Sign step posts to
 * `/api/contract/sign`.
 *
 * @module app/api/proposal/accept/route
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/alerts/logger';
import { sendAlert } from '@/lib/alerts/send-alert';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { inMemoryLimiter, ipOf, PROPOSAL_RATE_LIMITS } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { publishContractSnapshot } from '@/lib/contracts/publish';
import { acceptBodySchema } from '@/lib/proposals/accept-schemas';
import { acceptedTotals } from '@/lib/proposals/accepted-totals';
import type { AcceptResponse } from '@/lib/proposals/close-types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// 5 / min / IP: accepting is a one-shot event per couple; the cap only
// stops a scripted loop, not a normal retry after a flaky connection.
const limiter = inMemoryLimiter(PROPOSAL_RATE_LIMITS.accept);

export async function POST(request: NextRequest) {
  const { allowed, retryAfter } = await limiter.check(ipOf(request));
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const parsed = await parseJsonBody(request, acceptBodySchema);
  if (!parsed.ok) return parsed.response;
  const { token, optionId, addonIds } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('accept_proposal', {
    p_token: token,
    p_option_id: optionId,
    p_addon_selection: addonIds,
  });
  if (error) {
    // The share token is a bearer credential: never in a log context.
    logger.error('[proposal/accept] accept_proposal failed', error);
    // Fire-and-forget: nothing was recorded yet at this point, but a human
    // still needs to know the couple hit a wall trying to accept.
    void sendAlert({
      type: 'proposal_close_failed',
      severity: 'error',
      userId: null,
      proposalId: null,
      stage: 'accept_rpc',
      reason: error.message,
    });
    return NextResponse.json({ error: 'Could not accept the proposal' }, { status: 500 });
  }
  const r = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    contract_id?: string;
    sign_token?: string;
    user_id?: string;
    proposal_id?: string;
    already_pending?: boolean;
  };
  if (r.error === 'not_found') {
    // Counted like a bad page load so token enumeration through this route
    // trips the same burst alert and long-window cap as the page itself.
    await recordInvalidTokenAttempt({ ip: ipOf(request), surface: 'proposal' });
  }
  if (r.error || !r.contract_id || !r.sign_token || !r.user_id) {
    return NextResponse.json({ error: r.error ?? 'Could not accept the proposal' }, { status: 400 });
  }

  const admin = createAdminClient();
  const totals = await acceptedTotals(admin, r.contract_id, optionId, addonIds);
  const { data: mc } = await admin.auth.admin.getUserById(r.user_id);
  const published = await publishContractSnapshot(
    admin,
    r.contract_id,
    { id: r.user_id, email: mc?.user?.email, user_metadata: mc?.user?.user_metadata },
    {
      ip: ipOf(request),
      userAgent: request.headers.get('user-agent'),
      proposalVars: totals ? { packageName: totals.packageName, total: totals.total, deposit: totals.deposit } : null,
    },
  );
  if (!published.ok) {
    logger.error('[proposal/accept] publish failed', new Error(published.reason), { contractId: r.contract_id });
    // The couple's choice is already recorded via accept_proposal; only the
    // render/countersign step failed. Fire-and-forget so a human can render
    // the contract by hand while the couple sees a generic retry-later error.
    void sendAlert({
      type: 'proposal_close_failed',
      severity: 'error',
      userId: r.user_id,
      proposalId: r.proposal_id ?? null,
      stage: 'publish',
      reason: published.reason,
    });
    return NextResponse.json({ error: 'Could not prepare the contract' }, { status: 500 });
  }

  const { data: contract } = await admin
    .from('contracts')
    .select('contract_number, title')
    .eq('id', r.contract_id)
    .maybeSingle();

  const body: AcceptResponse = {
    ok: true,
    sign_token: r.sign_token,
    contract: {
      contract_number: contract?.contract_number ?? '',
      title: contract?.title ?? null,
      locked_content_html: published.lockedHtml,
    },
    total: totals?.total ?? 0,
    deposit: totals?.deposit ?? 0,
  };
  return NextResponse.json(body);
}
