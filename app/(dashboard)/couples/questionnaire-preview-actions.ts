/**
 * Server action behind the couple profile's questionnaire Send preview.
 *
 * Renders exactly what `sendCoupleQuestionnaireAction` would send to this
 * couple: the title and questions with their names filled in, and the
 * email (the MC's chosen template, or the standard one) with a stand-in
 * link, since the real link only exists once the row is created.
 *
 * @module app/(dashboard)/couples/questionnaire-preview-actions
 */
'use server'

import { z } from 'zod'

import { buildManualSendContext } from '@/lib/email/send-context'
import {
  linksToQuestionnaire,
  loadInviteTemplate,
  renderInvite,
  withQuestionnaire,
} from '@/lib/questionnaires/invite-email'
import type { Question } from '@/lib/questionnaires/question-schema'
import { personalizeQuestionnaire } from '@/lib/questionnaires/variables'
import { createClient } from '@/lib/supabase/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zebri.com.au'

const inputSchema = z.object({ coupleId: z.uuid(), templateId: z.uuid() })

/**
 * Which email the send will use. `standard`: none chosen.
 * `chosen`: the MC's template. `no_link` / `unfilled`: one is chosen but
 * cannot be used for this couple (no questionnaire link in it, or a
 * variable it needs has no value), so the standard email goes instead.
 */
export type InviteEmailState = 'standard' | 'chosen' | 'no_link' | 'unfilled'

/** What the couple would get. `email` is null when the standard email goes. */
export interface QuestionnaireSendPreviewData {
  title: string
  questions: Question[]
  email: { subject: string; html: string } | null
  emailState: InviteEmailState
}

/** Preview a questionnaire send for one couple. Read-only. */
export async function previewCoupleQuestionnaireAction(
  input: z.infer<typeof inputSchema>,
): Promise<{ ok: true; data: QuestionnaireSendPreviewData } | { ok: false; error: string }> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid request.' }
  const { coupleId, templateId } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data: template } = await supabase
    .from('questionnaire_templates')
    .select('name, description, questions')
    .eq('id', templateId)
    .single()
  if (!template) return { ok: false, error: 'Questionnaire template not found.' }

  const ctx = await buildManualSendContext(supabase, coupleId)
  if (!ctx) return { ok: false, error: 'Couple not found.' }

  const text = personalizeQuestionnaire(
    { title: template.name, description: template.description, questions: template.questions as unknown as Question[] },
    ctx,
  )

  const invite = await loadInviteTemplate(supabase, user.id, templateId)
  let email: QuestionnaireSendPreviewData['email'] = null
  let emailState: InviteEmailState = 'standard'
  if (invite) {
    const rendered = renderInvite(
      invite,
      withQuestionnaire(ctx, { id: 'preview', link: `${APP_URL}/questionnaire/preview`, title: text.title }),
    )
    if (rendered) {
      email = { subject: rendered.subject, html: rendered.renderHtml(null) }
      emailState = 'chosen'
    } else {
      emailState = linksToQuestionnaire(invite) ? 'unfilled' : 'no_link'
    }
  }

  return { ok: true, data: { title: text.title, questions: text.questions, email, emailState } }
}
