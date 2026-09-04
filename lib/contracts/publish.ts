/**
 * Rendering a contract's public snapshot.
 *
 * A contract's body is authored as TipTap JSON with merge fields in it. What
 * the couple reads is `locked_content_html`: that JSON rendered with the
 * couple's real details substituted in. SQL cannot do that rendering, so it
 * happens here and is written to the row.
 *
 * WHY SAVING PUBLISHES. There used to be no snapshot until the contract was
 * emailed, so a draft's public link resolved to a document with no body. The
 * fix was a rule that refused draft links outright, which meant an MC could
 * not simply copy a link and send it themselves. Rendering on every save
 * removes the distinction: a contract has a readable public page from the
 * moment it exists.
 *
 * "Locked" still means locked. The MC can only edit while the contract is a
 * draft, so once it is sent or signed the snapshot stops changing; before
 * then, re-rendering it on save is exactly what keeps the link honest.
 *
 * @module lib/contracts/publish
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { resolveCoupleEmail } from '@/lib/couples/email'
import type { Database } from '@/types/database'

import {
  buildContractVariables,
  findUnknownVariables,
  renderContractHtml,
} from './contract-variables'

type Client = SupabaseClient<Database>

/** The signed-in MC, as both callers already have them. */
export interface PublishUser {
  id: string
  email?: string | undefined
  user_metadata?: Record<string, unknown> | undefined
}

export interface PublishOptions {
  /** Captured server-side for the countersignature's audit fields. */
  ip?: string | null
  userAgent?: string | null
}

export type PublishResult =
  | { ok: true; lockedHtml: string; mcSignatureName: string; coupleEmail: string | null }
  | { ok: false; reason: 'not_found' | 'unresolved_variables'; unknownVars?: string[] }

/**
 * Render the contract's body and store it, together with the supplier's
 * countersignature.
 *
 * Does NOT change `status` and sends nothing. Sending is a separate act layered
 * on top of this by the send route.
 *
 * @param supabase - RLS client for the signed-in MC.
 * @param contractId - The contract to publish.
 * @param user - The MC, for merge variables and the countersignature.
 * @param options - Request-derived audit fields.
 */
export async function publishContractSnapshot(
  supabase: Client,
  contractId: string,
  user: PublishUser,
  options: PublishOptions = {},
): Promise<PublishResult> {
  const { data: contract } = await supabase
    .from('contracts')
    .select(
      'id, title, contract_number, content, couple_id, couples(name, email, primary_email, primary_name, secondary_name)',
    )
    .eq('id', contractId)
    .eq('user_id', user.id)
    .single()

  if (!contract) return { ok: false, reason: 'not_found' }

  const couple = Array.isArray(contract.couples) ? contract.couples[0] : contract.couples
  if (!couple) return { ok: false, reason: 'not_found' }

  const { data: firstEvent } = await supabase
    .from('events')
    .select('date, venue')
    .eq('couple_id', contract.couple_id)
    .order('date', { ascending: true })
    .limit(1)
    .maybeSingle()

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
  })

  const content = contract.content as unknown as Parameters<typeof renderContractHtml>[0]

  // Reported, never enforced here. The send route refuses to DELIVER a body
  // with unresolvable fields, because that snapshot is what gets signed; a
  // draft is still being written, and blocking every save over a merge field
  // the MC is midway through typing would be unusable. The builder flags them
  // inline as they type.
  const unknownVars = findUnknownVariables(content)
  const lockedHtml = renderContractHtml(content, vars)
  const mcSignatureName = vars.mc_signature_name

  await supabase
    .from('contracts')
    .update({
      locked_content: contract.content,
      locked_content_html: lockedHtml,
      mc_signature_name: mcSignatureName,
      // The public link works from the moment a contract exists.
      share_token_enabled: true,
    })
    .eq('id', contractId)

  await upsertVendorSignature(supabase, contractId, user, mcSignatureName, options)

  return {
    ok: true,
    lockedHtml,
    mcSignatureName,
    coupleEmail: resolveCoupleEmail(couple),
    ...(unknownVars.length > 0 ? { unknownVars } : {}),
  }
}

/**
 * Record the supplier's countersignature.
 *
 * Upserted rather than inserted so re-publishing (another save, or a re-send
 * after a revoke, which clears every signature) re-signs the existing row
 * instead of stacking duplicates. Failure is deliberately non-fatal: losing
 * this row weakens the audit trail but must never block the couple from
 * signing.
 */
async function upsertVendorSignature(
  supabase: Client,
  contractId: string,
  user: PublishUser,
  mcSignatureName: string,
  options: PublishOptions,
): Promise<void> {
  const { data: settings } = await supabase
    .from('user_public_settings')
    .select('mc_signature_image')
    .eq('user_id', user.id)
    .maybeSingle()
  const image = settings?.mc_signature_image ?? null

  const signature = {
    signed_at: new Date().toISOString(),
    signer_name_typed: mcSignatureName,
    signer_ip: options.ip ?? null,
    signer_user_agent: options.userAgent ?? '',
    signature_mode: image ? 'drawn' : 'typed',
    signature_image: image,
  }

  const { data: existing } = await supabase
    .from('contract_signers')
    .select('id')
    .eq('contract_id', contractId)
    .eq('role', 'vendor')
    .maybeSingle()

  if (existing) {
    await supabase
      .from('contract_signers')
      .update({ name: mcSignatureName, ...signature })
      .eq('id', existing.id)
    return
  }

  await supabase.from('contract_signers').insert({
    contract_id: contractId,
    user_id: user.id,
    role: 'vendor',
    name: mcSignatureName,
    email: user.email ?? null,
    // Ordered before the clients: the supplier commits by issuing.
    signing_order: 0,
    required: true,
    ...signature,
  })
}
