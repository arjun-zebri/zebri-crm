/**
 * Seeded starter email-template library.
 *
 * Every MC's library is auto-seeded (once, on first access) with
 * editable copies of these lifecycle templates — enquiry through
 * follow-up, including the celebrant-specific AU legal templates a
 * marriage celebrant needs (NOIM, document requests, ceremony script,
 * certificate info). `is_starter` is a provenance badge only; the
 * copies are fully editable and deletable.
 *
 * Templates are authored here (typed + unit-tested) rather than as raw
 * SQL JSON so the bodies stay maintainable and the variable paths can
 * be validated against the resolver's namespace.
 *
 * Bodies are TipTap JSON whose mention nodes carry a namespaced
 * variable key in `attrs.id`; subjects are mustache strings. Both
 * resolve through `lib/email/templates` at render time.
 *
 * @module lib/email/starter-templates
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { JSONContent } from '@tiptap/react'

import type { Database } from '@/types/database'
import type { LifecycleStage } from '@/types/email-template'

/** A canonical starter template definition. */
export interface StarterTemplate {
  name: string
  description: string
  lifecycleStage: LifecycleStage
  /** Mustache subject, e.g. `Quote for {{couple.name}}`. */
  subject: string
  /** TipTap JSON body. */
  content: JSONContent
}

// ── Tiny authoring helpers ──────────────────────────────────────
// `v('couple.primary_name')` → a mention node; strings → text nodes.

type Inline = string | { v: string }

/** A variable mention for use inside {@link p}. */
function v(path: string): { v: string } {
  return { v: path }
}

/** Build a paragraph from inline text + variable parts. */
function p(...parts: Inline[]): JSONContent {
  return {
    type: 'paragraph',
    content: parts.map((part) =>
      typeof part === 'string'
        ? { type: 'text', text: part }
        : { type: 'mention', attrs: { id: part.v } },
    ),
  }
}

/** Assemble a TipTap doc from paragraphs. */
function body(...paras: JSONContent[]): JSONContent {
  return { type: 'doc', content: paras }
}

// Common sign-off reused across templates.
const signOff = (): JSONContent[] => [p('Warm regards,'), p(v('mc.contact_name')), p(v('mc.business_name'))]

/**
 * The canonical starter set. Order within a stage drives the seeded
 * `position`.
 */
export const STARTER_EMAIL_TEMPLATES: readonly StarterTemplate[] = [
  // ── Enquiry ──────────────────────────────────────────────────
  {
    name: 'Enquiry acknowledgement',
    description: 'Thank a couple for their enquiry and set expectations.',
    lifecycleStage: 'enquiry',
    subject: 'Thanks for reaching out, {{couple.primary_name}}',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p(
        'Thank you so much for getting in touch about your wedding! I would love to hear more about your day and how I can help.',
      ),
      p('Could you share your event date, venue, and a little about what you have in mind? I will get back to you with availability and next steps.'),
      ...signOff(),
    ),
  },
  {
    name: 'Availability: yes',
    description: 'Confirm you are available for the couple’s date.',
    lifecycleStage: 'enquiry',
    subject: 'Good news: I’m available for your wedding',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('Wonderful news: I am available on ', v('event.date | friendly'), ' and would be delighted to be part of your day.'),
      p('I will put together a quote for you shortly. In the meantime, feel free to reply with any questions.'),
      ...signOff(),
    ),
  },
  {
    name: 'Booked out: referral',
    description: 'Politely decline when you are unavailable and offer to refer.',
    lifecycleStage: 'enquiry',
    subject: 'About your wedding date',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('Thank you for thinking of me! Unfortunately I am already booked on ', v('event.date | friendly'), ', so I am not able to take on your wedding.'),
      p('I would hate to leave you without options, so if it would help, I am happy to refer you to a trusted colleague. Just let me know.'),
      p('Wishing you a wonderful celebration,'),
      p(v('mc.contact_name')),
    ),
  },
  {
    name: 'Discovery call invite',
    description: 'Invite the couple to a quick call to talk through their day.',
    lifecycleStage: 'enquiry',
    subject: 'Let’s have a quick chat about your day',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('The best way to see if we are a great fit is a quick, no-pressure chat. I would love to learn about you both and your plans for the day.'),
      p('Reply with a couple of times that suit you and I will lock one in.'),
      ...signOff(),
    ),
  },

  // ── Quote ────────────────────────────────────────────────────
  {
    name: 'Quote cover email',
    description: 'Send the couple their quote with a warm note.',
    lifecycleStage: 'quote',
    subject: 'Your quote from {{mc.business_name}}',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('Thank you for the opportunity. I have put together a quote for your wedding on ', v('event.date | friendly'), '.'),
      p('You can view it here: ', v('quote.link')),
      p('Let me know if you have any questions or would like to tweak anything. I am happy to help.'),
      ...signOff(),
    ),
  },
  {
    name: 'Quote follow-up nudge',
    description: 'Gently follow up on a quote you have not heard back on.',
    lifecycleStage: 'quote',
    subject: 'Just checking in on your quote',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('I wanted to gently check in on the quote I sent through. No rush at all, I know wedding planning keeps you busy!'),
      p('You can revisit it any time here: ', v('quote.link')),
      p('If anything needs adjusting, just say the word.'),
      ...signOff(),
    ),
  },
  {
    name: 'Quote expiring soon',
    description: 'Let the couple know their quote is about to expire.',
    lifecycleStage: 'quote',
    subject: 'Your quote expires soon',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('A quick heads-up that your quote is due to expire shortly. I would love to keep your date held for you.'),
      p('You can review and accept it here: ', v('quote.link')),
      p('Happy to answer any last questions before you decide.'),
      ...signOff(),
    ),
  },

  // ── Booking ──────────────────────────────────────────────────
  {
    name: 'You’re booked: confirmation',
    description: 'Celebrate the booking and outline next steps.',
    lifecycleStage: 'booking',
    subject: 'You’re booked! 🎉',
    content: body(
      p('Hi ', v('couple.name'), ','),
      p('It is official! I am honoured to be part of your wedding on ', v('event.date | friendly'), ' at ', v('venue.name'), '.'),
      p('I will be in touch with the next steps shortly, including your agreement and planning details. For now, congratulations and thank you for trusting me with your day.'),
      ...signOff(),
    ),
  },
  {
    name: 'Agreement to sign',
    description: 'Send the contract for signature.',
    lifecycleStage: 'booking',
    subject: 'Your agreement is ready to sign',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('To lock everything in, here is your agreement to review and sign: ', v('contract.link')),
      p('Once that is signed we are all set. Let me know if anything is unclear and I am happy to walk you through it.'),
      ...signOff(),
    ),
  },
  {
    name: 'Deposit invoice',
    description: 'Request the deposit to secure the date.',
    lifecycleStage: 'booking',
    subject: 'Deposit invoice to secure your date',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('Here is your deposit invoice to secure ', v('event.date | friendly'), ': ', v('invoice.link')),
      p('Once the deposit is received your booking is confirmed. Thank you!'),
      ...signOff(),
    ),
  },
  {
    name: 'Payment received: thank you',
    description: 'Acknowledge a received payment.',
    lifecycleStage: 'booking',
    subject: 'Payment received, thank you',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('Thank you! Your payment has come through and everything is up to date. I truly appreciate it.'),
      p('I am looking forward to working with you towards your big day.'),
      ...signOff(),
    ),
  },

  // ── Planning ─────────────────────────────────────────────────
  {
    name: 'Planning questionnaire request',
    description: 'Ask the couple to complete their planning details.',
    lifecycleStage: 'planning',
    subject: 'Let’s start planning your ceremony',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('It is time for the fun part: planning your day! Please complete your planning details in your portal here: ', v('portal.link')),
      p('This helps me tailor everything to you. There are no wrong answers, and you can save and return any time.'),
      ...signOff(),
    ),
  },
  {
    name: 'Song & music requests',
    description: 'Collect the couple’s music choices.',
    lifecycleStage: 'planning',
    subject: 'Your music & song choices',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('Music sets the mood for your day. When you have a moment, please add your song choices in your portal: ', v('portal.link')),
      p('Think processional, signing, and recessional, plus any special songs that mean something to you both.'),
      ...signOff(),
    ),
  },
  {
    name: 'Run sheet draft for review',
    description: 'Share the draft timeline for the couple to review.',
    lifecycleStage: 'planning',
    subject: 'Your draft run sheet to review',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('I have put together a draft run sheet for your day. Please take a look in your portal and let me know if anything needs adjusting: ', v('portal.link')),
      p('Once you are happy, I will finalise it and share with your vendors.'),
      ...signOff(),
    ),
  },
  {
    name: 'Final details confirmation',
    description: 'Confirm key logistics about two weeks out.',
    lifecycleStage: 'planning',
    subject: 'Confirming the final details for your day',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('We are getting close! With ', v('event.date | friendly'), ' nearly here, I would love to confirm the final details for ', v('venue.name'), '.'),
      p('Please review everything in your portal and flag any last changes: ', v('portal.link')),
      ...signOff(),
    ),
  },
  {
    name: 'Final balance reminder',
    description: 'Remind the couple of the remaining balance.',
    lifecycleStage: 'planning',
    subject: 'A friendly reminder about your final balance',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('Just a gentle reminder that your final balance is due ahead of the big day. You can settle it here: ', v('invoice.link')),
      p('Thank you so much, almost there!'),
      ...signOff(),
    ),
  },

  // ── Planning — celebrant AU legal ────────────────────────────
  {
    name: 'NOIM request (celebrant)',
    description: 'Request the couple lodge the Notice of Intended Marriage.',
    lifecycleStage: 'planning',
    subject: 'Your Notice of Intended Marriage (NOIM)',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p(
        'Under Australian marriage law, your Notice of Intended Marriage (NOIM) must be completed and lodged with me at least one month before your ceremony (and no more than 18 months prior).',
      ),
      p('Please complete and return your NOIM at your earliest convenience so we stay comfortably within the legal timeframe. I will guide you through every step.'),
      p('If you have any questions about the form, just ask. This is my area.'),
      ...signOff(),
    ),
  },
  {
    name: 'Required documents request (celebrant)',
    description: 'Request the legal identity documents you must sight.',
    lifecycleStage: 'planning',
    subject: 'Documents I’ll need to see before your ceremony',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('To meet my legal obligations as your celebrant, I need to sight a few documents for each of you before the ceremony:'),
      p('• Proof of date and place of birth (birth certificate or passport)'),
      p('• Photo identification (driver licence or passport)'),
      p('• If either of you has been married before: divorce decree absolute or the death certificate of a former spouse'),
      p('You can upload these securely in your portal: ', v('portal.link')),
      ...signOff(),
    ),
  },
  {
    name: 'Ceremony script for review (celebrant)',
    description: 'Share the draft ceremony script for the couple’s feedback.',
    lifecycleStage: 'planning',
    subject: 'Your draft ceremony script',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('I have drafted your ceremony script and would love your thoughts. It includes the legal wording required by the Marriage Act alongside the personal touches we discussed.'),
      p('You can review it in your portal here: ', v('portal.link')),
      p('Take your time. This is your story, and I want it to feel just right.'),
      ...signOff(),
    ),
  },
  {
    name: 'Marriage certificate info (celebrant)',
    description: 'Explain certificates and registration after the wedding.',
    lifecycleStage: 'follow_up',
    subject: 'About your marriage certificate',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('Congratulations again! Now for the paperwork side: I will register your marriage with the relevant Births, Deaths and Marriages registry within the legal timeframe.'),
      p('On the day you will receive a ceremonial certificate. If you would like an official standard marriage certificate (often needed for name changes), you can apply through your state or territory registry, and I am happy to point you to the right place.'),
      ...signOff(),
    ),
  },

  // ── Wedding week ─────────────────────────────────────────────
  {
    name: 'Day-of logistics: see you soon',
    description: 'A warm note in the final days before the wedding.',
    lifecycleStage: 'wedding_week',
    subject: 'See you very soon!',
    content: body(
      p('Hi ', v('couple.name'), ','),
      p('The big day is almost here! I will arrive ahead of time on ', v('event.weekday'), ' at ', v('venue.name'), ' so everything runs smoothly.'),
      p('Try to relax and soak it all in. You are in good hands, and I cannot wait to celebrate with you.'),
      ...signOff(),
    ),
  },
  {
    name: 'Final run sheet to vendors',
    description: 'Share the finalised run sheet with the couple and vendors.',
    lifecycleStage: 'wedding_week',
    subject: 'Final run sheet for {{couple.name}}’s wedding',
    content: body(
      p('Hi everyone,'),
      p('Please find the final run sheet for ', v('couple.name'), '’s wedding on ', v('event.date | friendly'), ' at ', v('venue.name'), '.'),
      p('Let me know if anything looks off on your end. Looking forward to a wonderful day together.'),
      ...signOff(),
    ),
  },

  // ── Follow-up ────────────────────────────────────────────────
  {
    name: 'Thank you & congratulations',
    description: 'A heartfelt thank-you after the wedding.',
    lifecycleStage: 'follow_up',
    subject: 'Thank you, what a day!',
    content: body(
      p('Hi ', v('couple.name'), ','),
      p('What an absolute joy it was to be part of your wedding. Thank you for trusting me with such a special role; I loved every moment.'),
      p('Wishing you both a lifetime of happiness.'),
      ...signOff(),
    ),
  },
  {
    name: 'Review request',
    description: 'Invite the couple to leave a review.',
    lifecycleStage: 'follow_up',
    subject: 'Would you share a few words?',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('I hope you are still floating on cloud nine! If you have a spare moment, a short review would mean the world and helps other couples find me.'),
      p('No pressure at all, only if you feel like it. Thank you again for having me.'),
      ...signOff(),
    ),
  },
  {
    name: 'Referral request',
    description: 'Ask happy couples to refer friends.',
    lifecycleStage: 'follow_up',
    subject: 'Know someone getting married?',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      p('If any of your friends or family are planning their wedding, I would be honoured if you pointed them my way. There is no greater compliment than a referral from a couple I have worked with.'),
      p('Thank you, and congratulations once more!'),
      ...signOff(),
    ),
  },
  {
    name: 'Anniversary message',
    description: 'A warm note around the couple’s first anniversary.',
    lifecycleStage: 'follow_up',
    subject: 'Happy anniversary!',
    content: body(
      p('Hi ', v('couple.name'), ','),
      p('Happy anniversary! I was thinking of you both and the beautiful day we shared. I hope this year has been everything you dreamed of.'),
      p('Sending you my very best,'),
      p(v('mc.contact_name')),
    ),
  },
]

/**
 * Auto-seed a user's starter library if they have none yet.
 *
 * Idempotent: only seeds when the user currently has zero templates,
 * so re-running (e.g. on every Templates page load) is safe and never
 * resurrects templates the user has since edited. Called from the
 * Templates page loader and the automation template-picker loader so a
 * brand-new MC always sees a full library.
 *
 * @returns The number of templates inserted (0 when already seeded).
 */
export async function ensureStarterTemplates(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { count, error: countError } = await supabase
    .from('email_templates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (countError || (count ?? 0) > 0) return 0

  const rows = STARTER_EMAIL_TEMPLATES.map((t, i) => ({
    user_id: userId,
    name: t.name,
    description: t.description,
    subject: t.subject,
    content: t.content as Database['public']['Tables']['email_templates']['Insert']['content'],
    lifecycle_stage: t.lifecycleStage,
    is_starter: true,
    position: i * 10,
  }))

  const { error: insertError } = await supabase.from('email_templates').insert(rows)
  if (insertError) return 0
  return rows.length
}
