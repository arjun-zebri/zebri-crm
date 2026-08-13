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

import { Resend } from 'resend'
import { z } from 'zod'

import type { ActionResult, ActionType, RunContext } from '@/types/automations'

import { renderTemplate } from '../variables'

import { wrapAutomationHtml } from './messaging'
import type { ActionSpec } from './index'

let _resend: Resend | undefined
function resend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(key)
  }
  return _resend
}

const FROM = 'Zebri <noreply@app.zebri.com.au>'

// Subject + body are the whole config: these actions send exactly
// what the MC wrote. The old templateId / attachAssets / tone /
// recipientRole / trackEngagement fields were declared but never
// read. Passthrough keeps configs saved against them parsing.
const baseSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
}).passthrough()

async function sendPreComposed(
  ctx: RunContext,
  subject: string,
  body: string,
): Promise<ActionResult> {
  if (!ctx.couple?.email) return { kind: 'ok', output: { skipped: 'no primary email' } }
  const resolvedSubject = renderTemplate(subject, ctx)
  const resolvedBody = renderTemplate(body, ctx)
  await resend().emails.send({
    from: FROM,
    to: ctx.couple.email,
    subject: resolvedSubject,
    html: wrapAutomationHtml(resolvedBody, ctx),
    replyTo: ctx.mc.email,
  })
  return { kind: 'ok', output: { sent: true } }
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
    return sendPreComposed(ctx, config.subject, config.body)
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
    return sendPreComposed(ctx, config.subject, config.body)
  },
  ui: { category: 'couple', label: 'Send pre-event checklist', description: 'A countdown checklist email', icon: 'CheckSquare' },
}

// ────────────────────────────────────────────────────────────────
// send_thank_you_message
// ────────────────────────────────────────────────────────────────

const sendThankYou: ActionSpec<z.infer<typeof baseSchema>> = {
  type: 'send_thank_you_message',
  configSchema: baseSchema.extend({
    subject: z.string().default('What a day 💕'),
    body: z
      .string()
      .default(
        "Hi {{couple.primary_name}},\n\nThank you for letting me be part of your event. It was such a beautiful day and I'm honoured to have been there for it.\n\nA few photos and the run-sheet I used are in your portal if you ever want to look back. And whenever you're ready to share, I'd love a couple of lines about how you found the day - it really helps me reach more couples like you.\n\nAll the best for the next chapter.\n- {{mc.contact_name}}",
      ),
  }),
  async handler(ctx, config) {
    return sendPreComposed(ctx, config.subject, config.body)
  },
  ui: { category: 'post_event', label: 'Send thank-you message', description: "Post-event 'thank you' email", icon: 'Heart' },
}

// ────────────────────────────────────────────────────────────────
// request_review
// ────────────────────────────────────────────────────────────────

const requestReviewSchema = baseSchema.extend({
  subject: z.string().default('Could I ask a small favour? ⭐'),
  body: z
    .string()
    .default(
      "Hi {{couple.primary_name}},\n\nNow that the dust has settled - if the day felt the way you hoped it would, would you mind dropping a quick review? Even a sentence or two helps me out enormously.\n\nGoogle review link: https://g.page/r/your-place\n\nThanks so much.\n- {{mc.contact_name}}",
    ),
  /** Which platforms the email should link to (multi-select). */
  platforms: z.array(z.enum(['google', 'easy_weddings', 'abia', 'wedsites', 'wedding_wire', 'facebook', 'other'])).optional(),
  /** Free-text incentive ("first reviewer wins…"). */
  incentive: z.string().optional(),
  /** Send a polite follow-up after N days if no review was posted. */
  followUpIfIgnored: z.boolean().optional(),
})

const requestReview: ActionSpec<z.infer<typeof requestReviewSchema>> = {
  type: 'request_review',
  configSchema: requestReviewSchema,
  async handler(ctx, config) {
    return sendPreComposed(ctx, config.subject, config.body)
  },
  ui: { category: 'post_event', label: 'Request review', description: 'Ask the couple for a Google / vendor-site review', icon: 'Star' },
}

// ────────────────────────────────────────────────────────────────
// send_referral_request
// ────────────────────────────────────────────────────────────────

const sendReferralRequestSchema = baseSchema.extend({
  subject: z.string().default('Know anyone planning an event? 👋'),
  body: z
    .string()
    .default(
      "Hi {{couple.primary_name}},\n\nIf any of your friends are starting to plan an event, I'd love to be part of theirs too. You can pass on my details - {{mc.contact_name}}, {{mc.email}} - or tell me their name and I'll reach out gently.\n\nThanks for trusting me with your day.\n- {{mc.contact_name}}",
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
    return sendPreComposed(ctx, config.subject, config.body)
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
    return sendPreComposed(ctx, config.subject, config.body)
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
