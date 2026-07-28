/**
 * "Send test to myself" server action for the template editor.
 *
 * Renders the in-progress template against the same sample context the
 * editor preview uses, wraps it in the branded shell, and emails it to
 * the **authenticated user's own address** — the recipient is read from
 * the session, never the client, so this can't be used as a relay. The
 * template doesn't need to be saved first; the editor posts its live
 * subject + body.
 *
 * Rate-limited per user (it sends real email), Zod-validated, and
 * RLS-scoped — no service role.
 *
 * @module app/(dashboard)/templates/test-send-action
 */
'use server'

import type { JSONContent } from '@tiptap/react'
import { z } from 'zod'

import { logger } from '@/lib/alerts/logger'
import { inMemoryLimiter } from '@/lib/api/rate-limit'
import { buildPublicBranding, type UserMetadata } from '@/lib/branding/public-branding'
import { sendTemplateEmail, wrapTemplateHtml } from '@/lib/email'
import { resolveSender } from '@/lib/email/sender-identity'
import { buildSampleContext } from '@/lib/email/template-variables'
import { renderEmailSubject, renderEmailTemplate } from '@/lib/email/templates'
import { createClient } from '@/lib/supabase/server'

import type { ActionResult } from './actions'

const testSendSchema = z.object({
  subject: z.string().trim().max(300).default(''),
  // TipTap JSON is structurally open; the renderer + sanitiser handle
  // the shape defensively (same stance as the save action).
  content: z.record(z.string(), z.unknown()),
})

// Test sends dispatch real email, so cap the burst per user.
const limiter = inMemoryLimiter({ windowMs: 60_000, max: 5 })

/**
 * Send the given draft template to the caller's own inbox with sample
 * data filled in and a `[Test]` subject prefix. Never logged to
 * `couple_emails` — there is no couple.
 */
export async function sendTestTemplateEmailAction(
  input: z.input<typeof testSendSchema>,
): Promise<ActionResult<{ to: string }>> {
  const parsed = testSendSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid template' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { ok: false, error: 'Not signed in' }

  const { allowed } = await limiter.check(user.id)
  if (!allowed) return { ok: false, error: 'Too many test emails — try again in a minute' }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const ctx = buildSampleContext({
    businessName: meta['business_name'] as string | undefined,
    contactName: meta['display_name'] as string | undefined,
    email: user.email,
    signature: (meta['email_signature'] as JSONContent | undefined) ?? null,
    branding: buildPublicBranding(meta as UserMetadata),
  })

  const subjectText = renderEmailSubject(parsed.data.subject, ctx, 'send')
  const { html: bodyHtml } = renderEmailTemplate(parsed.data.content as JSONContent, ctx, 'send')

  const result = await sendTemplateEmail({
    to: user.email,
    subject: `[Test] ${subjectText || 'Untitled template'}`,
    html: wrapTemplateHtml(bodyHtml, ctx.mc.businessName, ctx.mc.branding),
    sender: await resolveSender(supabase, user.id, ctx.mc.businessName),
  })

  if (!result.ok) {
    logger.error('[templates/test-send] dispatch failed', { userId: user.id, error: result.error })
    return { ok: false, error: 'Could not send the test email' }
  }
  return { ok: true, data: { to: user.email } }
}
