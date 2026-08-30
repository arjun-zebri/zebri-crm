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
import { sendContractSignedEmail } from '@/lib/email';
import { emailBrandingForUser } from '@/lib/email/branding';
import { resolveSender } from '@/lib/email/sender-identity';
import { createAdminClient } from '@/lib/supabase/admin';
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


/**
 * Email every signer, and the account holder, a copy of the executed contract.
 *
 * Runs with the service-role client because the caller here is an anonymous
 * signer: the contract and its roster are not readable under their session.
 *
 * @param contractId - The contract that just completed.
 */
async function sendExecutedCopies(contractId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: contract } = await admin
    .from('contracts')
    .select('id, user_id, title, contract_number, share_token, signed_at, couple_id')
    .eq('id', contractId)
    .single();
  if (!contract) return;

  const { data: signers } = await admin
    .from('contract_signers')
    .select('name, email, role, sign_token, signed_at, signing_order')
    .eq('contract_id', contractId)
    .order('signing_order');
  if (!signers) return;

  const { data: userRow } = await admin.auth.admin.getUserById(contract.user_id);
  const meta = (userRow?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const mcBusinessName =
    (meta.business_name as string | undefined) ||
    (meta.display_name as string | undefined) ||
    'Your supplier';

  const branding = await emailBrandingForUser(admin, contract.user_id);
  const sender = await resolveSender(admin, contract.user_id, mcBusinessName);
  const signerNames = signers.filter((s) => s.signed_at).map((s) => s.name);
  const signedAt = contract.signed_at
    ? new Date(contract.signed_at).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Each signer keeps their own link so the page can still identify them;
  // the account holder gets the canonical share link.
  const recipients: Array<{ email: string; name: string; token: string }> = [];
  for (const s of signers) {
    if (s.email) recipients.push({ email: s.email, name: s.name, token: s.sign_token });
  }
  if (userRow?.user?.email) {
    recipients.push({
      email: userRow.user.email,
      name: mcBusinessName,
      token: contract.share_token,
    });
  }

  const seen = new Set<string>();
  for (const r of recipients) {
    if (seen.has(r.email.toLowerCase())) continue;
    seen.add(r.email.toLowerCase());
    await sendContractSignedEmail({
      recipientEmail: r.email,
      recipientName: r.name,
      contractNumber: contract.contract_number,
      contractTitle: contract.title ?? `Contract ${contract.contract_number}`,
      signerNames,
      signedAt,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/contract/${r.token}`,
      mcBusinessName,
      sender,
      branding,
    });
  }
}

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
    /** False while other required signers are still outstanding. */
    complete?: boolean;
    outstanding?: number;
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
