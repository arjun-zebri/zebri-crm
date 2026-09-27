/**
 * Messaging actions: send_email, send_sms, send_whatsapp.
 *
 * `send_email` is the workhorse - it composes a template (subject
 * + body) against the variable resolver, resolves recipients via
 * the recipient resolver, and dispatches one Resend message per
 * recipient. Every message it dispatches is logged to `couple_emails`
 * (Task 30) once the transport has answered. SMS + WhatsApp are 14b
 * deferred stubs.
 *
 * @module lib/automations/actions/messaging
 */

import type { JSONContent } from '@tiptap/react'
import { z } from 'zod'

import { sendAlert } from '@/lib/alerts'
import { logger } from '@/lib/alerts/logger'
import {
  accountPausedSleep,
  buildUnsubscribeLinks,
  enforceWorkflowSendLimit,
} from '@/lib/email/automation-send'
import { isTransactionalSend } from '@/lib/email/commercial-classification'
import {
  AUTOMATED_TAG,
  dispatchEmail,
  MC_COPY_TAG_NAME,
  transportDeduplicates,
  type EmailAttachment,
  type DispatchPayload,
} from '@/lib/email/dispatch'
import { contentFingerprint, sendIdempotencyKey } from '@/lib/email/idempotency'
import { alertPartialSendFailure } from '@/lib/email/partial-send-alert'
import { downloadStaticAttachments, templateFileIds as loadTemplateFileIds } from '@/lib/email/send-context'
import {
  copiesFor,
  gateOptOuts,
  planRecipients,
  resolveCopyCandidates,
  sendAttachmentIds,
  sendReplyTo,
} from '@/lib/email/send-email-plan'
import {
  recipientCopyHtml,
  renderSendEmail,
  selectSendEmailSource,
} from '@/lib/email/send-email-render'
import { logAutomatedSend, transportOf } from '@/lib/email/send-log'
import { DEFAULT_FROM, type ResolvedSender } from '@/lib/email/sender-identity'
import { createAdminClient } from '@/lib/supabase/admin'
import { readAccountPause } from '@/lib/workflows/account-pause'
import type {
  ActionResult,
  ActionType,
  RecipientSpec,
  RunContext,
} from '@/types/automations'

import { resolveRecipients } from '../recipients'

import { resolveStepSender, type StepSender } from './step-sender'

import type { ActionSpec } from './index'

// ────────────────────────────────────────────────────────────────
// send_email
// ────────────────────────────────────────────────────────────────

/**
 * Load a saved email template's subject, body, and linked file IDs for
 * the send_email action. Uses the admin client (the runner has no user
 * session) but scopes all reads to the run's owner so it can't reach
 * another tenant.
 *
 * Why: return the template file ids so the handler can download them
 * alongside any config.attachFiles, deduplicated by file id.
 */
async function loadTemplateParts(
  ctx: RunContext,
  templateId: string,
): Promise<
  | { kind: 'ok'; tplSubject: string; tplContent: JSONContent; templateFileIds: string[] }
  | Extract<ActionResult, { kind: 'error' }>
> {
  const admin = createAdminClient()
  // `maybeSingle`, not `single`: the two outcomes have to be told apart
  // now that the executor honours `recoverable`. `single` reports "no
  // rows" as an error, so a template the MC deleted and a database that
  // was briefly unreachable arrived here as the same value, and burying
  // both would mean one bad second on the network ends a workflow that a
  // retry would have carried. `maybeSingle` gives back a null row for
  // the first and an error only for the second.
  const { data, error } = await admin
    .from('email_templates')
    .select('subject, content')
    .eq('id', templateId)
    .eq('user_id', ctx.userId)
    .maybeSingle()
  if (error) {
    // A failed read says nothing about the template. Retryable, and
    // explicitly so rather than by omission.
    return {
      kind: 'error',
      message: `send_email: could not read the email template (${error.message})`,
      recoverable: true,
    }
  }
  if (!data) {
    // Genuinely gone, or owned by somebody else. Repeating the read
    // cannot change that, so it is the MC's to fix.
    return { kind: 'error', message: 'send_email: email template not found', recoverable: false }
  }

  // Fetch file ids linked to this template via email_template_files.
  // Unreadable files (deleted by the user) are skipped by the loader
  // later rather than failing the send, so we only care about the ids.
  return {
    kind: 'ok',
    tplSubject: data.subject,
    tplContent: (data.content ?? {}) as JSONContent,
    templateFileIds: await loadTemplateFileIds(admin, templateId, ctx.userId),
  }
}

const recipientSpecSchema: z.ZodSchema<RecipientSpec> = z.object({
  roles: z.array(z.enum(['primary', 'spouse', 'family', 'vendor', 'custom', 'me'])).min(1),
  customTag: z.string().optional(),
  fallback: z.enum(['primary_only', 'skip', 'error']).default('primary_only'),
})

/**
 * The `send_email` config, as the handler parses it. Exported so the
 * step envelope (`lib/workflows/send-envelope`) reads a step exactly the
 * way the send does, defaults included (`wrap`, the recipient fallback).
 */
export const sendEmailConfigSchema = z.object({
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
  //   - respectCoupleDoNotEmail is obsolete rather than deferred: the
  //     couple's opt-out is now honoured on every automated send (see
  //     COUPLE_OWN_ROLES in lib/email/send-email-plan), so there is nothing for a per-step
  //     toggle to turn off
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

/**
 * This send's fingerprint, for the idempotency key.
 *
 * Wraps the shared {@link contentFingerprint} with the exact set of
 * fields a `send_email` recipient can tell apart, in a fixed key order
 * (the order is part of the hash).
 *
 * The fields beyond subject and body (`wrap`, attachments, reply-to,
 * cc, bcc) are not "content" in the wording sense, but they are all
 * fields Resend keys the whole call by. If an MC flips one of them and
 * retries, the earlier response would be replayed under the old key and
 * the change silently dropped: a swallowed correction, triggered by a
 * config edit instead of a wording edit. `wrap` decides whether the
 * branded shell renders at all, which is as recipient-visible as the
 * words in the body.
 *
 * See {@link contentFingerprint} for why this takes the configured
 * subject and body rather than the rendered output.
 */
function sendEmailFingerprint(parts: {
  subjectTemplate: string
  bodyTemplate: unknown
  wrap: boolean
  attachmentIds: string[]
  replyTo: string
  cc: string[] | undefined
  bcc: string[]
}): string {
  return contentFingerprint({
    subjectTemplate: parts.subjectTemplate,
    bodyTemplate: parts.bodyTemplate,
    wrap: parts.wrap,
    // Sorted: it's the attached set that's recipient-visible, not the
    // order the two id sources happened to be concatenated in.
    attachmentIds: [...parts.attachmentIds].sort(),
    replyTo: parts.replyTo,
    cc: parts.cc ? [...parts.cc].sort() : null,
    bcc: [...parts.bcc].sort(),
  })
}

/**
 * How long a tick's `send_email` step will wait for its
 * `workflow_email_sent` alerts to settle before giving up on them.
 *
 * Why this exists: the executor only checks its own deadline between
 * steps, so it cannot preempt a step already running, and a hung alert
 * here would stall every other due step behind it in the tick. The Slack
 * transport now bounds each post itself (`SLACK_TIMEOUT_MS` in
 * `lib/alerts/slack.ts`, Task 36), which caps the worst case at three
 * seconds rather than the platform's limit. This bound is kept anyway,
 * deliberately: it is tighter than the transport's, it is the send
 * path's own budget rather than a property of whichever transport
 * `sendAlert` happens to use, and it also covers anything else
 * `sendAlert` awaits. Two seconds is generous for a webhook that
 * normally answers in well under one; past that, the alert is treated
 * as best-effort and the handler moves on so the send path is never the
 * thing at risk.
 */
const ALERT_SETTLE_TIMEOUT_MS = 2000

/**
 * Wait for every pending alert to settle, but not past
 * {@link ALERT_SETTLE_TIMEOUT_MS}. `sendAlert` already never rejects
 * (its Slack leg swallows its own errors), so this exists purely to
 * bound how long a slow network call can hold the handler open, not to
 * catch a failure.
 *
 * This wait sits inside the executor's slice: at two seconds per step it
 * is comfortably affordable today, and the alert is one per send that
 * the owner reads as it happens. If a backlog tick ever starts spending
 * a meaningful share of its thirty seconds here, the answer is a
 * per-tick digest (collect the sends, post one Slack message at the end
 * of the tick) rather than a longer or shorter timeout.
 */
async function settleAlertsWithDeadline(alertPromises: Promise<unknown>[]): Promise<void> {
  if (alertPromises.length === 0) return
  // Cleared on the winning path so the timer does not hold a Node event
  // loop handle open after the send has already finished.
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.allSettled(alertPromises),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ALERT_SETTLE_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Send the MC's own copy of a `send_email` step and report how it went.
 *
 * Rendered by the caller exactly as the test send is (no unsubscribe
 * link, no `List-Unsubscribe` header: the MC is not a subscriber, and the
 * couple's link on the MC's copy let the MC opt the couple out). Through
 * the same transport as the couple's messages, under its own idempotency
 * key, so an executor retry of the step does not repeat it on Resend.
 * A failure is logged for a person to look at and otherwise changes
 * nothing: the couple's outcome is the step's outcome.
 */
async function sendMcCopy(sender: ResolvedSender, payload: DispatchPayload): Promise<'sent' | 'failed'> {
  const res = await dispatchEmail(sender, payload)
  if (res.ok) return 'sent'
  logger.warn('[send_email] the MC copy did not send', { code: res.code ?? 'unknown' })
  return 'failed'
}

const sendEmail: ActionSpec<z.infer<typeof sendEmailConfigSchema>> = {
  type: 'send_email',
  configSchema: sendEmailConfigSchema,
  async handler(ctx, config) {
    if (!ctx.couple) {
      return { kind: 'error', message: 'send_email requires a couple context' }
    }

    // Resolve subject + body through the one render chain the review
    // preview also calls (`lib/email/send-email-render`), so what the MC
    // approved is byte for byte what goes out. A TipTap source enforces
    // the never-send-with-missing-variables rule: if any variable is
    // unresolved the action returns a `missing_variables` sleep, which
    // the runner turns into a paused run + Slack alert.
    let tpl: { subject: string; content: JSONContent } | null = null
    let templateFileIds: string[] = []
    if (config.templateId) {
      const tplResult = await loadTemplateParts(ctx, config.templateId)
      if (tplResult.kind === 'error') return tplResult
      tpl = { subject: tplResult.tplSubject, content: tplResult.tplContent }
      templateFileIds = tplResult.templateFileIds
    }
    const source = selectSendEmailSource(config, tpl)
    const rendered = renderSendEmail(source, ctx, config.wrap)
    if (rendered.blocked) {
      return {
        kind: 'sleep',
        reason: 'missing_variables',
        // Far-future so the executor never wakes it by itself; the step
        // stays parked until the MC fixes the data and retries it.
        wakeAt: '9999-12-31T00:00:00.000Z',
        payload: { missing: rendered.missing, couple_name: ctx.couple.name },
      }
    }
    const subject = rendered.subject
    // The subject/body as configured, before variable substitution, so
    // the idempotency key can be extended with a fingerprint of intent
    // rather than of the render (see `contentFingerprint` in
    // lib/email/idempotency for why the render itself is unsafe to hash).
    const subjectTemplate = source.subject
    const bodyTemplate: unknown = source.kind === 'doc' ? source.content : source.body

    // The admin client: automations run without a user session. A missing
    // service-role config (degraded env) leaves the test send on the
    // shared address; the real send below stops without the client anyway.
    let supabase: ReturnType<typeof createAdminClient> | null = null
    try {
      supabase = createAdminClient()
    } catch {
      supabase = null
    }
    // The sender: a connected mailbox (Settings → Public Page → Email)
    // sends through the MC's own inbox, otherwise the shared Zebri
    // address. A mailbox that cannot be reached right now errors the step
    // rather than sending from an address the MC did not approve (M7, see
    // `resolveStepSender`). Resolved per path, not up front: the real send
    // checks the account-wide stop first, so a stopped account sleeps
    // instead of erroring on a mailbox it was never going to use (R3).
    const client = supabase
    const pickSender = async (): Promise<StepSender> =>
      client
        ? resolveStepSender(client, ctx, 'send_email')
        : { ok: true, sender: { transport: 'resend', from: DEFAULT_FROM } }

    // Static attachments resolve once for every recipient. Files come
    // from two sources: template-linked files (email_template_files) and
    // explicitly configured attachFiles. Deduplicate by file id so a file
    // attached both ways sends once. A missing file is skipped by the
    // loader rather than failing the send, so a deleted attachment does
    // not stop the email.
    let attachments: EmailAttachment[] = []
    const allFileIds = sendAttachmentIds(templateFileIds, config.attachFiles)
    if (allFileIds.length && supabase) {
      attachments = await downloadStaticAttachments(supabase, allFileIds)
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
      const testSender = await pickSender()
      if (!testSender.ok) return testSender.result
      const sender = testSender.sender
      const tags = sender.transport === 'resend' ? [{ name: 'tenant', value: ctx.userId }] : undefined
      const res = await dispatchEmail(sender, {
        to: ctx.mc.email,
        subject: `[Test] ${subject}`,
        // No unsubscribe link on the MC's own preview: a link minted for
        // their address would, if clicked, opt the MC out of their own
        // automations.
        html: recipientCopyHtml(rendered, ctx, null),
        replyTo: ctx.mc.email,
        ...(attachments.length ? { attachments } : {}),
        ...(tags ? { tags } : {}),
      })
      // `ok` is the success signal: a Graph send has no id (see below).
      if (!res.ok) {
        return {
          kind: 'error',
          message: `send_email (test): ${res.error ?? 'send failed'}`,
          // Same rule as the real send below: a transport that cannot
          // deduplicate must not be retried on a failure that may have
          // gone out anyway.
          recoverable: transportDeduplicates(sender),
        }
      }
      return {
        kind: 'ok',
        output: { test: true, sent_to_mc: ctx.mc.email, ...(res.messageId ? { message_id: res.messageId } : {}) },
      }
    }

    // The non-test path resolves the couple's recipients, which needs the
    // admin client; if it couldn't be built we can't proceed.
    if (!supabase) {
      return { kind: 'error', message: 'send_email: admin client unavailable' }
    }

    // The account-wide workflow stop. send_email does not go through the
    // shared send gate, so it makes the same check here, before a single
    // recipient is resolved: a stopped account sends nothing automated,
    // and the refusal is a sleep, not an error, so a step the executor
    // claimed a moment before the stop is neither sent nor buried. Due
    // now, so it counts as having come due inside the stop and is skipped
    // when the stop lifts. The MC's own Run now passes through. A failed
    // read errors as recoverable, like the opt-out lookups below.
    if (!ctx.manualRun) {
      const stop = await readAccountPause(supabase, ctx.userId)
      if (stop.status === 'unknown') {
        return {
          kind: 'error',
          message: `send_email: could not check the account-wide workflow stop (${stop.reason})`,
          recoverable: true,
        }
      }
      if (stop.status === 'paused') return accountPausedSleep()
    }

    const picked = await pickSender()
    if (!picked.ok) return picked.result
    const sender: ResolvedSender = picked.sender

    const recipients = await resolveRecipients(supabase, ctx.couple, config.recipients, ctx.mc)
    if (recipients.length === 0) {
      return { kind: 'ok', output: { skipped: 'no recipients' } }
    }

    // send_email is commercial (it is not on the transactional
    // allow-list), which decides below how its cc and bcc addresses are
    // mailed as well as whether each copy carries an unsubscribe link.
    const commercial = !isTransactionalSend('send_email')

    // Who gets a message: the step's own recipients plus every cc and
    // typed bcc address, split into their own messages on a commercial
    // send. Decided in `lib/email/send-email-plan`, which the step
    // envelope also calls, so what the MC is shown before approving is
    // who this mails (see `planRecipients` for the split's reasoning).
    const { ccCandidates, typedBcc } = await resolveCopyCandidates(supabase, ctx.couple, config)
    const plan = planRecipients({
      recipients,
      ccCandidates,
      typedBcc,
      bccSelf: Boolean(config.bccSelf),
      mcEmail: ctx.mc.email,
      commercial,
    })
    const { cc, addressable } = plan
    if (addressable.length === 0) {
      return { kind: 'ok', output: { skipped: 'no addressable recipients' } }
    }

    // Opt-out gate, resolved for every recipient BEFORE anything is
    // dispatched. Run inside the send loop instead, a failed lookup on
    // the second recipient would arrive after the first had already been
    // mailed, and the retryable error it produces would put a second
    // copy in that first inbox on the next attempt for any transport
    // without an idempotency key (the MC's own Gmail or Microsoft
    // mailbox). Nothing has left the building at this point, so
    // deferring here costs nothing.
    //
    // A check that could not be completed errors the step as recoverable
    // so the executor retries it on its backoff. Sending on an
    // indeterminate check would mail someone who may have unsubscribed;
    // recording it as a skip would permanently drop an email nobody
    // asked to stop. `couples.do_not_email` covers the couple's own roles
    // only: the family, vendors and custom addresses a step may also be
    // addressing never opted out (see `gateOptOuts`).
    const gate = await gateOptOuts(supabase, ctx.userId, ctx.couple.id, addressable)
    if (gate.status === 'unknown') {
      return { kind: 'error', message: gate.message, recoverable: true }
    }
    const sendable = gate.sendable
    const suppressedCount = gate.skipped.length

    // Every recipient opted out. Not a failure: the transport was never
    // reached and a retry can never change the answer, so this reports a
    // deliberate skip rather than falling through to the `sent === 0`
    // error below, which would bury the step and send the MC chasing a
    // problem that is the system behaving correctly.
    if (sendable.length === 0) {
      return {
        kind: 'ok',
        output: {
          recipients: addressable.length,
          sent: 0,
          suppressed: suppressedCount,
          failed: 0,
          skipped: 'suppressed',
        },
      }
    }

    // Per-tenant send-volume guard (Task 15), placed after the opt-out
    // gate so a suppressed recipient costs no quota, and weighted by the
    // emails this step is actually about to send, the split-out cc and
    // bcc messages included (each is a real send on the shared domain,
    // where a copy on another message never was). Only for the shared
    // Zebri domain: a step sending through the MC's own mailbox does not
    // touch the domain the brake exists to protect. A breach is not a
    // failure (the transport was never touched), so the step parks
    // (`kind: 'sleep'`) and wakes on its own once the window reopens; every
    // automated send carries an idempotency key (see
    // `sendEmailFingerprint`), so deferring risks no duplicate later.
    if (sender.transport === 'resend') {
      const deferred = await enforceWorkflowSendLimit(ctx.userId, sendable.length)
      if (deferred) return deferred
    }

    // Every copy is rendered before the first dispatch, so a failure to
    // mint a link (an unset UNSUBSCRIBE_TOKEN_SECRET) stops the step with
    // nothing sent rather than halfway through the recipients.
    //
    // send_email is commercial (it is not on the transactional
    // allow-list), so each copy carries a footer link to its own
    // recipient's unsubscribe page and a `List-Unsubscribe` header naming
    // their one-click route. A copy rendered without the branded shell
    // (`wrap: false`) gets the identity and unsubscribe block appended:
    // the header alone is not reliably shown, and Microsoft Graph cannot
    // carry it at all.
    const outgoing = sendable.map((r) => {
      const to = r.email!
      // contactId rides alongside purely so the workflow_email_sent alert
      // (below) can name who this send was for without carrying their
      // address into Slack (T27).
      if (!commercial) {
        return { to, html: recipientCopyHtml(rendered, ctx, null), listUnsubscribeUrl: undefined, contactId: r.contactId }
      }
      const links = buildUnsubscribeLinks(ctx.userId, ctx.couple!.id, to)
      const html = recipientCopyHtml(rendered, ctx, links.pageUrl)
      return { to, html, listUnsubscribeUrl: links.oneClickUrl, contactId: r.contactId }
    })

    const messageIds: string[] = []
    // Counted apart from `messageIds`: a Graph send succeeds with no id.
    let sent = 0
    // Collected rather than awaited inside the loop below, then settled
    // together once the loop finishes. See the comment at the push site
    // for why both halves of that matter.
    const alertPromises: Promise<unknown>[] = []
    let lastError: string | null = null
    // The alert-safe half of the last failure (see DispatchResult.code).
    let lastErrorCode: string | null = null
    const replyTo = sendReplyTo(config.replyToOverride, ctx.mc.email)
    // Computed once every input it depends on (attachments, reply-to,
    // cc, bcc) has been resolved, so an edit to any of them lands in
    // the fingerprint. See `sendEmailFingerprint` for why.
    //
    // On a commercial send `cc` is undefined and the bcc is only the
    // MC's own copy: the split-out addresses are recipients now, not
    // fields on anyone's message, so they no longer change what anyone
    // else receives and stay out of the hash. That also keeps the hash of
    // a step with no cc or typed bcc identical to before the split, and
    // means a vendor attached between two attempts of a step changes only
    // the new vendor's key (their own message), never re-sending the
    // couple's copy on a retry.
    //
    // `fingerprintBcc` is the bcc as it stood before the MC's copy became
    // its own message (Phase 5 fix wave, I1): hashing it unchanged keeps
    // every step's keys, rows and Resend deduplication the same across
    // that change.
    const contentHash = sendEmailFingerprint({
      subjectTemplate,
      bodyTemplate,
      wrap: config.wrap,
      attachmentIds: allFileIds,
      replyTo,
      cc,
      bcc: plan.fingerprintBcc,
    })
    // Tag the send with the tenant ID so Resend webhook events can be
    // attributed to the correct owner for suppression and alerting, and
    // `src=auto` so the webhook knows each of these messages has a
    // couple_emails row to find (M3). Resend only: the MC's own mailbox
    // raises no webhook events.
    const tenantTags = sender.transport === 'resend' ? [{ name: 'tenant', value: ctx.userId }] : undefined
    const coupleTags = tenantTags ? [...tenantTags, AUTOMATED_TAG] : undefined

    const transport = transportOf(sender)
    // The step's own recipients reached, which is what the MC's copy is a
    // record of (see below).
    let directSent = 0

    for (const r of outgoing) {
      // Stable per step and recipient: the provider's idempotency key and
      // the identity of this message's couple_emails row across retries.
      const attemptKey = ctx.stepId ? sendIdempotencyKey(ctx.stepId, r.to, contentHash) : null
      const res = await dispatchEmail(sender, {
        to: r.to,
        subject,
        html: r.html,
        ...(r.listUnsubscribeUrl ? { listUnsubscribeUrl: r.listUnsubscribeUrl } : {}),
        // Stable per step and recipient, so a retry of a send that may
        // already have left is de-duplicated by the provider rather than
        // delivered twice. Resend only: the OAuth transports ignore the
        // key, which is why a failure on one of them comes back as
        // `recoverable: false` below instead of being retried.
        // The trailing hash is a fingerprint of the
        // configured subject/body and every other field that changes what
        // lands in the inbox (see `sendEmailFingerprint`): it changes when
        // the MC edits any of them, so a corrected resend still reaches
        // the couple instead of being silently suppressed as a repeat of
        // the mistake.
        //
        // `ctx.stepId` is populated on every reachable path today (the
        // standard context builder in `lib/automations/context.ts` always
        // sets it), so the `attemptKey` check cannot currently skip the key. It stays
        // because a future caller that assembles a `RunContext` another
        // way, bypassing that builder, would otherwise silently lose this
        // protection instead of failing loudly.
        ...(attemptKey ? { idempotencyKey: attemptKey } : {}),
        ...(replyTo ? { replyTo } : {}),
        // None on a commercial send (every copy is its own message); the
        // transactional shape is kept in `copiesFor`.
        ...copiesFor(plan, r.to),
        ...(attachments.length ? { attachments } : {}),
        ...(coupleTags ? { tags: coupleTags } : {}),
      })
      // One couple_emails row per message, written here where this
      // recipient's transport answer is known and only after it, so the
      // log can neither stop nor repeat a send (see lib/email/send-log).
      // The cc/bcc split above already made every copy its own message,
      // so each split-out address gets its own row too, and a retry of
      // this step updates the same row (keyed on `attemptKey`).
      const logEntry = {
        userId: ctx.userId,
        coupleId: ctx.couple.id,
        stepId: ctx.stepId,
        instanceId: ctx.instanceId,
        to: r.to,
        subject,
        transport,
        attemptKey,
      }
      // `ok` is the success signal, not the message id (same rule as
      // 98bb9018 on main): Microsoft Graph's sendMail answers 202 with an
      // empty body, so an Outlook-connected MC never gets an id back even
      // though the email went out. Counting that as a failure errored the
      // step, and Try again then sent everyone a second copy.
      if (!res.ok) {
        lastError = res.error ?? 'send failed'
        lastErrorCode = res.code ?? 'unknown'
        await logAutomatedSend(supabase, { ...logEntry, result: { ok: false, error: lastError } })
        continue
      }
      await logAutomatedSend(supabase, {
        ...logEntry,
        result: { ok: true, ...(res.messageId ? { messageId: res.messageId } : {}) },
      })
      sent++
      if (plan.direct.has(r.to.trim().toLowerCase())) directSent++
      if (res.messageId) messageIds.push(res.messageId)
      // Not awaited here: awaiting per recipient would put a Slack round
      // trip inside the tick budget for every send in the loop, and on a
      // tick with many sends that adds up. Collected instead and settled
      // together after the loop (see below), because on Vercel a promise
      // still in flight when the handler returns is not guaranteed to run
      // to completion, so a floating promise here would make the alerts
      // for the last sends in a tick, the ones the owner most wants to
      // see, silently unreliable.
      alertPromises.push(
        sendAlert({
          type: 'workflow_email_sent',
          severity: 'info',
          // Not the rendered subject line (T27, fix round 1): it can carry
          // a couple's name through interpolation. The step's own display
          // title (set once in the builder, never per-couple) is safe.
          stepTitle: ctx.stepTitle ?? 'Send email',
          coupleId: ctx.couple?.id ?? null,
          contactId: r.contactId,
          stepId: ctx.stepId ?? null,
          messageId: res.messageId ?? null,
        }),
      )
    }
    // `allSettled`, not `all`: a rejected alert must never fail the send
    // it is reporting on. Bounded by ALERT_SETTLE_TIMEOUT_MS below, which
    // is tighter than the Slack transport's own timeout: blocking here is
    // only safe up to a point.
    await settleAlertsWithDeadline(alertPromises)

    // The MC's paper-trail copy (`bccSelf`, or their own address typed as
    // a copy): its own message, after the couple's, and only when the
    // couple's actually went (it is a record of what they received, as
    // the bcc on their message used to be). See `planRecipients` for why
    // it is no longer a bcc. Never a couple recipient: not logged, not
    // counted in `sent` or `failed`, and its failure fails nothing.
    const mcCopy =
      plan.mcCopy && directSent > 0
        ? await sendMcCopy(sender, {
            to: plan.mcCopy,
            subject,
            html: recipientCopyHtml(rendered, ctx, null),
            ...(replyTo ? { replyTo } : {}),
            ...(attachments.length ? { attachments } : {}),
            ...(ctx.stepId ? { idempotencyKey: `${sendIdempotencyKey(ctx.stepId, plan.mcCopy, contentHash)}:mc-copy` } : {}),
            ...(tenantTags ? { tags: [...tenantTags, { name: MC_COPY_TAG_NAME, value: '1' }] } : {}),
          })
        : null

    const suppressed = suppressedCount
    const failed = sendable.length - sent

    // Total failure: nothing went out. Surface it so the runner
    // errors the run + fires the automation_failed Slack alert —
    // otherwise a misconfigured sender (unverified domain, dead key)
    // silently no-ops every send and the MC never knows.
    if (sent === 0) {
      return {
        kind: 'error',
        // Counted over `sendable`, not `addressable`: an opted-out
        // recipient did not fail, it was deliberately left out above, and
        // folding it into this number would tell the MC that a send they
        // asked to stop had gone wrong.
        message: `send_email: all ${sendable.length} recipient(s) failed${
          lastError ? ` — ${lastError}` : ''
        }`,
        // Whether the executor may retry this. On Resend it may: the
        // idempotency key above means a message that did leave is not
        // delivered a second time. On an MC's own Gmail or Microsoft
        // mailbox there is no such key, and the failures that most want
        // a retry (a thrown request, a timeout) are exactly the ones
        // where the mailbox may have accepted the message and only the
        // response was lost. Retrying there would put two more copies in
        // the couple's inbox, so the step is buried after one attempt
        // and the MC decides, which is what happened before retries
        // existed at all.
        recoverable: transportDeduplicates(sender),
      }
    }

    // Partial or no failure: some emails already went out, so erroring (and
    // re-running) would double-send the successful ones. Stay ok but
    // record the sent, suppressed and failure counts + reason in the run
    // output, which is what the step's warning state is derived from
    // (lib/workflows/send-outcome), and raise the partial-failure alert.
    if (failed > 0) {
      await alertPartialSendFailure({
        userId: ctx.userId,
        coupleId: ctx.couple.id,
        stepId: ctx.stepId,
        instanceId: ctx.instanceId,
        actionType: 'send_email',
        sent,
        failed,
        code: lastErrorCode,
      })
    }
    return {
      kind: 'ok',
      output: {
        recipients: addressable.length,
        sent,
        suppressed,
        failed,
        message_ids: messageIds,
        ...(mcCopy ? { mc_copy: mcCopy } : {}),
        ...(failed > 0 && lastError ? { last_error: lastError } : {}),
        ...(failed > 0 && lastErrorCode ? { last_error_code: lastErrorCode } : {}),
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
