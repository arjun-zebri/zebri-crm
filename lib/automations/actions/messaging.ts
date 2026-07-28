/**
 * Messaging actions: send_email, send_sms, send_whatsapp.
 *
 * `send_email` is the workhorse - it composes a template (subject
 * + body) against the variable resolver, resolves recipients via
 * the recipient resolver, and dispatches one Resend message per
 * recipient. SMS + WhatsApp are 14b deferred stubs.
 *
 * @module lib/automations/actions/messaging
 */

import type { JSONContent } from '@tiptap/react'
import { z } from 'zod'

import { wrapTemplateHtml } from '@/lib/email'
import { dispatchEmail } from '@/lib/email/dispatch'
import { DEFAULT_FROM, resolveSender, type ResolvedSender } from '@/lib/email/sender-identity'
import {
  detectMissingVariables,
  renderEmailSubject,
  renderEmailTemplate,
} from '@/lib/email/templates'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult, ActionType, RecipientSpec, RunContext } from '@/types/automations'

import { resolveRecipients } from '../recipients'
import { renderTemplate } from '../variables'

import type { ActionSpec } from './index'

// ────────────────────────────────────────────────────────────────
// send_email
// ────────────────────────────────────────────────────────────────

/**
 * Load a saved email template's subject + body for the send_email
 * action. Uses the admin client (the runner has no user session) but
 * scopes the read to the run's owner so it can't reach another tenant.
 */
async function loadTemplateParts(
  ctx: RunContext,
  templateId: string,
): Promise<{ kind: 'ok'; tplSubject: string; tplContent: JSONContent } | Extract<ActionResult, { kind: 'error' }>> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_templates')
    .select('subject, content')
    .eq('id', templateId)
    .eq('user_id', ctx.userId)
    .single()
  if (error || !data) {
    return { kind: 'error', message: 'send_email: email template not found', recoverable: false }
  }
  return { kind: 'ok', tplSubject: data.subject, tplContent: (data.content ?? {}) as JSONContent }
}

const recipientSpecSchema: z.ZodSchema<RecipientSpec> = z.object({
  roles: z.array(z.enum(['primary', 'spouse', 'family', 'vendor', 'custom', 'me'])).min(1),
  customTag: z.string().optional(),
  fallback: z.enum(['primary_only', 'skip', 'error']).default('primary_only'),
})

const sendEmailConfigSchema = z.object({
  recipients: recipientSpecSchema,
  /**
   * Use a saved email template instead of an inline subject/body. When
   * set, the template's subject + TipTap body are rendered and the
   * run is BLOCKED (paused) if any variable can't be resolved.
   */
  templateId: z.uuid().optional(),
  // Inline subject/body — optional now that a template can supply them.
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
  /** Wrap the body in the standard Zebri-branded HTML shell. */
  wrap: z.boolean().default(true),
  /** Override the Reply-To header (defaults to the MC's email). */
  replyToOverride: z.string().email().optional(),
  /** CC every vendor contact attached to the couple. */
  ccVendors: z.boolean().optional(),
  /** BCC the MC so they retain a paper trail. */
  bccSelf: z.boolean().optional(),
  // ── Deferred fields ────────────────────────────────────────────
  // Accepted so previously saved configs keep parsing, but the
  // handler ignores them and the inspector no longer offers them:
  //   - attach* needs PDF generation plumbed into Resend attachments
  //   - respectQuietHours only exists at the `wait` action level
  //   - respectCoupleDoNotEmail needs a couples.do_not_email column
  //   - previewBeforeSend duplicates the Approval-gate action
  //   - trackOpens has no per-send toggle in the Resend API
  //   - sendAt: a fixed datetime is wrong for recurring automations;
  //     use a `wait` action before the send instead
  attachQuote: z.boolean().optional(),
  attachContract: z.boolean().optional(),
  attachInvoice: z.boolean().optional(),
  attachRunSheet: z.boolean().optional(),
  attachFiles: z.array(z.string()).optional(),
  respectQuietHours: z.boolean().optional(),
  respectCoupleDoNotEmail: z.boolean().optional(),
  previewBeforeSend: z.boolean().optional(),
  trackOpens: z.boolean().optional(),
  sendAt: z.string().optional(),
}).passthrough()

const sendEmail: ActionSpec<z.infer<typeof sendEmailConfigSchema>> = {
  type: 'send_email',
  configSchema: sendEmailConfigSchema,
  async handler(ctx, config) {
    if (!ctx.couple) {
      return { kind: 'error', message: 'send_email requires a couple context' }
    }

    // Resolve subject + body. The template path enforces the
    // never-send-with-missing-variables rule: if any variable is
    // unresolved the action returns a `missing_variables` sleep, which
    // the runner turns into a paused run + Slack alert.
    let subject: string
    let html: string
    if (config.templateId) {
      const tplResult = await loadTemplateParts(ctx, config.templateId)
      if (tplResult.kind === 'error') return tplResult
      const { tplSubject, tplContent } = tplResult
      const missing = detectMissingVariables({ subject: tplSubject, content: tplContent }, ctx)
      if (missing.blocked) {
        return {
          kind: 'sleep',
          reason: 'missing_variables',
          // Far-future so wakeDueWaits never auto-resumes; the run is
          // paused and an MC retries it manually after fixing the data.
          wakeAt: '9999-12-31T00:00:00.000Z',
          payload: { missing: missing.missing, couple_name: ctx.couple.name },
        }
      }
      subject = renderEmailSubject(tplSubject, ctx, 'send')
      const rendered = renderEmailTemplate(tplContent, ctx, 'send').html
      html = config.wrap ? wrapTemplateHtml(rendered, ctx.mc.businessName, ctx.mc.branding) : rendered
    } else {
      subject = renderTemplate(config.subject ?? '', ctx)
      const bodyText = renderTemplate(config.body ?? '', ctx)
      html = config.wrap ? wrapAutomationHtml(bodyText, ctx) : bodyText
    }

    // Resolve the sender once: a connected SMTP mailbox (Settings →
    // Public Page → Email) sends through the MC's own inbox, otherwise the
    // shared Zebri address. Uses the admin client because automations run
    // without a user session; the same client is reused for recipients.
    // A missing service-role config (degraded env) falls back to the shared
    // Zebri address rather than failing the send.
    let supabase: ReturnType<typeof createAdminClient> | null = null
    let sender: ResolvedSender = { transport: 'resend', from: DEFAULT_FROM }
    try {
      supabase = createAdminClient()
      sender = await resolveSender(supabase, ctx.userId, ctx.mc.businessName)
    } catch {
      sender = { transport: 'resend', from: DEFAULT_FROM }
    }

    // Test run (manual "Test automation"): route the rendered email to
    // the MC instead of the couple, so they preview exactly what would
    // go out without ever contacting the couple. The subject is tagged
    // and we never resolve the couple's recipients in this path.
    const payload = ctx.triggerEvent.payload as Record<string, unknown> | null
    if (payload?.['test_mode']) {
      if (!ctx.mc.email) {
        return { kind: 'ok', output: { skipped: 'no MC email for test send' } }
      }
      const res = await dispatchEmail(sender, {
        to: ctx.mc.email,
        subject: `[Test] ${subject}`,
        html,
        replyTo: ctx.mc.email,
      })
      if (!res.ok || !res.messageId) {
        return { kind: 'error', message: `send_email (test): ${res.error ?? 'no message id'}` }
      }
      return { kind: 'ok', output: { test: true, sent_to_mc: ctx.mc.email, message_id: res.messageId } }
    }

    // The non-test path resolves the couple's recipients, which needs the
    // admin client; if it couldn't be built we can't proceed.
    if (!supabase) {
      return { kind: 'error', message: 'send_email: admin client unavailable' }
    }

    const recipients = await resolveRecipients(supabase, ctx.couple, config.recipients, ctx.mc)
    if (recipients.length === 0) {
      return { kind: 'ok', output: { skipped: 'no recipients' } }
    }

    // CC list resolves once and applies to every outgoing message.
    // Vendors already addressed directly are dropped so nobody gets
    // the same email twice.
    let cc: string[] | undefined
    if (config.ccVendors) {
      const vendors = await resolveRecipients(supabase, ctx.couple, {
        roles: ['vendor'],
        fallback: 'skip',
      })
      const direct = new Set(
        recipients.map((r) => r.email?.toLowerCase()).filter(Boolean),
      )
      const ccList = [
        ...new Set(
          vendors
            .map((v) => v.email)
            .filter((e): e is string => !!e && !direct.has(e.toLowerCase())),
        ),
      ]
      if (ccList.length > 0) cc = ccList
    }

    const addressable = recipients.filter((r) => r.email)
    if (addressable.length === 0) {
      return { kind: 'ok', output: { skipped: 'no addressable recipients' } }
    }

    const messageIds: string[] = []
    let lastError: string | null = null
    const replyTo = config.replyToOverride ?? ctx.mc.email
    for (const r of addressable) {
      const res = await dispatchEmail(sender, {
        to: r.email!,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
        ...(config.bccSelf && ctx.mc.email ? { bcc: ctx.mc.email } : {}),
        ...(cc ? { cc } : {}),
      })
      if (!res.ok || !res.messageId) {
        lastError = res.error ?? 'Send returned no message id'
        continue
      }
      messageIds.push(res.messageId)
    }

    const sent = messageIds.length
    const failed = addressable.length - sent

    // Total failure: nothing went out. Surface it so the runner
    // errors the run + fires the automation_failed Slack alert —
    // otherwise a misconfigured sender (unverified domain, dead key)
    // silently no-ops every send and the MC never knows.
    if (sent === 0) {
      return {
        kind: 'error',
        message: `send_email: all ${failed} recipient(s) failed${
          lastError ? ` — ${lastError}` : ''
        }`,
      }
    }

    // Partial failure: some emails already went out, so erroring (and
    // re-running) would double-send the successful ones. Stay ok but
    // record the failure count + reason in the run output.
    return {
      kind: 'ok',
      output: {
        recipients: addressable.length,
        sent,
        failed,
        message_ids: messageIds,
        ...(failed > 0 && lastError ? { last_error: lastError } : {}),
      },
    }
  },
  ui: {
    category: 'general',
    label: 'Send email',
    description: 'Send a custom email with variables',
    icon: 'Mail',
    defaultLabel: 'Send email',
  },
}

// ────────────────────────────────────────────────────────────────
// send_sms / send_whatsapp - 14b deferred
// ────────────────────────────────────────────────────────────────

const deferredConfigSchema = z.object({
  recipients: recipientSpecSchema,
  body: z.string().min(1),
  /** Defer the send into the next allowed window. */
  respectQuietHours: z.boolean().optional(),
  /** Custom sender ID (SMS only; some carriers honour). */
  senderId: z.string().optional(),
  /** Hard-cap the body length (most carriers split at 160). */
  truncateAt: z.number().int().min(50).max(1600).optional(),
  /** WhatsApp media attachment URL. */
  mediaUrl: z.string().url().optional(),
  /** WhatsApp approved-template ID (required for non-session messages). */
  templateId: z.string().optional(),
}).passthrough()

const sendSms: ActionSpec<z.infer<typeof deferredConfigSchema>> = {
  type: 'send_sms',
  configSchema: deferredConfigSchema,
  async handler() {
    return { kind: 'error', message: 'SMS sending is not yet enabled - connect your Twilio account in Settings', recoverable: false }
  },
  ui: {
    category: 'general',
    label: 'Send SMS',
    description: 'Send a text message (coming soon - needs Twilio)',
    icon: 'MessageSquare',
    comingSoon: true,
  },
}

const sendWhatsApp: ActionSpec<z.infer<typeof deferredConfigSchema>> = {
  type: 'send_whatsapp',
  configSchema: deferredConfigSchema,
  async handler() {
    return { kind: 'error', message: 'WhatsApp sending is not yet enabled - connect your Twilio account in Settings', recoverable: false }
  },
  ui: {
    category: 'general',
    label: 'Send WhatsApp',
    description: 'Send a WhatsApp message (coming soon)',
    icon: 'MessageCircle',
    comingSoon: true,
  },
}

/**
 * Wraps a plain-text body (with `{{variables}}` already resolved)
 * in the standard Zebri-branded HTML shell so automation emails
 * match the look of system emails. Bodies preserve newlines.
 */
export function wrapAutomationHtml(body: string, ctx: RunContext): string {
  const safe = escapeHtml(body).replace(/\n/g, '<br>')
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="padding:40px;font-size:15px;color:#374151;line-height:1.6;">${safe}</td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Sent by ${escapeHtml(ctx.mc.businessName)} via Zebri</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const messagingActions: Partial<Record<ActionType, ActionSpec<any>>> = {
  send_email: sendEmail,
  send_sms: sendSms,
  send_whatsapp: sendWhatsApp,
}
