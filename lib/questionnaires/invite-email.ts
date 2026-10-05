/**
 * The email a questionnaire is sent with, when the MC picked one of
 * their own email templates for it (`questionnaire_templates.email_template_id`).
 *
 * Shared by the three senders: the couple profile's Send and Resend
 * buttons, and the workflow "Send questionnaire" step. Each one falls
 * back to the standard questionnaire email whenever this returns null, so
 * a questionnaire never fails to go out because of its email.
 *
 * @module lib/questionnaires/invite-email
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { JSONContent } from '@tiptap/react'

import { renderSendEmail } from '@/lib/email/send-email-render'
import type { RunContext } from '@/types/automations'
import type { Database } from '@/types/database'

/** A saved email template, ready to render. */
export interface InviteTemplate {
  subject: string
  content: JSONContent
}

/** The rendered email. `renderHtml` takes the unsubscribe URL, or null for a manual send. */
export interface RenderedInvite {
  subject: string
  renderHtml: (unsubscribeUrl: string | null) => string
}

/**
 * The email template chosen on a questionnaire template, or null for the
 * standard email.
 *
 * Both reads are scoped to `userId`, the questionnaire's owner, so even a
 * row pointing at another account's email template (the write policy
 * blocks that, this is the second lock) can never send it. An archived
 * template also counts as none: the MC put it away.
 */
export async function loadInviteTemplate(
  db: SupabaseClient<Database>,
  userId: string,
  questionnaireTemplateId: string | null,
): Promise<InviteTemplate | null> {
  if (!questionnaireTemplateId) return null
  const { data: questionnaire } = await db
    .from('questionnaire_templates')
    .select('email_template_id')
    .eq('id', questionnaireTemplateId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!questionnaire?.email_template_id) return null

  const { data: email } = await db
    .from('email_templates')
    .select('subject, content, archived_at')
    .eq('id', questionnaire.email_template_id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!email || email.archived_at) return null
  return { subject: email.subject, content: email.content as JSONContent }
}

/**
 * A copy of the context that knows about the questionnaire being sent, so
 * `{{questionnaire.link}}` and `{{questionnaire.title}}` resolve. The row
 * is created moments before the email, so no context has it yet.
 */
export function withQuestionnaire(
  ctx: RunContext,
  questionnaire: { id: string; link: string; title: string },
): RunContext {
  const payload = (ctx.triggerEvent.payload as Record<string, unknown> | null) ?? {}
  return {
    ...ctx,
    triggerEvent: {
      ...ctx.triggerEvent,
      payload: {
        ...payload,
        questionnaire_id: questionnaire.id,
        questionnaire_link: questionnaire.link,
        questionnaire_title: questionnaire.title,
      },
    },
  }
}

/**
 * Whether the template links to the questionnaire at all. An email
 * without the link would reach the couple with no way to open the
 * questionnaire, so one is never sent; the standard email goes instead.
 * The body is TipTap JSON whose variable chips carry the expression as
 * their id, so a text search over the serialised doc finds chips and
 * typed `{{questionnaire.link}}` alike.
 */
export function linksToQuestionnaire(template: InviteTemplate): boolean {
  return `${template.subject} ${JSON.stringify(template.content)}`.includes('questionnaire.link')
}

/**
 * Render the chosen template in the MC's branded shell. Null when it has
 * no questionnaire link, or a variable it cannot do without has no value
 * for this couple; the caller then sends the standard email instead.
 */
export function renderInvite(template: InviteTemplate, ctx: RunContext): RenderedInvite | null {
  if (!linksToQuestionnaire(template)) return null
  const rendered = renderSendEmail({ kind: 'doc', subject: template.subject, content: template.content }, ctx, true)
  if (rendered.blocked) return null
  return { subject: rendered.subject, renderHtml: rendered.renderHtml }
}
