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

import type { JSONContent } from '@tiptap/react'

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

/**
 * An empty paragraph — the blank line an MC gets by pressing Enter
 * twice. The renderer preserves these (`fillEmptyParagraphs`), so
 * starters breathe the same way hand-written emails do.
 */
function blank(): JSONContent {
  return { type: 'paragraph' }
}

/**
 * The canonical starter set. Order within a stage drives the seeded
 * `position`. Each one is a worked exemplar: real paragraph spacing,
 * variables in context, and the `{{mc.signature}}` sign-off pattern.
 */
export const STARTER_EMAIL_TEMPLATES: readonly StarterTemplate[] = [
  // ── Enquiry ──────────────────────────────────────────────────
  {
    name: 'Enquiry acknowledgement',
    description: 'Thank a couple for their enquiry and set expectations.',
    lifecycleStage: 'enquiry',
    subject: 'Thanks for reaching out, {{couple.primary_name}}!',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      blank(),
      p(
        'Thank you so much for getting in touch, and congratulations on your engagement! Weddings are my favourite thing in the world, and I would love to hear more about the day you two are planning.',
      ),
      blank(),
      p('So I can point you in the right direction, could you share a few details when you have a moment?'),
      blank(),
      p('1. Your wedding date (or the dates you are considering)'),
      p('2. Your venue, if you have locked one in'),
      p('3. Roughly how many guests you are expecting'),
      p('4. The feel you are going for: relaxed, formal, party-focused, or something in between'),
      blank(),
      p(
        'Once I hear back I will confirm my availability and send through my packages and pricing. I usually reply within one business day, so you will not be waiting long.',
      ),
      blank(),
      p('Talk soon,'),
      p(v('mc.signature')),
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
      blank(),
      p(
        'It was lovely to chat about your wedding on ',
        v('event.date | friendly'),
        '. Thank you for considering me to be part of it.',
      ),
      blank(),
      p('As promised, here is your quote. You can view it, ask questions, and accept it online:'),
      blank(),
      p(v('quote.link')),
      blank(),
      p(
        'It covers everything we discussed, and nothing is set in stone. If you would like to add, remove, or adjust anything, just reply and I will update it the same day.',
      ),
      blank(),
      p(
        'Your date is not held until the quote is accepted and the deposit is paid, so if you are keen, locking it in sooner rather than later is the safest move. No pressure either way, and I am happy to answer anything at all in the meantime.',
      ),
      blank(),
      p('Warm regards,'),
      p(v('mc.signature')),
    ),
  },
  {
    name: 'Proposal cover email',
    description: 'Send the couple their proposal with a warm note.',
    lifecycleStage: 'quote',
    subject: 'Your proposal from {{mc.business_name}}',
    content: body(
      p('Hi ', v('couple.primary_name'), ','),
      blank(),
      p(
        'It was lovely to chat about your wedding on ',
        v('event.date | friendly'),
        '. Thank you for considering me to be part of it.',
      ),
      blank(),
      p(
        'As promised, here is your proposal. You can compare the package options, pick the extras you want, and accept it online:',
      ),
      blank(),
      p(v('proposal.link')),
      blank(),
      p(
        'Everything is based on what we discussed, and nothing is set in stone. If you would like something adjusted, just reply and I will update it the same day.',
      ),
      blank(),
      p(
        'Your date is not held until the proposal is accepted and the deposit is paid, so if you are keen, locking it in sooner rather than later is the safest move. No pressure either way, and I am happy to answer anything at all in the meantime.',
      ),
      blank(),
      p('Warm regards,'),
      p(v('mc.signature')),
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
      blank(),
      p(
        'It is official: I will be your MC on ',
        v('event.date | friendly'),
        ' at ',
        v('venue.name'),
        '! Thank you for trusting me with such a special role. I am genuinely excited for your day.',
      ),
      blank(),
      p('Here is what happens next:'),
      blank(),
      p('1. I will send through your agreement to sign, along with the deposit invoice.'),
      p('2. Closer to the day we will sit down (in person or over a call) to plan your run sheet: timings, announcements, and all the moments that matter to you both.'),
      p('3. In the final week I will confirm every detail with you and your venue, so you can relax and enjoy it.'),
      blank(),
      p(
        'In the meantime, if any questions pop up, even tiny ones, reply here any time. There is no such thing as a silly question when you are planning a wedding.',
      ),
      blank(),
      p('Congratulations again!'),
      p(v('mc.signature')),
    ),
  },
]

/** Lookup by name (names are unique across the catalog). */
const STARTER_BY_NAME = new Map(STARTER_EMAIL_TEMPLATES.map((t) => [t.name, t]))

/**
 * Resolve a list of starter-template names to their catalog entries,
 * preserving request order and silently dropping unknown names.
 *
 * The library is **not** auto-seeded — an MC adds the ones they want
 * from the "Browse starter templates" catalog on the Emails tab. This
 * is the server-trusted lookup the add action uses so the inserted
 * content always comes from the canonical catalog, never the client.
 */
export function starterTemplatesByName(names: string[]): StarterTemplate[] {
  return names
    .map((name) => STARTER_BY_NAME.get(name))
    .filter((t): t is StarterTemplate => t !== undefined)
}
