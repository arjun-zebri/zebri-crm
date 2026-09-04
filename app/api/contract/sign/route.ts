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
import { CONTRACT_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { sendExecutedCopies, sendNextSignerInvite } from '@/lib/contracts/notify';
import {
  isValidSignatureDataUrl,
  SIGNATURE_MAX_BYTES,
} from '@/lib/contracts/signature-image';
import { createClient } from '@/lib/supabase/server';

// 3 / min / IP — signing is a one-shot event the couple performs
// once per contract. Higher caps would only protect abuse loops.
const limiter = inMemoryLimiter(CONTRACT_RATE_LIMITS.sign);

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
  // How the signer chose to sign. Absent means typed, which is what every
  // client sent before drawn signatures existed.
  signature_mode: z.enum(['typed', 'drawn']).optional(),
  // The drawn mark, as a base64 PNG data URL. PNG only and size-capped here as
  // well as at the database, because sign_contract_v2 is SECURITY DEFINER and
  // granted to anon: this route is not the only way in, so neither check alone
  // is sufficient. See lib/contracts/signature-image.
  signature_image: z
    .string()
    .max(SIGNATURE_MAX_BYTES, 'Signature image is too large')
    .refine(isValidSignatureDataUrl, 'Signature must be a PNG data URL')
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
  const {
    token,
    signer_name: signerName,
    signature_mode: signatureMode,
    signature_image: signatureImage,
  } = parsed.data;

  const supabase = await createClient();
  const ip = ipOf(request);
  const userAgent = request.headers.get('user-agent');

  // The v2 payload RPC, so new inputs are keys rather than new parameters.
  // The 4-arg `sign_contract` name still exists as a forwarder for callers
  // that have not moved over.
  const { data, error } = await supabase.rpc('sign_contract_v2', {
    p_token: token,
    p_payload: {
      signer_name: signerName,
      // IP and user agent are read server-side: the client cannot be trusted
      // to report them.
      signer_ip: ip,
      signer_user_agent: userAgent ?? '',
      signature_mode: signatureMode ?? 'typed',
      ...(signatureImage ? { signature_image: signatureImage } : {}),
    },
  });
  if (error) {
    logger.error('[contract/sign] sign_contract_v2 RPC failed', error, {
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
    /** False while other required signers are still outstanding. */
    complete?: boolean;
    outstanding?: number;
    /** Set on a sequential contract when someone's turn has just begun. */
    next_signer_id?: string | null;
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

  // On a sequential contract the next signer has been held back until now, so
  // this is the only way they hear it is their turn. Fire-and-forget for the
  // same reason as the copies below: the signature is already recorded.
  if (result.next_signer_id && result.contract_id) {
    void sendNextSignerInvite(result.contract_id, result.next_signer_id).catch(() => undefined);
  }

  // Once the last required signature lands, give every party a copy of the
  // executed agreement. Failures here must not fail the request: the
  // signature is already recorded and is not retractable.
  if (result.complete && result.contract_id) {
    await sendExecutedCopies(result.contract_id).catch((err: unknown) => {
      logger.error('[contract/sign] executed-copy delivery failed', err, {
        contractId: result.contract_id,
      });
    });
  }

  return NextResponse.json({
    ok: true,
    invoice_id: result.invoice_id ?? null,
    complete: result.complete ?? true,
    outstanding: result.outstanding ?? 0,
  });
}
