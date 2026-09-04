/**
 * Outbound contract email that has to happen after a signature lands.
 *
 * Lives in a module rather than inline in the sign route for two reasons: the
 * route was already at the size where it stopped reading well, and both of
 * these run with the SERVICE-ROLE client because the caller is an anonymous
 * signer who cannot read the contract roster under RLS.
 *
 * Postgres deliberately does none of this. A database must not make outbound
 * HTTP calls, so `sign_contract_v2` returns `next_signer_id` and the route
 * acts on it.
 *
 * @module lib/contracts/notify
 */
import { logger } from '@/lib/alerts/logger'
import { sendContractEmail, sendContractSignedEmail } from '@/lib/email'
import { emailBrandingForUser } from '@/lib/email/branding'
import { resolveSender } from '@/lib/email/sender-identity'
import { createAdminClient } from '@/lib/supabase/admin'

/** The MC's display name, from their user metadata. */
function businessNameFrom(meta: Record<string, unknown>): string {
  return (
    (meta.business_name as string | undefined) ||
    (meta.display_name as string | undefined) ||
    'Your supplier'
  )
}

/**
 * Invite the next signer in a sequential contract.
 *
 * Sequential contracts hold every signer but the current one, so this is the
 * only way partner two ever hears that it is their turn. Failing silently would
 * strand the contract forever, so a failure is logged loudly even though it
 * cannot fail the request that triggered it (the signature is already
 * recorded and is not retractable).
 *
 * @param contractId - The contract that just advanced.
 * @param signerId - The signer whose turn it now is.
 */
export async function sendNextSignerInvite(
  contractId: string,
  signerId: string,
): Promise<void> {
  const admin = createAdminClient()

  const { data: contract } = await admin
    .from('contracts')
    .select('id, user_id, title, contract_number, expires_at')
    .eq('id', contractId)
    .single()
  if (!contract) return

  const { data: signer } = await admin
    .from('contract_signers')
    .select('name, email, sign_token')
    .eq('id', signerId)
    .maybeSingle()
  if (!signer?.email) {
    logger.error('[contracts/notify] next signer has no email', null, {
      contractId,
      signerId,
    })
    return
  }

  const { data: userRow } = await admin.auth.admin.getUserById(contract.user_id)
  const mcBusinessName = businessNameFrom(
    (userRow?.user?.user_metadata ?? {}) as Record<string, unknown>,
  )
  const branding = await emailBrandingForUser(admin, contract.user_id)
  const sender = await resolveSender(admin, contract.user_id, mcBusinessName)

  const res = await sendContractEmail({
    coupleEmail: signer.email,
    coupleName: signer.name,
    contractNumber: contract.contract_number,
    contractTitle: contract.title ?? `Contract ${contract.contract_number}`,
    expiresAt: contract.expires_at,
    shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/contract/${signer.sign_token}`,
    mcBusinessName,
    sender,
    branding,
  })

  if (!res.ok) {
    logger.error('[contracts/notify] next-signer invite failed', null, {
      contractId,
      signerId,
    })
    return
  }

  await admin.rpc('emit_contract_audit_event', {
    p_contract_id: contractId,
    p_event_type: 'invite_sent',
    p_actor: 'system',
    p_signer_name_typed: signer.name,
  })
}

/**
 * Deliver the executed contract to every party once the last signature lands.
 *
 * Moved here verbatim from the sign route alongside {@link sendNextSignerInvite},
 * which shares its service-role rationale.
 *
 * @param contractId - The contract that just completed.
 */
export async function sendExecutedCopies(contractId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: contract } = await admin
    .from('contracts')
    .select('id, user_id, title, contract_number, share_token, signed_at, couple_id')
    .eq('id', contractId)
    .single()
  if (!contract) return

  const { data: signers } = await admin
    .from('contract_signers')
    .select('name, email, role, sign_token, signed_at, signing_order')
    .eq('contract_id', contractId)
    .order('signing_order')
  if (!signers) return

  const { data: userRow } = await admin.auth.admin.getUserById(contract.user_id)
  const mcBusinessName = businessNameFrom(
    (userRow?.user?.user_metadata ?? {}) as Record<string, unknown>,
  )

  const branding = await emailBrandingForUser(admin, contract.user_id)
  const sender = await resolveSender(admin, contract.user_id, mcBusinessName)
  const signerNames = signers.filter((s) => s.signed_at).map((s) => s.name)
  const signedAt = contract.signed_at
    ? new Date(contract.signed_at).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  // Each signer keeps their own link so the page can still identify them;
  // the account holder gets the canonical share link.
  const recipients: Array<{ email: string; name: string; token: string }> = []
  for (const s of signers) {
    if (s.email) recipients.push({ email: s.email, name: s.name, token: s.sign_token })
  }
  if (userRow?.user?.email) {
    recipients.push({
      email: userRow.user.email,
      name: mcBusinessName,
      token: contract.share_token,
    })
  }

  // De-duplicating by address IS correct here, unlike the send and reminder
  // routes. This email is a receipt for a contract that is already fully
  // executed: every signer token now opens the same read-only document, so a
  // shared inbox needs one copy, not one per partner. There is no signature
  // left to attribute and therefore nothing to get wrong.
  const seen = new Set<string>()
  for (const r of recipients) {
    if (seen.has(r.email.toLowerCase())) continue
    seen.add(r.email.toLowerCase())
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
    })
  }
}
