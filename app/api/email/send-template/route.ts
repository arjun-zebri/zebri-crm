/**
 * Send a template (or inline) email to a couple — the manual compose
 * flow.
 *
 * POST `/api/email/send-template`. Hardened like the other email
 * routes:
 * - **Zod-validated body**; anything else → 400.
 * - **Rate-limited** 5/min/user (`EMAIL_RATE_LIMITS.sendTemplate`).
 * - **RLS-scoped** server client throughout; the template + couple are
 *   re-loaded server-side so a forged id can't reach another tenant.
 *
 * The defining guarantee lives here: the body is re-checked against
 * {@link detectMissingVariables} server-side and the send is **blocked**
 * (422) when a variable is missing, unless the MC passed `sendAnyway`.
 * The client cannot bypass this by tampering with its own preview.
 *
 * @module app/api/email/send-template/route
 */
import type { JSONContent } from '@tiptap/react'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { sendAlert } from '@/lib/alerts'
import { logger } from '@/lib/alerts/logger'
import { EMAIL_RATE_LIMITS, inMemoryLimiter, ipOf } from '@/lib/api/rate-limit'
import { parseJsonBody } from '@/lib/api/validate'
import { sendTemplateEmail, wrapTemplateHtml } from '@/lib/email'
import { buildManualSendContext, downloadStaticAttachments } from '@/lib/email/send-context'
import { resolveSender } from '@/lib/email/sender-identity'
import {
  detectMissingVariables,
  renderEmailSubject,
  renderEmailTemplate,
} from '@/lib/email/templates'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z
  .object({
    coupleId: z.uuid(),
    templateId: z.uuid().optional(),
    inlineSubject: z.string().max(300).optional(),
    inlineBody: z.record(z.string(), z.unknown()).optional(),
    overrides: z.record(z.string(), z.string()).default({}),
    sendAnyway: z.boolean().default(false),
    // Test send: deliver to the MC's own inbox (not the couple), bypass
    // the missing-variable block, and don't log to the couple's history.
    test: z.boolean().default(false),
    attachmentFileIds: z.array(z.uuid()).max(10).default([]),
  })
  // Either a saved template or an inline body must be supplied.
  .refine((b) => b.templateId || b.inlineBody, {
    message: 'Provide a templateId or an inline body.',
  })

const limiter = inMemoryLimiter(EMAIL_RATE_LIMITS.sendTemplate)

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, retryAfter } = await limiter.check(`sendTemplate:${user.id}`)
  if (!allowed) {
    await sendAlert({
      type: 'email_rate_limit_hit',
      severity: 'warn',
      action: 'sendTemplate',
      userId: user.id,
      ip: ipOf(request),
    })
    return NextResponse.json(
      { error: 'Too many emails sent recently. Try again in a moment.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfter / 1000)) } },
    )
  }

  const parsed = await parseJsonBody(request, bodySchema)
  if (!parsed.ok) return parsed.response
  const { coupleId, templateId, inlineSubject, inlineBody, overrides, sendAnyway, test, attachmentFileIds } = parsed.data

  const ctx = await buildManualSendContext(supabase, coupleId)
  if (!ctx || !ctx.couple) return NextResponse.json({ error: 'Couple not found' }, { status: 404 })
  // A test send goes to the MC's own inbox; a real send goes to the couple.
  const recipient = test ? ctx.mc.email : ctx.couple.email
  if (!recipient) {
    return NextResponse.json(
      { error: test ? 'No email on file for your account.' : 'No email on file for this couple — add one in their profile' },
      { status: 400 },
    )
  }

  // Resolve the authoritative subject + body. A saved template is
  // re-read server-side (RLS-scoped) for its name + a fallback body.
  // When the caller supplies inline content (the MC's edited preview),
  // that wins — what they saw is what goes out — and the template id is
  // kept only so the send is still logged under the template's name.
  let subject = inlineSubject ?? ''
  let content: JSONContent = (inlineBody ?? {}) as JSONContent
  let templateName: string | null = null
  if (templateId) {
    const { data: tpl, error } = await supabase
      .from('email_templates')
      .select('name, subject, content')
      .eq('id', templateId)
      .single()
    if (error || !tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    templateName = tpl.name
    if (inlineSubject === undefined) subject = tpl.subject
    if (inlineBody === undefined) content = (tpl.content ?? {}) as JSONContent
  }

  // The gate: never send with a missing variable unless explicitly told.
  // A test send bypasses it — the MC is previewing in their own inbox.
  const missing = detectMissingVariables({ subject, content }, ctx, overrides)
  if (missing.blocked && !sendAnyway && !test) {
    return NextResponse.json(
      { error: missing.message, missing: missing.missing, blocked: true },
      { status: 422 },
    )
  }

  const renderedSubject = renderEmailSubject(subject, ctx, 'send', overrides)
  const { html } = renderEmailTemplate(content, ctx, 'send', overrides)
  const attachments = await downloadStaticAttachments(supabase, attachmentFileIds)

  const finalSubject = renderedSubject || `A message from ${ctx.mc.businessName}`
  const result = await sendTemplateEmail({
    to: recipient,
    subject: test ? `[Test] ${finalSubject}` : finalSubject,
    html: wrapTemplateHtml(html, ctx.mc.businessName),
    sender: await resolveSender(supabase, user.id, ctx.mc.businessName),
    replyTo: ctx.mc.email,
    ...(attachments.length ? { attachments } : {}),
  })

  if (!result.ok) {
    logger.error('[email/send-template] resend failed', { userId: user.id, coupleId, error: result.error })
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }

  // Log real sends for the couple's Templates-tab history. Test sends go
  // to the MC's own inbox and are deliberately not logged. Best-effort —
  // a logging failure must not fail an email that actually went out.
  if (!test) {
    const { error: logError } = await supabase.from('couple_emails').insert({
      user_id: user.id,
      couple_id: coupleId,
      template_id: templateId ?? null,
      template_name: templateName,
      subject: finalSubject,
      to_email: recipient,
      source: 'manual',
      status: 'sent',
    })
    if (logError) logger.error('[email/send-template] couple_emails log failed', { userId: user.id, coupleId, error: logError })
  }

  return NextResponse.json({ ok: true, messageId: result.messageId })
}
