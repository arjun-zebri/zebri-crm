/**
 * Issue a one-time code to the signer whose link this is.
 *
 * The public contract page calls this unconditionally on open; the response
 * says whether the contract actually requires verification, so the page does
 * not need to know in advance.
 *
 * Auth model: unauthenticated, like every other route under /api/contract. The
 * token is the capability.
 *
 * SERVICE-ROLE EXCEPTION. This route uses the admin client, which is unusual
 * and deliberate. `issue_signer_otp` accepts a caller-supplied hash, so it must
 * be unreachable by `anon`: otherwise a link holder could POST the hash of a
 * code they chose and then "verify" it, defeating the check entirely. The
 * alternative (SQL generates the code and returns the plaintext to an anon
 * caller) is worse still: it hands the code to the link holder, who is exactly
 * the party this exists to distinguish from the mailbox owner. This is the
 * second sanctioned exception after app/api/portal/upload/route.ts.
 *
 * @module app/api/contract/otp/request/route
 */
import { createHash } from 'node:crypto';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { recordInvalidTokenAttempt } from '@/lib/api/public-token-limiter';
import { CONTRACT_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import {
  generateOtp,
  generateSalt,
  hashOtp,
  maskEmail,
  OTP_TTL_SECONDS,
} from '@/lib/contracts/otp';
import { sendContractOtpEmail } from '@/lib/email';
import { emailBrandingForUser } from '@/lib/email/branding';
import { resolveSender } from '@/lib/email/sender-identity';
import { createAdminClient } from '@/lib/supabase/admin';

const ipLimiter = inMemoryLimiter(CONTRACT_RATE_LIMITS.otpRequestIp);
// The per-token limiters are what actually protect a signer's inbox: a per-IP
// cap does nothing against rotating addresses, because the attacker's target
// is a fixed mailbox rather than a fixed source.
const tokenBurstLimiter = inMemoryLimiter(CONTRACT_RATE_LIMITS.otpRequestToken);
const tokenHourLimiter = inMemoryLimiter(CONTRACT_RATE_LIMITS.otpRequestTokenHour);

const bodySchema = z.object({ token: z.uuid('Token must be a UUID') });

/**
 * Key the per-token limiters on a digest rather than the token itself, so a
 * capability token never sits in a process-local Map that could surface in a
 * heap dump or a crash report.
 */
function tokenKey(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 32);
}

export async function POST(request: NextRequest) {
  const ip = ipOf(request);
  const { allowed: ipOk, retryAfter } = await ipLimiter.check(ip);
  if (!ipOk) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { token } = parsed.data;

  const key = tokenKey(token);
  const burst = await tokenBurstLimiter.check(key);
  const hourly = await tokenHourLimiter.check(key);
  if (!burst.allowed || !hourly.allowed) {
    const wait = Math.ceil(Math.max(burst.retryAfter, hourly.retryAfter) / 1000);
    return NextResponse.json(
      { error: 'too_many_requests', retry_after: wait },
      { status: 429, headers: { 'Retry-After': String(wait) } },
    );
  }

  const admin = createAdminClient();
  const code = generateOtp();
  const salt = generateSalt();

  const { data, error } = await admin.rpc('issue_signer_otp', {
    p_token: token,
    p_code_hash: hashOtp(code, salt),
    p_code_salt: salt,
    p_ttl_seconds: OTP_TTL_SECONDS,
  });

  if (error) {
    logger.error('[contract/otp/request] issue_signer_otp failed', error, { token });
    return NextResponse.json({ error: 'Could not send a code' }, { status: 500 });
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    error?: string;
    required?: boolean;
    reason?: string;
    reissued?: boolean;
    otp_id?: string;
    expires_at?: string;
    email?: string;
    name?: string;
  };

  if (result.error === 'not_found') {
    await recordInvalidTokenAttempt({ ip, surface: 'contract' });
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Verification off, or the signer has no address on file. Either way the
  // page must NOT gate the form: nobody should be locked out of a contract
  // because the MC left the email field blank.
  if (!result.required) {
    return NextResponse.json({ ok: true, required: false, reason: result.reason ?? null });
  }

  // A live code already existed and was returned as-is, so nothing new is
  // emailed. This is what makes request-on-open safe against a refresh loop.
  if (result.reissued && result.email) {
    // Resolve the contract from the OTP row, not from `result`:
    // `issue_signer_otp` returns the code's id but never `contract_id`, so
    // reading that off the payload filtered on '' and matched nothing. The
    // failure is silent — it degrades to the shared Zebri sender, a blank
    // contract number in the subject, and "Your supplier" in place of the
    // MC's name — so it has to key off something the RPC actually returns.
    const { data: otpRow } = await admin
      .from('contract_signer_otps')
      .select('contract_id, user_id')
      .eq('id', result.otp_id ?? '')
      .maybeSingle();

    const { data: contract } = otpRow?.contract_id
      ? await admin
          .from('contracts')
          .select('contract_number')
          .eq('id', otpRow.contract_id)
          .maybeSingle()
      : { data: null };

    const userId = otpRow?.user_id ?? null;
    const branding = userId ? await emailBrandingForUser(admin, userId) : null;
    const mcBusinessName = branding?.business_name || 'Your supplier';
    const sender = userId ? await resolveSender(admin, userId, mcBusinessName) : undefined;

    const sent = await sendContractOtpEmail({
      recipientEmail: result.email,
      recipientName: result.name ?? 'there',
      code,
      contractNumber: contract?.contract_number ?? '',
      mcBusinessName,
      ...(sender ? { sender } : {}),
      branding,
    });
    if (!sent.ok) {
      logger.error('[contract/otp/request] code email failed', null, { token });
      return NextResponse.json({ error: 'Could not send a code' }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    required: true,
    // Never the full address: a token holder is not necessarily the signer.
    sent_to: result.email ? maskEmail(result.email) : null,
    expires_at: result.expires_at ?? null,
    retry_after: Math.ceil(CONTRACT_RATE_LIMITS.otpRequestToken.windowMs / 1000),
  });
}
