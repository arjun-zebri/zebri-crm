/**
 * Verify a signer's one-time code.
 *
 * On success the signer's `otp_verified_at` is stamped, which is what
 * `sign_contract_v2` checks. Verification state lives in the database rather
 * than a cookie or a token precisely so it cannot be forged by POSTing straight
 * at /api/contract/sign.
 *
 * Uses the service-role client for the same reason as the request route: the
 * stored hash must never be reachable through an anon-granted path. See that
 * route's module docs.
 *
 * @module app/api/contract/otp/verify/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { CONTRACT_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { OTP_MAX_ATTEMPTS, verifyOtp } from '@/lib/contracts/otp';
import { createAdminClient } from '@/lib/supabase/admin';

// A network-level brake only. The control that actually stops guessing is the
// per-row attempt counter and lockout, which IP rotation cannot evade.
const limiter = inMemoryLimiter(CONTRACT_RATE_LIMITS.otpVerify);

const bodySchema = z.object({
  token: z.uuid('Token must be a UUID'),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
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
  const { token, code } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('peek_signer_otp', { p_token: token });
  if (error) {
    logger.error('[contract/otp/verify] peek_signer_otp failed', error, { token });
    return NextResponse.json({ error: 'Could not check that code' }, { status: 500 });
  }

  const row = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    otp_id?: string;
    code_hash?: string;
    code_salt?: string;
    expires_at?: string;
    attempts?: number;
    locked_until?: string | null;
  };

  if (row.error || !row.otp_id || !row.code_hash || !row.code_salt) {
    return NextResponse.json({ error: 'no_code' }, { status: 400 });
  }
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return NextResponse.json({ error: 'locked' }, { status: 429 });
  }
  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    return NextResponse.json({ error: 'code_expired' }, { status: 400 });
  }

  // Constant-time, in Node: Postgres `text =` is not constant-time, and this
  // way the database never sees the plaintext code.
  if (!verifyOtp(code, row.code_salt, row.code_hash)) {
    const { data: failed } = await admin.rpc('fail_signer_otp', {
      p_otp_id: row.otp_id,
      p_max_attempts: OTP_MAX_ATTEMPTS,
    });
    const f = (failed ?? {}) as { locked?: boolean; attempts_remaining?: number };
    return NextResponse.json(
      {
        error: f.locked ? 'locked' : 'invalid_code',
        // Telling the signer how many tries remain leaks nothing an attacker
        // could not count themselves, and stops an honest typo feeling like a
        // dead end.
        attempts_remaining: f.attempts_remaining ?? 0,
      },
      { status: 400 },
    );
  }

  const { data: consumed, error: consumeError } = await admin.rpc('consume_signer_otp', {
    p_otp_id: row.otp_id,
    p_actor_ip: ipOf(request),
    p_actor_user_agent: request.headers.get('user-agent') ?? '',
  });
  if (consumeError) {
    logger.error('[contract/otp/verify] consume_signer_otp failed', consumeError, { token });
    return NextResponse.json({ error: 'Could not check that code' }, { status: 500 });
  }
  const c = (consumed ?? {}) as { ok?: boolean; error?: string };
  if (c.error) {
    return NextResponse.json({ error: c.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
