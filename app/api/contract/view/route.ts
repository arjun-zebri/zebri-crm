/**
 * Couple-facing "contract opened" beacon.
 *
 * `contract_audit_log` has allowed a 'viewed' event since Phase 3.2 but
 * nothing ever wrote one, so the trail could show a contract signed with no
 * record that it was ever opened. That is the evidence you want when a
 * signatory later says they never saw the terms.
 *
 * The write is idempotent per signer inside `record_contract_view`, so a
 * refresh does not add rows. IP and user agent are captured here rather than
 * client-side for the same reason as signing: the client cannot be trusted to
 * report them.
 *
 * Auth model: unauthenticated. The token IS the capability, and the RPC
 * validates it against a live, non-revoked contract.
 *
 * @module app/api/contract/view/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { createClient } from '@/lib/supabase/server';

// Looser than signing: opening a contract is a normal, repeatable act and
// both partners may sit behind one household IP. The RPC de-duplicates, so
// the cap is only about abuse volume.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 20 });

const bodySchema = z.object({ token: z.uuid('Token must be a UUID') });

export async function POST(request: NextRequest) {
  const { allowed } = await limiter.check(ipOf(request));
  // Silently accept when rate-limited: this is a passive beacon, and a 429
  // would surface as a console error on a page the couple is trying to read.
  if (!allowed) return NextResponse.json({ ok: true });

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_contract_view', {
    token: parsed.data.token,
    p_actor_ip: ipOf(request),
    p_actor_user_agent: request.headers.get('user-agent') ?? '',
  });

  if (error) {
    // Never fail the page over an audit beacon.
    logger.error('[contract/view] record_contract_view failed', error, {
      token: parsed.data.token,
    });
  }

  return NextResponse.json({ ok: true });
}
