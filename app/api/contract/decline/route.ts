/**
 * Couple-facing contract-decline endpoint.
 *
 * Phase 3.2 hardening:
 * - **Zod-validated body**. Token is a UUID; `reason` is optional,
 *   trimmed, length-bounded (0-1000). An empty string is treated
 *   as "no reason given" — same as omitting the field.
 * - **Rate-limit** at the public category (3/min/IP). Declining is
 *   one-shot; bursts are abuse.
 * - **Structured logger** for the RPC-failure path (was the raw
 *   error message returned to the couple, which could leak DB
 *   internals).
 * - **`contract_audit_log` row** is written by the underlying
 *   `decline_contract` SECURITY DEFINER RPC (Phase 3.2 migration).
 *
 * Auth model: unauthenticated. The share token IS the capability;
 * `decline_contract` validates it against `share_token_enabled =
 * true` + `status = 'sent'` on the DB side.
 *
 * @module app/api/contract/decline/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { createClient } from '@/lib/supabase/server';

// 3 / min / IP — declining is a one-shot terminal event. Any higher
// frequency is abuse, not legitimate.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 3 });

const bodySchema = z.object({
  token: z.uuid('Token must be a UUID'),
  // Reason is optional; we accept empty strings as "none given".
  // 1000-char cap prevents abuse (the column is `text` so there's
  // no DB ceiling) without being short enough to truncate
  // legitimate "thanks but our plans changed because…" notes.
  reason: z
    .string()
    .trim()
    .max(1000, 'Reason is too long')
    .optional(),
});

export async function POST(request: NextRequest) {
  const { allowed, retryAfter } = await limiter.check(ipOf(request));
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { token, reason } = parsed.data;

  // Empty string → null so the DB column stays semantically
  // accurate ("they declined without a reason").
  const reasonOrNull = reason && reason.length > 0 ? reason : null;

  const supabase = await createClient();
  const ip = ipOf(request);
  const userAgent = request.headers.get('user-agent');

  const { data, error } = await supabase.rpc('decline_contract', {
    token,
    p_reason: reasonOrNull as string,
    p_actor_ip: ip,
    p_actor_user_agent: userAgent ?? '',
  });
  if (error) {
    logger.error('[contract/decline] decline_contract RPC failed', error, {
      token,
    });
    return NextResponse.json(
      { error: 'Could not decline contract' },
      { status: 500 },
    );
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    success?: boolean;
    error?: string;
  };
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
