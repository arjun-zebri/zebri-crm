/**
 * Couple-facing contract-sign endpoint.
 *
 * Phase 3.2 hardening:
 * - **Zod-validated body** (was manual presence checks). Token is
 *   a UUID; `signer_name` is trimmed + length-bounded (2-100).
 *   No regex on the name — names like "O'Brien" / "François" /
 *   "Anh Nguyễn" mustn't be rejected.
 * - **Rate-limit** at the public category (3/min/IP). Signing is
 *   a one-shot event; bursts are abuse.
 * - **Structured logger** for the RPC-failure path (was the raw
 *   error message returned to the couple, which could leak DB
 *   internals).
 * - **`contract_audit_log` row** is written by the underlying
 *   `sign_contract` SECURITY DEFINER RPC (Phase 3.2 migration);
 *   the route just supplies IP + UA + signer name.
 *
 * Auth model: unauthenticated. The share token IS the capability;
 * `sign_contract` validates it against `share_token_enabled =
 * true` + `status = 'sent'` on the DB side.
 *
 * @module app/api/contract/sign/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { createClient } from '@/lib/supabase/server';

// 3 / min / IP — signing is a one-shot event the couple performs
// once per contract. Higher caps would only protect abuse loops.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 3 });

const bodySchema = z.object({
  token: z.uuid('Token must be a UUID'),
  // Length-only validation. No name-regex — the field's purpose is
  // "the human typed something resembling their name and asserted
  // intent". An overzealous regex would reject legitimate names with
  // accents / apostrophes / non-Latin characters and break the
  // entire e-sign flow for those users.
  signer_name: z
    .string()
    .trim()
    .min(2, 'Signer name is too short')
    .max(100, 'Signer name is too long'),
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
  const { token, signer_name: signerName } = parsed.data;

  const supabase = await createClient();
  const ip = ipOf(request);
  const userAgent = request.headers.get('user-agent');

  const { data, error } = await supabase.rpc('sign_contract', {
    token,
    p_signer_name: signerName,
    // SQL accepts null for both; we explicitly cast through the
    // generated types' string requirement.
    p_signer_ip: ip,
    p_signer_user_agent: userAgent ?? '',
  });
  if (error) {
    logger.error('[contract/sign] sign_contract RPC failed', error, {
      token,
    });
    // Don't return the raw DB error message — could leak schema
    // hints. The couple sees a generic message; full detail lands
    // in the log.
    return NextResponse.json(
      { error: 'Could not sign contract' },
      { status: 500 },
    );
  }

  const result = (data ?? {}) as {
    ok?: boolean;
    success?: boolean;
    error?: string;
    contract_id?: string;
    invoice_id?: string;
  };
  if (result.error) {
    // Surface the typed RPC errors verbatim — these are by-design
    // states (not_found_or_not_sent / expired) that the public
    // page handles distinctly.
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // No Slack alert on successful signing — the `contract_audit_log`
  // row from `sign_contract` captures the event durably; alerting
  // on every signature would be noise. If the MC team wants
  // notifications, the in-product dashboard surfaces the audit
  // trail.

  return NextResponse.json({
    ok: true,
    invoice_id: result.invoice_id ?? null,
  });
}
