/**
 * MC-facing endpoint that locks a contract and emails the share URL
 * to the couple. The "lock" is the moment the contract becomes
 * binding: status flips draft → sent, `locked_content_html` is
 * snapshotted (so subsequent branding/template edits can't change
 * what the couple sees), and the share token is enabled.
 *
 * Phase 3.2 hardening:
 * - **Zod-validated body** (`contractId` as UUID).
 * - **Rate-limit** at 10/min/IP. Tighter than data-fetch routes —
 *   each call sends a transactional email; ceiling protects Resend
 *   spend if a client gets stuck retrying.
 * - **Structured logger** in place of leaking DB error messages.
 * - **`contract_audit_log` row** written via `emit_contract_audit_event`
 *   on successful lock — the canonical "sent" event. Captures
 *   actor='mc', no IP (this is an authenticated MC action via
 *   normal Supabase auth, not the public share-token surface).
 *
 * @module app/api/email/send-contract/route
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { sendSlackAlert } from '@/lib/alerts/slack';
import { inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import {
  buildContractVariables,
  renderContractHtml,
} from '@/lib/contracts/contract-variables';
import { sendContractEmail } from '@/lib/email';
import { hasContractsAccess } from '@/lib/payments/subscription';
import { createClient } from '@/lib/supabase/server';

// 10 / min / IP. Each call sends a real email (Resend spend) and
// flips contract state — looser than the public sign/decline limit
// because legitimate MCs do send batches, but tight enough to cap
// runaway retry loops.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 10 });

const bodySchema = z.object({
  contractId: z.uuid('contractId must be a UUID'),
});

export async function POST(request: NextRequest) {
  const { allowed, retryAfter } = await limiter.check(ipOf(request));
  if (!allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) },
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasContractsAccess(user)) {
    return NextResponse.json(
      { error: 'Contracts requires a Pro or Max plan' },
      { status: 402 },
    );
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { contractId } = parsed.data;

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select(
      'id, title, contract_number, content, status, share_token, expires_at, quote_id, couple_id, couples(name, email)',
    )
    .eq('id', contractId)
    .eq('user_id', user.id)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  if (contract.status === 'signed' || contract.status === 'declined') {
    return NextResponse.json(
      { error: 'This contract has already been actioned' },
      { status: 400 },
    );
  }

  const couple = Array.isArray(contract.couples)
    ? contract.couples[0]
    : contract.couples;
  const coupleEmail = couple?.email?.trim();
  const coupleName = couple?.name || 'there';
  if (!coupleEmail) {
    return NextResponse.json(
      { error: 'No email on file for this couple - add one in their profile' },
      { status: 400 },
    );
  }

  // Gather linked data for variable substitution.
  const [{ data: firstEvent }, quoteRes] = await Promise.all([
    supabase
      .from('events')
      .select('date, venue')
      .eq('couple_id', contract.couple_id)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    contract.quote_id
      ? supabase
          .from('quotes')
          .select('subtotal, tax_rate, discount_type, discount_value')
          .eq('id', contract.quote_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const depositPercent = Number(
    (user.user_metadata?.default_deposit_percent as number | undefined) ?? 25,
  );

  const vars = buildContractVariables({
    couple: { name: couple.name, email: couple.email },
    firstEvent: firstEvent ?? null,
    // DB row's `discount_type` is `text|null`; the helper narrows
    // to a literal union — bridge the generated-type width.
    quote: (quoteRes.data ?? null) as Parameters<
      typeof buildContractVariables
    >[0]['quote'],
    userMeta: user.user_metadata ?? {},
    depositPercent,
  });

  // `contract.content` is generated as Json; the renderer expects
  // tiptap JSONContent.
  const lockedHtml = renderContractHtml(
    contract.content as unknown as Parameters<typeof renderContractHtml>[0],
    vars,
  );

  const mcSignatureName = vars.mc_signature_name;
  const mcBusinessName =
    (user.user_metadata?.business_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    'Your MC';

  // Lock the contract: snapshot substituted content, enable the
  // share token, flip status to 'sent'.
  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'sent',
      share_token_enabled: true,
      locked_content: contract.content,
      locked_content_html: lockedHtml,
      mc_signature_name: mcSignatureName,
      email_sent_at: new Date().toISOString(),
    })
    .eq('id', contractId);

  if (updateError) {
    logger.error('[email/send-contract] lock-update failed', updateError, {
      contractId,
    });
    return NextResponse.json(
      { error: 'Failed to prepare contract for sending' },
      { status: 500 },
    );
  }

  // Emit the canonical 'sent' audit row. We do this BEFORE the
  // email send so even if Resend fails the audit captures the lock
  // moment — the contract IS sent from the platform's perspective
  // the instant the share token enables.
  const { error: auditError } = await supabase.rpc(
    'emit_contract_audit_event',
    {
      p_contract_id: contractId,
      p_event_type: 'sent',
      p_actor: 'mc',
    },
  );
  if (auditError) {
    // Don't fail the request — the audit log is observational,
    // not transactional. But we want to know.
    logger.error(
      '[email/send-contract] emit_contract_audit_event failed',
      auditError,
      { contractId },
    );
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/contract/${contract.share_token}`;

  const result = await sendContractEmail({
    coupleEmail,
    coupleName,
    contractNumber: contract.contract_number,
    contractTitle: contract.title,
    expiresAt: contract.expires_at,
    shareUrl,
    mcBusinessName,
  });

  if (!result.ok) {
    logger.error('[email/send-contract] sendContractEmail failed', null, {
      contractId,
      reason: result.error,
    });
    return NextResponse.json(
      { error: result.error || 'Failed to send email' },
      { status: 500 },
    );
  }

  sendSlackAlert({
    text: `📝 Contract sent to ${coupleName} - ${contract.title} (${contract.contract_number})`,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
