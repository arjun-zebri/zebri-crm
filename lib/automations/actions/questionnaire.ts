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

import { sendQuestionnaireEmail } from '@/lib/email'
import { resolveSender } from '@/lib/email/sender-identity'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionType } from '@/types/automations'
import type { Database } from '@/types/database'

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
    await sendQuestionnaireEmail({
      coupleEmail: ctx.couple.email,
      coupleName: ctx.couple.name,
      title,
      shareUrl: url,
      mcBusinessName: ctx.mc.businessName,
      sender: await resolveSender(supabase, ctx.userId, ctx.mc.businessName),
    })

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
