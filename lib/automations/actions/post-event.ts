/**
 * Pre-composed email actions: onboarding pack, pre-event
 * checklist, thank you, review request, referral request,
 * anniversary message.
 *
 * Each ships with a baked-in default copy that the user can
 * override in the action config. The copy is written for celebrants
 * and MCs - direct, warm, not corporate.
 *
 * @module lib/automations/actions/post-event
 */

import type { JSONContent } from '@tiptap/react'
import { z } from 'zod'

import { AUTOMATION_FROM, sendAutomationEmail } from '@/lib/email/automation-send'
import type { EmailAttachment } from '@/lib/email/dispatch'
import { wrapAutomationShell } from '@/lib/email/html'
import { downloadStaticAttachments } from '@/lib/email/send-context'
import {
  detectMissingVariables,
  renderEmailSubject,
  renderEmailTemplate,
} from '@/lib/email/templates'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult, ActionType, RunContext } from '@/types/automations'

import { renderTemplate } from '../variables'

import type { ActionSpec } from './index'

/**
 * These six always send from the shared Zebri address, never the MC's
 * connected mailbox, which is how they have always gone out. That is
 * what {@link sendAutomationEmail} sends from, so they go through it
 * rather than assembling a sender of their own.
 */
const FROM = AUTOMATION_FROM

// Subject + body are the whole config: these actions send exactly
// what the MC wrote. The old templateId / attachAssets / tone /
// recipientRole / trackEngagement fields were declared but never
// read. Passthrough keeps configs saved against them parsing.
//
// `content` + `attachFiles` mirror send_email: these are emails, so
// they get the same composer and therefore the same rich body and
// file attachments. `body` remains for the baked-in default copy and
// for anything saved before the composer existed.
const baseSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  content: z.record(z.string(), z.unknown()).optional(),
  attachFiles: z.array(z.uuid()).optional(),
}).passthrough()

/**
 * Send one of the pre-composed emails to the couple.
 *
 * A rich `content` doc renders through `renderEmailTemplate` — the
 * path saved templates and the send_email composer use — so
 * formatting survives. Without one, the plain-text `body` renders as
 * before, which is what every default copy still relies on.
 *
 * `cta` renders a button under the message, for the sends that carry
 * a link. Asking for the link in the copy and then leaving the
 * recipient to find a bare URL is how the review request used to
 * work.
 *
 * Every send from here carries an idempotency key, for the same reason
 * `send_email` does: the executor retries a failed step up to three
 * times, and the failures worth retrying (a thrown request, a timeout)
 * are exactly the ones where the message may already have gone. Without
 * the key a couple could receive three thank-you emails. The key is
 * per step and per recipient, and changes when the MC edits the copy,
 * so a corrected resend still reaches them.
 *
 * The result of the send is read, rather than the call simply being
 * awaited. Before, a rejected send was reported as `ok`: the step went
 * green, the workflow moved on, and nothing anywhere said the couple
 * never got it.
 */
async function sendPreComposed(
  actionType: ActionType,
  ctx: RunContext,
  config: z.infer<typeof baseSchema>,
  cta?: { label: string; url: string },
): Promise<ActionResult> {
  if (!ctx.couple?.email) return { kind: 'ok', output: { skipped: 'no primary email' } }

  let subject: string
  // The body before the shell. The shell itself is rendered by the gate's
  // `render` callback, once it has minted this recipient's unsubscribe
  // link: every one of these six is commercial by the classification's
  // default, which the gate, not this file, decides.
  let body: string

  if (config.content) {
    const doc = config.content as JSONContent
    const missing = detectMissingVariables({ subject: config.subject, content: doc }, ctx)
    if (missing.blocked) {
      return {
        kind: 'sleep',
        reason: 'missing_variables',
        wakeAt: '9999-12-31T00:00:00.000Z',
        payload: { missing: missing.missing, couple_name: ctx.couple.name },
      }
    }
    subject = renderEmailSubject(config.subject, ctx, 'send')
    body = renderEmailTemplate(doc, ctx, 'send').html
  } else {
    subject = renderTemplate(config.subject, ctx)
    body = renderTemplate(config.body, ctx)
  }

  // Attachments resolve through the same loader send_email uses; a
  // file deleted since is skipped rather than failing the send.
  let attachments: EmailAttachment[] = []
  if (config.attachFiles?.length) {
    try {
      const admin = createAdminClient()
      attachments = await downloadStaticAttachments(admin, config.attachFiles)
    } catch {
      attachments = []
    }
  }

  const res = await sendAutomationEmail({
    actionType,
    stepId: ctx.stepId,
    userId: ctx.userId,
    manualRun: ctx.manualRun,
    instanceId: ctx.instanceId,
    coupleId: ctx.couple.id,
    to: ctx.couple.email,
    recipientIsCouple: true,
    subject,
    render: (unsubscribeUrl) =>
      wrapAutomationShell(body, ctx.mc.businessName, cta, ctx.mc.branding, unsubscribeUrl),
    identity: { businessName: ctx.mc.businessName, branding: ctx.mc.branding },
    replyTo: ctx.mc.email,
    ...(attachments.length ? { attachments } : {}),
    // Fingerprinted from the configured copy rather than the rendered
    // html: the render folds in variables like `event.days_until` that
    // resolve against the clock, so hashing it would mint a fresh key on
    // every retry and the deduplication would never fire. See
    // `contentFingerprint`.
    fingerprint: {
      subjectTemplate: config.subject,
      bodyTemplate: config.content ?? config.body,
      cta: cta ?? null,
      attachmentIds: [...(config.attachFiles ?? [])].sort(),
      replyTo: ctx.mc.email ?? null,
      from: FROM,
    },
  })
  if (res.deferred) return res.deferred
  if (!res.ok) {
    return {
      kind: 'error',
      message: `Could not send this email: ${res.error}`,
      recoverable: res.recoverable,
    }
  }
  if (res.skipped) {
    return { kind: 'ok', output: { skipped: res.skipped } }
  }
  return { kind: 'ok', output: { sent: true, message_id: res.messageId } }
}

// ────────────────────────────────────────────────────────────────
// send_onboarding_pack
// ────────────────────────────────────────────────────────────────

const sendOnboardingPack: ActionSpec<z.infer<typeof baseSchema>> = {
  type: 'send_onboarding_pack',
  configSchema: baseSchema.extend({
    subject: z.string().default('Welcome - what happens next ✨'),
    body: z
      .string()
      .default(
        "Hi {{couple.primary_name}}, just a quick note to say how excited I am to be part of your big day. Here's what happens next:\n\n• I'll send through the portal where you can add your event details, songs and family run-down\n• Two weeks before the event we'll have a planning call\n• On the day I'll be at the venue an hour before the ceremony\n\nIf anything changes between now and then, just hit reply.\n\n- {{mc.contact_name}}",
      ),
  }),
  async handler(ctx, config) {
    return sendPreComposed('send_onboarding_pack', ctx, config)
  },
  ui: { category: 'couple', label: 'Send onboarding pack', description: 'A welcoming "what happens next" email', icon: 'PackageOpen' },
}

// ────────────────────────────────────────────────────────────────
// send_pre_event_checklist
// ────────────────────────────────────────────────────────────────

const sendPreEventChecklist: ActionSpec<z.infer<typeof baseSchema>> = {
  type: 'send_pre_event_checklist',
  configSchema: baseSchema.extend({
    subject: z.string().default('Quick checklist - your event is {{event.days_until}} days away'),
    body: z
      .string()
      .default(
        "Hi {{couple.primary_name}},\n\n{{event.days_until}} days to go! A quick list of things to lock in:\n\n• Final guest count to your venue\n• Run order confirmed with the band / DJ\n• Songs picked: entrance, first dance, exit\n• Speeches lineup (and who's writing what)\n• Vendors all sent the venue address\n\nIf any of these are still floating, jump into the portal and fill it in - I'll see it and we can chat through anything tricky.\n\n- {{mc.contact_name}}",
      ),
  }),
  async handler(ctx, config) {
    return sendPreComposed('send_pre_event_checklist', ctx, config)
  },
  ui: { category: 'couple', label: 'Send pre-event checklist', description: 'A countdown checklist email', icon: 'CheckSquare' },
}

// ────────────────────────────────────────────────────────────────
// send_thank_you_message
// ────────────────────────────────────────────────────────────────

const sendThankYou: ActionSpec<z.infer<typeof baseSchema>> = {
  type: 'send_thank_you_message',
  configSchema: baseSchema.extend({
    subject: z.string().default('Thank you, {{couple.primary_name}}'),
    body: z
      .string()
      .default(
        "Hi {{couple.primary_name}},\n\n" +
          "What a day. Thank you for trusting me with it.\n\n" +
          "You two were completely yourselves the whole way through, and everyone in the room " +
          "felt it. That is the part I will remember.\n\n" +
          "Your portal stays open, so the timings and details are there whenever you want to " +
          "look back on how the day ran.\n\n" +
          "Wishing you both every happiness.\n\n" +
          "{{mc.contact_name}}",
      ),
  }),
  async handler(ctx, config) {
    return sendPreComposed('send_thank_you_message', ctx, config)
  },
  ui: { category: 'post_event', label: 'Send thank-you message', description: "Post-event 'thank you' email", icon: 'Heart' },
}

// ────────────────────────────────────────────────────────────────
// request_review
// ────────────────────────────────────────────────────────────────

const requestReviewSchema = baseSchema.extend({
  subject: z.string().default('One small favour, {{couple.primary_name}}'),
  body: z
    .string()
    .default(
      "Hi {{couple.primary_name}},\n\n" +
        "I hope the last few weeks have been a good kind of quiet after the day.\n\n" +
        "If you were happy with how it all ran, would you leave me a review? Couples looking " +
        "for an MC are trusting a stranger with the biggest day they have planned, and hearing " +
        "it from someone who has been through it is worth more than anything I can say about " +
        "myself.\n\n" +
        "Two lines is plenty. It takes a minute and it genuinely helps.\n\n" +
        "Thank you either way, and thank you again for having me.\n\n" +
        "{{mc.contact_name}}",
    ),
  // The old platforms / incentive / followUpIfIgnored fields were
  // declared and never read. `platforms` in particular promised a
  // choice the handler could not honour: there is one review link,
  // the MC's own, and it comes from settings. A follow-up is a second
  // step behind a `wait`, which the builder already does. Passthrough
  // (from `baseSchema`) keeps configs saved against them parsing.
})

const requestReview: ActionSpec<z.infer<typeof requestReviewSchema>> = {
  type: 'request_review',
  configSchema: requestReviewSchema,
  async handler(ctx, config) {
    // The copy asks for a review, so an email with nowhere to leave
    // one is worse than no email. Fail loudly and visibly instead:
    // the fix is one field in Settings, and the run log says so.
    const url = ctx.mc.reviewLink?.trim()
    if (!url) {
      return {
        kind: 'error',
        message: 'Add your Google review link in Settings before this step can run.',
        recoverable: false,
      }
    }
    return sendPreComposed('request_review', ctx, config, { label: 'Leave a review', url })
  },
  ui: { category: 'post_event', label: 'Request review', description: 'Ask the couple for a Google / vendor-site review', icon: 'Star' },
}

// ────────────────────────────────────────────────────────────────
// send_referral_request
// ────────────────────────────────────────────────────────────────

const sendReferralRequestSchema = baseSchema.extend({
  subject: z.string().default('If anyone you know is planning a wedding'),
  body: z
    .string()
    .default(
      "Hi {{couple.primary_name}},\n\n" +
        "Weddings tend to come in waves, so there is a fair chance someone in your circle is " +
        "in the thick of planning theirs right now.\n\n" +
        "If my name comes up, I would love you to pass it on. You can send them straight to " +
        "{{mc.email}}, or give me theirs and I will reach out gently, no hard sell.\n\n" +
        "There is no pressure here at all. Recommending someone puts your own judgement on " +
        "the line, and I would only want that if the day earned it.\n\n" +
        "Thanks again for having me.\n\n" +
        "{{mc.contact_name}}",
    ),
  /** Free-text referral bonus copy. */
  referralBonus: z.string().optional(),
  /** Inject a referral tracking link. */
  trackingLink: z.boolean().optional(),
})

const sendReferralRequest: ActionSpec<z.infer<typeof sendReferralRequestSchema>> = {
  type: 'send_referral_request',
  configSchema: sendReferralRequestSchema,
  async handler(ctx, config) {
    return sendPreComposed('send_referral_request', ctx, config)
  },
  ui: { category: 'post_event', label: 'Send referral request', description: 'Ask for word-of-mouth referrals', icon: 'Share2' },
}

// ────────────────────────────────────────────────────────────────
// send_anniversary_message
// ────────────────────────────────────────────────────────────────

const sendAnniversaryMessage: ActionSpec<z.infer<typeof baseSchema>> = {
  type: 'send_anniversary_message',
  configSchema: baseSchema.extend({
    subject: z.string().default('Happy anniversary 💍'),
    body: z
      .string()
      .default(
        "Hi {{couple.primary_name}},\n\nHard to believe it's been a whole year since {{event.weekday}}. Hope life as a married couple has been every bit as good as that day.\n\nWishing you both the best for many more.\n- {{mc.contact_name}}",
      ),
  }),
  async handler(ctx, config) {
    return sendPreComposed('send_anniversary_message', ctx, config)
  },
  ui: { category: 'post_event', label: 'Send anniversary message', description: 'Annual anniversary touchpoint', icon: 'Cake' },
}

export const postEventActions: Partial<Record<ActionType, ActionSpec<any>>> = {
  send_onboarding_pack: sendOnboardingPack,
  send_pre_event_checklist: sendPreEventChecklist,
  send_thank_you_message: sendThankYou,
  request_review: requestReview,
  send_referral_request: sendReferralRequest,
  send_anniversary_message: sendAnniversaryMessage,
}
