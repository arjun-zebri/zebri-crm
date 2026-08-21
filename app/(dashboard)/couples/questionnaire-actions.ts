/**
 * Server actions for sending questionnaires to a couple.
 *
 * `sendCoupleQuestionnaireAction` snapshots a template into a per-couple
 * `couple_questionnaires` row, enables its share token, and emails the couple
 * the link. The snapshot decouples the sent questionnaire from later template
 * edits (same principle as the contract content lock). All reads/writes run
 * through the RLS-scoped server client.
 *
 * @module app/(dashboard)/couples/questionnaire-actions
 */
'use server'

import { z } from 'zod'

import { logger } from '@/lib/alerts/logger'
import { resolveCoupleEmail } from '@/lib/couples/email'
import { sendQuestionnaireEmail } from '@/lib/email'
import { emailBrandingForUser } from '@/lib/email/branding'
import { resolveSender } from '@/lib/email/sender-identity'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

/** Tagged result: created questionnaire id + whether the cover email sent. */
export interface SendResult {
  ok: true
  data: { id: string; shareUrl: string; emailSent: boolean }
}
export interface SendFailure {
  ok: false
  error: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'

const inputSchema = z.object({
  coupleId: z.uuid(),
  templateId: z.uuid(),
  title: z.string().trim().min(1).max(200).optional(),
})

/**
 * Creates a questionnaire for a couple from one of the MC's templates and
 * emails them the link. Returns the new row id + share URL; `emailSent` is
 * false when the questionnaire was created but the email transport failed (the
 * MC can still copy the link from the couple profile).
 */
export async function sendCoupleQuestionnaireAction(
  input: z.infer<typeof inputSchema>,
): Promise<SendResult | SendFailure> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.' }
  const { coupleId, templateId, title } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  // Load the template (RLS scopes it to this MC) and the couple together.
  const [{ data: template }, { data: couple }] = await Promise.all([
    supabase.from('questionnaire_templates').select('name, description, questions, display_mode').eq('id', templateId).single(),
    supabase.from('couples').select('name, email, primary_email').eq('id', coupleId).single(),
  ])
  if (!template) return { ok: false, error: 'Questionnaire template not found.' }
  if (!couple) return { ok: false, error: 'Couple not found.' }

  const resolvedTitle = title ?? template.name

  const { data: created, error: insertError } = await supabase
    .from('couple_questionnaires')
    .insert({
      user_id: user.id,
      couple_id: coupleId,
      template_id: templateId,
      title: resolvedTitle,
      description: template.description,
      questions: template.questions as Database['public']['Tables']['couple_questionnaires']['Row']['questions'],
      // Snapshot the display style with the questions, for the same reason.
      display_mode: template.display_mode,
      status: 'sent',
      share_token_enabled: true,
      sent_at: new Date().toISOString(),
    })
    .select('id, share_token')
    .single()
  if (insertError || !created) {
    logger.error('[couples/questionnaire-actions] insert failed', insertError, { userId: user.id, coupleId })
    return { ok: false, error: 'Could not create the questionnaire.' }
  }

  const shareUrl = `${APP_URL}/questionnaire/${created.share_token}`
  const coupleEmail = resolveCoupleEmail(couple)

  let emailSent = false
  if (coupleEmail) {
    const mcBusinessName =
      (user.user_metadata?.business_name as string | undefined) ||
      (user.user_metadata?.display_name as string | undefined) ||
      'Your celebrant'
    // Fetch the sender's branding to render the email with their brand colors,
    // fonts, and logo. Gracefully continues without branding if fetch fails.
    const branding = await emailBrandingForUser(supabase, user.id)
    const res = await sendQuestionnaireEmail({
      coupleEmail,
      coupleName: couple.name || 'there',
      title: resolvedTitle,
      shareUrl,
      mcBusinessName,
      sender: await resolveSender(supabase, user.id, mcBusinessName),
      branding,
    })
    emailSent = res.ok
    if (!res.ok) {
      logger.error('[couples/questionnaire-actions] send email failed', null, { userId: user.id, error: res.error })
    }
  }

  return { ok: true, data: { id: created.id, shareUrl, emailSent } }
}

const resendSchema = z.object({ questionnaireId: z.uuid() })

/**
 * Re-sends the cover email for an already-sent questionnaire (e.g. the couple
 * lost it). Requires the share link to still be enabled and the questionnaire
 * not yet completed; refreshes `sent_at` so the list reflects the nudge.
 */
export async function resendCoupleQuestionnaireAction(
  input: z.infer<typeof resendSchema>,
): Promise<{ ok: true; data: { emailSent: boolean } } | SendFailure> {
  const parsed = resendSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  // RLS scopes the read to this MC's questionnaires.
  const { data: q } = await supabase
    .from('couple_questionnaires')
    .select('id, title, status, share_token, share_token_enabled, couple_id')
    .eq('id', parsed.data.questionnaireId)
    .single()
  if (!q) return { ok: false, error: 'Questionnaire not found.' }
  if (q.status === 'completed') return { ok: false, error: 'Already completed, nothing to resend.' }
  if (!q.share_token_enabled) return { ok: false, error: 'The link is turned off. Turn it on first.' }

  const { data: couple } = await supabase.from('couples').select('name, email, primary_email').eq('id', q.couple_id).single()
  const coupleEmail = couple ? resolveCoupleEmail(couple) : null
  if (!coupleEmail) return { ok: false, error: 'No email on file for this couple. Copy the link instead.' }

  const mcBusinessName =
    (user.user_metadata?.business_name as string | undefined) ||
    (user.user_metadata?.display_name as string | undefined) ||
    'Your celebrant'
  // Fetch the sender's branding to render the email with their brand colors,
  // fonts, and logo. Gracefully continues without branding if fetch fails.
  const branding = await emailBrandingForUser(supabase, user.id)
  const res = await sendQuestionnaireEmail({
    coupleEmail,
    coupleName: couple?.name || 'there',
    title: q.title,
    shareUrl: `${APP_URL}/questionnaire/${q.share_token}`,
    mcBusinessName,
    sender: await resolveSender(supabase, user.id, mcBusinessName),
    branding,
  })
  if (!res.ok) {
    logger.error('[couples/questionnaire-actions] resend email failed', null, { userId: user.id, error: res.error })
    return { ok: false, error: 'The email could not be sent. Try again shortly.' }
  }

  await supabase
    .from('couple_questionnaires')
    .update({ sent_at: new Date().toISOString(), status: 'sent' })
    .eq('id', q.id)

  return { ok: true, data: { emailSent: true } }
}
