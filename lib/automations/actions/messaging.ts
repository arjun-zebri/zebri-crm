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
import { dispatchEmail, type EmailAttachment } from '@/lib/email/dispatch'
import { wrapAutomationShell } from '@/lib/email/html'
import { downloadStaticAttachments } from '@/lib/email/send-context'
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
  /**
   * Rich body authored in the composer modal, as a TipTap doc. Renders
   * through the same `renderEmailTemplate` path saved templates use, so
   * bold / lists / links survive to the inbox.
   */
  content: z.record(z.string(), z.unknown()).optional(),
  /**
   * Legacy plain-text body, from before the composer existed. Still
   * rendered (as text) when no `content` is present, so automations
   * saved against it keep sending exactly what they sent.
   */
  body: z.string().min(1).optional(),
  /** `email_template_files` ids to attach. */
  attachFiles: z.array(z.uuid()).optional(),
  /** Wrap the body in the standard Zebri-branded HTML shell. */
  wrap: z.boolean().default(true),
  /** Override the Reply-To header (defaults to the MC's email).
   * `''` is the chip's "added but nothing typed yet" value and means
   * unset — rejecting it would fail the whole run at send time. */
  replyToOverride: z.union([z.string().email(), z.literal('')]).optional(),
  /** CC the vendor contacts attached to this couple. */
  ccVendors: z.boolean().optional(),
  /**
   * Extra CC addresses the MC typed. `z.string()` rather than
   * `z.email()` on purpose: a config that fails to parse is a silently
   * dead automation, so anything without an `@` is dropped at send
   * time instead of rejected at load time.
   */
  ccEmails: z.array(z.string()).optional(),
  /** BCC the MC so they retain a paper trail. */
  bccSelf: z.boolean().optional(),
  /** Extra BCC addresses, same handling as {@link ccEmails}. */
  bccEmails: z.array(z.string()).optional(),
  // ── Deferred fields ────────────────────────────────────────────
  // Accepted so previously saved configs keep parsing, but the
  // handler ignores them and the inspector no longer offers them:
  //   - attachQuote/Contract/Invoice/RunSheet need those documents
  //     rendered to PDF first (static file attachments are wired —
  //     see `attachFiles` above)
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
    } else if (config.content) {
      // Composer body. Same render + missing-variable guard as the
      // template path, so an unresolvable {{couple.x}} pauses the run
      // instead of mailing a literal placeholder to the couple.
      const doc = config.content as JSONContent
      const rawSubject = config.subject ?? ''
      const missing = detectMissingVariables({ subject: rawSubject, content: doc }, ctx)
      if (missing.blocked) {
        return {
          kind: 'sleep',
          reason: 'missing_variables',
          wakeAt: '9999-12-31T00:00:00.000Z',
          payload: { missing: missing.missing, couple_name: ctx.couple.name },
        }
      }
      subject = renderEmailSubject(rawSubject, ctx, 'send')
      const rendered = renderEmailTemplate(doc, ctx, 'send').html
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

    // Static attachments resolve once for every recipient. A file the
    // MC has since deleted is skipped by the loader rather than
    // failing the send — a missing PDF should not stop the email.
    let attachments: EmailAttachment[] = []
    if (config.attachFiles?.length && supabase) {
      attachments = await downloadStaticAttachments(supabase, config.attachFiles)
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
        ...(attachments.length ? { attachments } : {}),
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
    // Anyone already addressed directly is dropped so nobody gets the
    // same email twice.
    let cc: string[] | undefined
    const ccCandidates: string[] = []
    if (config.ccVendors) {
      const vendors = await resolveRecipients(supabase, ctx.couple, {
        roles: ['vendor'],
        fallback: 'skip',
      })
      for (const v of vendors) if (v.email) ccCandidates.push(v.email)
    }
    // Typed addresses: anything without an `@` is a half-finished
    // entry, not a recipient, so it is dropped rather than sent to.
    for (const raw of config.ccEmails ?? []) {
      const trimmed = raw.trim()
      if (trimmed.includes('@')) ccCandidates.push(trimmed)
    }
    if (ccCandidates.length > 0) {
      const direct = new Set(recipients.map((r) => r.email?.toLowerCase()).filter(Boolean))
      const seen = new Set<string>()
      const ccList = ccCandidates.filter((e) => {
        const key = e.toLowerCase()
        if (direct.has(key) || seen.has(key)) return false
        seen.add(key)
        return true
      })
      if (ccList.length > 0) cc = ccList
    }

    const addressable = recipients.filter((r) => r.email)
    if (addressable.length === 0) {
      return { kind: 'ok', output: { skipped: 'no addressable recipients' } }
    }

    const messageIds: string[] = []
    let lastError: string | null = null
    const replyTo = config.replyToOverride || ctx.mc.email
    // BCC: the MC's own address plus anything they typed, deduped.
    const bcc = [
      ...new Set(
        [
          ...(config.bccSelf && ctx.mc.email ? [ctx.mc.email] : []),
          ...(config.bccEmails ?? []).map((e) => e.trim()).filter((e) => e.includes('@')),
        ].map((e) => e),
      ),
    ]
    for (const r of addressable) {
      const res = await dispatchEmail(sender, {
        to: r.email!,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
        ...(bcc.length ? { bcc } : {}),
        ...(cc ? { cc } : {}),
        ...(attachments.length ? { attachments } : {}),
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


export const messagingActions: Partial<Record<ActionType, ActionSpec<any>>> = {
  send_email: sendEmail,
  send_sms: sendSms,
  send_whatsapp: sendWhatsApp,
}

/**
 * The plain-text automation shell, addressed by run context.
 *
 * A thin wrapper over {@link wrapAutomationShell}: the builder is
 * pure and lives in `lib/email/html` so the in-app preview can import
 * it without dragging Resend into the browser bundle, and every
 * handler here already has a context rather than a bare name.
 */
export function wrapAutomationHtml(body: string, ctx: RunContext): string {
  return wrapAutomationShell(body, ctx.mc.businessName)
}
