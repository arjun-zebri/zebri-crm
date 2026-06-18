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
  const { coupleId, templateId, inlineSubject, inlineBody, overrides, sendAnyway, attachmentFileIds } = parsed.data

  const ctx = await buildManualSendContext(supabase, coupleId)
  if (!ctx || !ctx.couple) return NextResponse.json({ error: 'Couple not found' }, { status: 404 })
  if (!ctx.couple.email) {
    return NextResponse.json(
      { error: 'No email on file for this couple — add one in their profile' },
      { status: 400 },
    )
  }

  // Resolve the authoritative subject + body. A saved template is
  // re-read server-side (RLS-scoped); inline content is taken as-is and
  // sanitised by the renderer.
  let subject = inlineSubject ?? ''
  let content: JSONContent = (inlineBody ?? {}) as JSONContent
  if (templateId) {
    const { data: tpl, error } = await supabase
      .from('email_templates')
      .select('subject, content')
      .eq('id', templateId)
      .single()
    if (error || !tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    subject = tpl.subject
    content = (tpl.content ?? {}) as JSONContent
  }

  // The gate: never send with a missing variable unless explicitly told.
  const missing = detectMissingVariables({ subject, content }, ctx, overrides)
  if (missing.blocked && !sendAnyway) {
    return NextResponse.json(
      { error: missing.message, missing: missing.missing, blocked: true },
      { status: 422 },
    )
  }

  const renderedSubject = renderEmailSubject(subject, ctx, 'send', overrides)
  const { html } = renderEmailTemplate(content, ctx, 'send', overrides)
  const attachments = await downloadStaticAttachments(supabase, attachmentFileIds)

  const result = await sendTemplateEmail({
    to: ctx.couple.email,
    subject: renderedSubject || `A message from ${ctx.mc.businessName}`,
    html: wrapTemplateHtml(html, ctx.mc.businessName),
    replyTo: ctx.mc.email,
    ...(attachments.length ? { attachments } : {}),
  })

  if (!result.ok) {
    logger.error('[email/send-template] resend failed', { userId: user.id, coupleId, error: result.error })
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, messageId: result.messageId })
}
