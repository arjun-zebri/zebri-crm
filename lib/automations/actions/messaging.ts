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

import { Resend } from 'resend'
import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionType, RecipientSpec, RunContext } from '@/types/automations'

import { resolveRecipients } from '../recipients'
import { renderTemplate } from '../variables'

import type { ActionSpec } from './index'

const FROM = 'Zebri <noreply@app.zebri.com.au>'

let _resend: Resend | undefined
function resend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(key)
  }
  return _resend
}

// ────────────────────────────────────────────────────────────────
// send_email
// ────────────────────────────────────────────────────────────────

const recipientSpecSchema: z.ZodSchema<RecipientSpec> = z.object({
  roles: z.array(z.enum(['primary', 'spouse', 'family', 'vendor', 'custom', 'me'])).min(1),
  customTag: z.string().optional(),
  fallback: z.enum(['primary_only', 'skip', 'error']).default('primary_only'),
})

const sendEmailConfigSchema = z.object({
  recipients: recipientSpecSchema,
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
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

    const supabase = createAdminClient()
    const recipients = await resolveRecipients(supabase, ctx.couple, config.recipients, ctx.mc)
    if (recipients.length === 0) {
      return { kind: 'ok', output: { skipped: 'no recipients' } }
    }

    const subject = renderTemplate(config.subject, ctx)
    const bodyText = renderTemplate(config.body, ctx)
    const html = config.wrap ? wrapAutomationHtml(bodyText, ctx) : bodyText

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

    const messageIds: string[] = []
    for (const r of recipients) {
      if (!r.email) continue
      try {
        const { data, error } = await resend().emails.send({
          from: FROM,
          to: r.email,
          subject,
          html,
          replyTo: config.replyToOverride ?? ctx.mc.email,
          ...(config.bccSelf ? { bcc: ctx.mc.email } : {}),
          ...(cc ? { cc } : {}),
        })
        if (error || !data?.id) {
          // Soft fail per-recipient - record but don't kill the run.
          continue
        }
        messageIds.push(data.id)
      } catch {
        // Same - soft fail.
      }
    }

    return {
      kind: 'ok',
      output: { recipients: recipients.length, sent: messageIds.length, message_ids: messageIds },
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
