/**
 * Questionnaire automation action.
 *
 * `send_couple_questionnaire` snapshots one of the MC's questionnaire templates
 * into a per-couple `couple_questionnaires` row, enables its share token, and
 * emails the couple the link — the automation equivalent of the manual "Send
 * questionnaire" button on the couple profile. Mirrors the document-send
 * actions in `./documents`.
 *
 * @module lib/automations/actions/questionnaire
 */

import { z } from 'zod'

import { openAutomationSend } from '@/lib/email/automation-send'
import { questionnaireHtml } from '@/lib/email/html'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionType } from '@/types/automations'
import type { Database } from '@/types/database'

import { resolveStepSender } from './step-sender'

import type { ActionSpec } from './index'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'

const sendQuestionnaireSchema = z
  .object({
    /** The questionnaire template to send. */
    questionnaireTemplateId: z.string().uuid(),
    /** Optional title override; defaults to the template name. */
    title: z.string().max(200).optional(),
  })
  .passthrough()

const sendCoupleQuestionnaire: ActionSpec<z.infer<typeof sendQuestionnaireSchema>> = {
  type: 'send_couple_questionnaire',
  configSchema: sendQuestionnaireSchema,
  async handler(ctx, config) {
    if (!ctx.couple?.email) return { kind: 'ok', output: { skipped: 'no primary email' } }
    const supabase = createAdminClient()

    // Scope the template to the run's MC — never trust the config id alone.
    const { data: template } = await supabase
      .from('questionnaire_templates')
      .select('name, questions, display_mode')
      .eq('id', config.questionnaireTemplateId)
      .eq('user_id', ctx.userId)
      .single()
    if (!template) return { kind: 'ok', output: { skipped: 'no template found' } }

    // The opt-out check and the rate limit run BEFORE the questionnaire
    // row is created. A suppressed couple gets nothing, not an orphaned
    // "sent" questionnaire they never received; and a deferral (a failed
    // lookup, the send limit) creates nothing that a retry would then
    // duplicate.
    //
    // Sent as the MC, through their connected mailbox when they have one,
    // as the manual "Send questionnaire" button does. Commercial by the
    // classification's default, so the gate adds the unsubscribe link and
    // header, and tags a shared-domain send with the tenant so a bounce
    // can be attributed.
    const to = ctx.couple.email
    const resolved = await resolveStepSender(supabase, ctx, 'send_couple_questionnaire')
    if (!resolved.ok) return resolved.result
    const sender = resolved.sender
    const gate = await openAutomationSend({
      actionType: 'send_couple_questionnaire',
      userId: ctx.userId,
      manualRun: ctx.manualRun,
      instanceId: ctx.instanceId,
      coupleId: ctx.couple.id,
      recipients: [{ to, isCouple: true }],
      sender,
    })
    if (gate.kind === 'deferred') return gate.sleep
    if (gate.kind === 'check_failed') {
      return { kind: 'error', message: `send_couple_questionnaire: ${gate.error}`, recoverable: true }
    }
    const skipped = gate.skipped(to)
    if (skipped) return { kind: 'ok', output: { skipped } }

    const title = config.title ?? template.name
    const { data: created, error } = await supabase
      .from('couple_questionnaires')
      .insert({
        user_id: ctx.userId,
        couple_id: ctx.couple.id,
        template_id: config.questionnaireTemplateId,
        title,
        questions: template.questions as Database['public']['Tables']['couple_questionnaires']['Row']['questions'],
        // Snapshot the display style with the questions.
        display_mode: template.display_mode,
        status: 'sent',
        share_token_enabled: true,
        sent_at: new Date().toISOString(),
      } as never)
      .select('id, share_token')
      .single()
    if (error || !created) return { kind: 'error', message: 'Could not create the questionnaire.' }

    const url = `${APP_URL}/questionnaire/${created.share_token}`
    const coupleName = ctx.couple.name
    const res = await gate.send({
      stepId: ctx.stepId,
      to,
      subject: `${ctx.mc.businessName} sent you a few questions`,
      render: (unsubscribeUrl) =>
        questionnaireHtml(
          { coupleName, title, shareUrl: url, mcBusinessName: ctx.mc.businessName },
          ctx.mc.branding,
          unsubscribeUrl,
        ),
      identity: { businessName: ctx.mc.businessName, branding: ctx.mc.branding },
      // Keyed on the questionnaire this send is for: its share token is
      // what the couple opens.
      fingerprint: { action: 'send_couple_questionnaire', questionnaireId: created.id, title },
    })
    if (!res.ok) {
      // Not retried. The questionnaire row already exists, so a retry
      // would create a second one; the MC can resend this one by hand
      // from the couple's profile.
      return {
        kind: 'error',
        message: `send_couple_questionnaire: the questionnaire was created but the email failed (${res.error})`,
        recoverable: false,
      }
    }

    return { kind: 'ok', output: { questionnaire_id: created.id, questionnaire_link: url } }
  },
  ui: {
    category: 'couple',
    label: 'Send questionnaire',
    description: 'Email the couple a questionnaire to fill in',
    icon: 'ClipboardList',
  },
}

/** Questionnaire action specs, keyed by type for the registry. */
export const questionnaireActions: Partial<Record<ActionType, ActionSpec<z.infer<typeof sendQuestionnaireSchema>>>> = {
  send_couple_questionnaire: sendCoupleQuestionnaire,
}
