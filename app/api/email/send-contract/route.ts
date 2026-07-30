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
import { resolveCoupleEmail } from '@/lib/couples/email';
import { sendContractEmail } from '@/lib/email';
import { emailBrandingForUser } from '@/lib/email/branding';
import { resolveSender } from '@/lib/email/sender-identity';
import { loadDefaultScheduleFirstStage } from '@/lib/payments/load-default-schedule';
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

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { contractId } = parsed.data;

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select(
      'id, title, contract_number, content, status, share_token, expires_at, couple_id, proposal_id, couples(name, email, primary_email)',
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
  // New couples only carry `primary_email` (the modal no longer
  // writes the legacy `email` column) — resolve through the helper.
  const coupleEmail = resolveCoupleEmail(couple);
  const coupleName = couple?.name || 'there';
  if (!coupleEmail) {
    return NextResponse.json(
      { error: 'No email on file for this couple - add one in their profile' },
      { status: 400 },
    );
  }

  // Gather linked data for variable substitution.
  const { data: firstEvent } = await supabase
    .from('events')
    .select('date, venue')
    .eq('couple_id', contract.couple_id)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Resolve the first stage of the payment schedule. Distinguish between a
  // genuinely absent schedule (rare, but renders `-`) and a failed read (error).
  let firstStage: { amountCents: number; dueDate: string | null } | null = null;
  let proposalTotal: number | null = null;

  if (contract.proposal_id) {
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('subtotal')
      .eq('id', contract.proposal_id)
      .maybeSingle();
    if (proposalError) {
      logger.error('[email/send-contract] Failed to fetch linked proposal', proposalError, {
        contractId,
        proposalId: contract.proposal_id,
      });
      return NextResponse.json(
        { error: 'Failed to fetch contract proposal details' },
        { status: 500 },
      );
    }
    if (proposal) {
      proposalTotal = Number(proposal.subtotal);
    }
  }

  if (proposalTotal !== null) {
    const issueDate = new Date().toISOString().slice(0, 10);
    const result = await loadDefaultScheduleFirstStage(supabase, user.id, Math.round(proposalTotal * 100), issueDate);

    if (result.ok) {
      // Schedule loaded and validated successfully
      if (result.firstStage) {
        firstStage = {
          amountCents: result.firstStage.amountCents,
          dueDate: result.firstStage.dueDate,
        };
      }
      // result.ok=true but firstStage=null is valid (schedule has no stages)
    } else if (result.reason === 'read_error') {
      // Infrastructure error: abort the send
      logger.error('[email/send-contract] Failed to fetch default schedule', result.error, {
        contractId,
      });
      return NextResponse.json(
        { error: 'Failed to fetch payment schedule' },
        { status: 500 },
      );
    } else if (result.reason === 'validation_error') {
      // MC's saved schedule is broken (invalid percentages, etc).
      // Log but continue and render `-` so the issue is visible.
      logger.error('[email/send-contract] Default schedule validation failed', result.error, {
        contractId,
        userId: user.id,
      });
      // firstStage stays null, renders as dash
    }
    // reason='no_schedule' falls through silently; firstStage stays null
  }

  const vars = buildContractVariables({
    couple: { name: couple.name, email: couple.email },
    firstEvent: firstEvent ?? null,
    proposal: proposalTotal !== null ? { total: proposalTotal } : null,
    userMeta: user.user_metadata ?? {},
    firstStage,
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

  // Fetch the sender's branding to render the email with their brand colors,
  // fonts, and logo. Gracefully continues without branding if fetch fails.
  const branding = await emailBrandingForUser(supabase, user.id);

  const result = await sendContractEmail({
    coupleEmail,
    coupleName,
    contractNumber: contract.contract_number,
    contractTitle: contract.title,
    expiresAt: contract.expires_at,
    shareUrl,
    mcBusinessName,
    sender: await resolveSender(supabase, user.id, mcBusinessName),
    branding,
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
