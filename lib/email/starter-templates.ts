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
