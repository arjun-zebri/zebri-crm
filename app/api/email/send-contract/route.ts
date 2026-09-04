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
import { CONTRACT_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit';
import { parseJsonBody } from '@/lib/api/validate';
import { resolveVendorRole } from '@/lib/branding/vendor-role';
import {
  buildContractVariables,
  findUnknownVariables,
  renderContractHtml,
} from '@/lib/contracts/contract-variables';
import { groupRecipientsByAddress } from '@/lib/contracts/signer-recipients';
import { resolveCoupleEmail } from '@/lib/couples/email';
import { sendContractEmail } from '@/lib/email';
import { emailBrandingForUser } from '@/lib/email/branding';
import { resolveSender } from '@/lib/email/sender-identity';
import { createClient } from '@/lib/supabase/server';

// 10 / min / IP. Each call sends a real email (Resend spend) and
// flips contract state — looser than the public sign/decline limit
// because legitimate MCs do send batches, but tight enough to cap
// runaway retry loops.
const limiter = inMemoryLimiter(CONTRACT_RATE_LIMITS.send);

const bodySchema = z.object({
  contractId: z.uuid('contractId must be a UUID'),
  /**
   * Whether to email the couple. Default true, which is the historical
   * behaviour.
   *
   * `false` makes the contract live WITHOUT sending anything, so the MC can
   * hand the link over themselves (in a text, a DM, in person). It is the same
   * lock either way: the body is frozen, the token is enabled, the supplier
   * countersignature is stamped and the audit row is written. Only the email
   * is skipped. Sharing the flag with the send path rather than adding a
   * second route is deliberate: the lock has real rules (merge-field
   * validation, the countersignature, the audit event) and two copies of it
   * would drift.
   */
  deliver: z.boolean().optional(),
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
  const { contractId, deliver = true } = parsed.data;

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select(
      'id, title, contract_number, content, status, share_token, expires_at, couple_id, signing_mode, couples(name, email, primary_email, primary_name, secondary_name)',
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

  const vars = buildContractVariables({
    couple: {
      name: couple.name,
      email: couple.email,
      primary_name: couple.primary_name,
      secondary_name: couple.secondary_name,
    },
    firstEvent: firstEvent ?? null,
    userMeta: user.user_metadata ?? {},
    userEmail: user.email ?? null,
  });

  // `contract.content` is generated as Json; the renderer expects
  // tiptap JSONContent.
  const contractContent = contract.content as unknown as Parameters<
    typeof renderContractHtml
  >[0];

  // The document's heading comes from the Contract header block in Branding;
  // `contracts.title` is an optional per-contract override and an internal
  // label. It is still never auto-generated, so the email subject falls back
  // to the contract number rather than inventing wording.
  const contractTitle = contract.title?.trim() || `Contract ${contract.contract_number}`;

  // Refuse to send a body containing merge fields we cannot resolve. Without
  // this the renderer silently emits the literal "{{token}}" into the locked
  // snapshot the couple signs, and that snapshot is immutable once sent.
  const unknownVars = findUnknownVariables(contractContent);
  if (unknownVars.length > 0) {
    logger.error('[email/send-contract] unresolvable merge fields', null, {
      contractId,
      unknownVars,
    });
    return NextResponse.json(
      {
        error:
          'This contract uses merge fields that no longer exist: ' +
          `${unknownVars.map((v) => `{{${v}}}`).join(', ')}. ` +
          'Remove them from the body, then send again.',
      },
      { status: 422 },
    );
  }

  const lockedHtml = renderContractHtml(contractContent, vars);

  const mcSignatureName = vars.mc_signature_name;
  const mcBusinessName =
    (user.user_metadata?.business_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    `Your ${resolveVendorRole(user.user_metadata)}`;

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

  // Record the supplier's countersignature as a real, evidenced act.
  //
  // Previously `mc_signature_name` was simply copied out of Settings and
  // rendered as "Signed by MC" with no timestamp, IP or audit row, so the
  // supplier never actually affirmed anything, which is the weakest link in
  // the document's execution. Sending is an authenticated, deliberate act, so
  // it is stamped here with the same evidence captured for a client signature.
  // Upserted rather than inserted so a re-send after a revoke re-signs the
  // existing row (revoke_contract clears every signature).
  const { data: vendorRow } = await supabase
    .from('contract_signers')
    .select('id')
    .eq('contract_id', contractId)
    .eq('role', 'vendor')
    .maybeSingle();

  // The MC's drawn signature, snapshotted at send. This is the immutability
  // property: the contract carries the signature as it was when executed, so
  // redrawing it in Settings later never alters a document already sent.
  const { data: mcSettings } = await supabase
    .from('user_public_settings')
    .select('mc_signature_image')
    .eq('user_id', user.id)
    .maybeSingle();
  const mcSignatureImage = mcSettings?.mc_signature_image ?? null;

  const vendorSignature = {
    signed_at: new Date().toISOString(),
    signer_name_typed: mcSignatureName,
    signer_ip: ipOf(request),
    signer_user_agent: request.headers.get('user-agent') ?? '',
    signature_mode: mcSignatureImage ? 'drawn' : 'typed',
    signature_image: mcSignatureImage,
  };

  const { error: vendorError } = vendorRow
    ? await supabase
        .from('contract_signers')
        .update({ name: mcSignatureName, ...vendorSignature })
        .eq('id', vendorRow.id)
    : await supabase.from('contract_signers').insert({
        contract_id: contractId,
        user_id: user.id,
        role: 'vendor',
        name: mcSignatureName,
        email: user.email ?? null,
        // Ordered before the clients: the supplier signs by sending.
        signing_order: 0,
        required: true,
        ...vendorSignature,
      });

  if (vendorError) {
    // Non-fatal: the contract is already locked and live. Losing the vendor
    // row weakens the audit trail but must not block the couple from signing.
    logger.error('[email/send-contract] vendor countersignature failed', vendorError, {
      contractId,
    });
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

  // Each client signer gets their OWN link. A shared link cannot evidence who
  // signed (anyone holding it can type any name), and with two partners the
  // first to open it would consume the other's signature slot.
  const { data: signers } = await supabase
    .from('contract_signers')
    .select('id, name, email, sign_token, signing_order')
    .eq('contract_id', contractId)
    .eq('role', 'client')
    .order('signing_order');

  // Fall back to the legacy shared link if the roster is somehow empty, so a
  // send never silently delivers nothing.
  // On a sequential contract only the first signer is invited now; the rest
  // are held until it is their turn (sendNextSignerInvite does that). Emailing
  // everyone up front would defeat the ordering the MC asked for.
  const invited =
    contract.signing_mode === 'sequential' && signers && signers.length > 0
      ? signers.filter((s) => s.signing_order === signers[0]!.signing_order)
      : signers;

  const recipients =
    invited && invited.length > 0
      ? invited.map((s) => ({
          email: s.email || coupleEmail,
          name: s.name || coupleName,
          token: s.sign_token,
        }))
      : [{ email: coupleEmail, name: coupleName, token: contract.share_token }];

  // Fetch the sender's branding to render the email with their brand colors,
  // fonts, and logo. Gracefully continues without branding if fetch fails.
  const branding = await emailBrandingForUser(supabase, user.id);
  const sender = await resolveSender(supabase, user.id, mcBusinessName);

  // Group by address rather than de-duplicating it. Partners often share one
  // inbox; dropping the duplicate used to drop the second partner's link with
  // it, leaving them unable to sign and the contract unable to complete. One
  // email per mailbox, one named button per signer in it, keeps both partners
  // reachable without inviting either to sign the wrong link.
  const groups = groupRecipientsByAddress(
    recipients,
    (token) => `${process.env.NEXT_PUBLIC_APP_URL}/contract/${token}`,
  );

  // Activation without delivery stops here: the contract is locked, live and
  // signable, and the MC sends the link however they like.
  if (!deliver) {
    return NextResponse.json({ ok: true, delivered: false });
  }

  const failures: string[] = [];
  for (const group of groups) {
    const result = await sendContractEmail({
      coupleEmail: group.email,
      coupleName: group.name,
      contractNumber: contract.contract_number,
      contractTitle,
      expiresAt: contract.expires_at,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/contract/${group.token}`,
      mcBusinessName,
      links: group.links,
      sender,
      branding,
    });
    if (!result.ok) failures.push(group.email);
  }

  // The contract is already locked and live at this point, so a partial
  // delivery is reported rather than rolled back.
  if (groups.length > 0 && failures.length === groups.length) {
    logger.error('[email/send-contract] sendContractEmail failed', null, {
      contractId,
      failures,
    });
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
  if (failures.length > 0) {
    logger.error('[email/send-contract] partial delivery', null, { contractId, failures });
  }

  sendSlackAlert({
    text: `📝 Contract sent to ${coupleName} - ${contract.title} (${contract.contract_number})`,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, delivered: true });
}
