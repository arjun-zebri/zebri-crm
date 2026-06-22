/**
 * Seeded starter catalog for contract templates.
 *
 * Mirrors `lib/email/starter-templates.ts` and the line-item starters:
 * nothing here is auto-added (the legacy single default still seeds on
 * signup via `seed_default_contract_template`), but an MC can browse and
 * add these from the Templates page. Added rows are flagged `is_starter`
 * and stay fully editable.
 *
 * Bodies are TipTap JSON whose mention nodes carry the same contract
 * variable keys the signing/preview pipeline resolves (`today`,
 * `mc_business_name`, `couple_name`, `event_date`, `venue`,
 * `total_amount`, `deposit_amount`, `couple_email`): see
 * `supabase/migrations/20260421000001_seed_default_contract_template.sql`.
 *
 * This is scaffolding, not legal advice: an MC should have a lawyer in
 * their jurisdiction review a template once before using it in paid work.
 *
 * @module lib/contracts/starter-contracts
 */

import type { JSONContent } from '@tiptap/react'

/** A canonical starter contract definition. */
export interface StarterContract {
  name: string
  description: string
  /** TipTap JSON body. */
  content: JSONContent
}

// ── Tiny authoring helpers (mirror the email starters' v/p/body) ──
// `v('couple_name')` → a mention node; strings → text nodes.

type Inline = string | { v: string }

/** A variable mention for use inside {@link p}. */
function v(key: string): { v: string } {
  return { v: key }
}

/** Build a paragraph from inline text + variable parts. */
function p(...parts: Inline[]): JSONContent {
  return {
    type: 'paragraph',
    content: parts.map((part) =>
      typeof part === 'string' ? { type: 'text', text: part } : { type: 'mention', attrs: { id: part.v } },
    ),
  }
}

/** A heading node at the given level. */
function h(level: 1 | 2, text: string): JSONContent {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}

/** A bullet list from plain-text items. */
function bullets(...items: string[]): JSONContent {
  return {
    type: 'bulletList',
    content: items.map((text) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    })),
  }
}

/** Assemble a TipTap doc from block nodes. */
function doc(...blocks: JSONContent[]): JSONContent {
  return { type: 'doc', content: blocks }
}

/**
 * The canonical starter contracts. Order drives the seeded `position`.
 */
export const STARTER_CONTRACTS: readonly StarterContract[] = [
  {
    name: 'Wedding MC Service Agreement',
    description: 'A full service agreement covering services, fees, payment and cancellation.',
    content: doc(
      h(1, 'Wedding MC Service Agreement'),
      p(
        'This agreement is made on ',
        v('today'),
        ' between ',
        v('mc_business_name'),
        ' (the MC) and ',
        v('couple_name'),
        ' (the Couple).',
      ),

      h(2, 'Event'),
      p('Event date: ', v('event_date')),
      p('Venue: ', v('venue')),
      p('The final call time, set-up time and run sheet will be confirmed in writing by the MC no later than 14 days before the event.'),

      h(2, 'Services'),
      p('The MC agrees to provide the following services at the event:'),
      bullets(
        'Reception hosting, emceeing and formal announcements as agreed in the run sheet.',
        'A pre-event planning consultation and preparation of a detailed run sheet with the Couple.',
        'On-the-night coordination with the venue, photographer, DJ or band and other suppliers.',
        'Guest engagement and smooth handling of unexpected changes on the night.',
      ),

      h(2, 'Fees and payment'),
      p('The total fee for the services is ', v('total_amount'), ', inclusive of GST unless otherwise stated on the accompanying quote.'),
      p('A non-refundable deposit of ', v('deposit_amount'), ' is payable within 7 days of signing this agreement. The booking is not secured until the deposit is received in cleared funds.'),
      p('The balance is payable no later than 14 days before the event by bank transfer to the account shown on the invoice.'),

      h(2, 'Cancellation'),
      p('The deposit is non-refundable. If the Couple cancels the event:'),
      bullets(
        '60 or more days before the event: no further amount is owed beyond the deposit.',
        '31 to 59 days before the event: 50% of the remaining balance becomes payable.',
        '30 days or less before the event: the full remaining balance becomes payable.',
      ),
      p('If the MC is unable to perform the services, the MC will use reasonable endeavours to arrange a suitable substitute acceptable to the Couple, or refund all amounts paid including the deposit.'),

      h(2, 'Responsibilities'),
      p('The Couple will provide accurate names, pronunciations, song titles and run-sheet details in good time, and ensure the venue provides a suitable PA system, microphone input and mains power.'),
      p('The MC will perform the services with due care and skill, arrive at the agreed call time appropriately attired, and remain on site for the duration of the agreed formalities.'),

      h(2, 'Acceptance'),
      p(
        'By signing below, ',
        v('couple_name'),
        ' confirms that they have read this agreement in full, have had the opportunity to seek independent legal advice, and agree to be legally bound by its terms.',
      ),
    ),
  },
  {
    name: 'Deposit & Cancellation Terms',
    description: 'A short policy add-on covering deposits, balances and cancellation windows.',
    content: doc(
      h(1, 'Deposit & Cancellation Terms'),
      p(
        'These terms apply to the booking between ',
        v('mc_business_name'),
        ' and ',
        v('couple_name'),
        ' for the event on ',
        v('event_date'),
        '.',
      ),

      h(2, 'Deposit'),
      p('A non-refundable deposit of ', v('deposit_amount'), ' is payable within 7 days of signing. The date is held only once the deposit is received in cleared funds.'),

      h(2, 'Balance'),
      p('The balance of ', v('total_amount'), ' (less the deposit) is payable no later than 14 days before the event. Late payment may, at the discretion of the MC, result in suspension of the services, with the Couple remaining liable for the full fee.'),

      h(2, 'Cancellation'),
      p('If the Couple cancels:'),
      bullets(
        '60 or more days before the event: only the deposit is retained.',
        '31 to 59 days before the event: 50% of the remaining balance is payable.',
        '30 days or less before the event: the full balance is payable.',
      ),
      p('Cancellation must be notified in writing. These amounts reflect a reasonable estimate of the loss arising from a late cancellation, including lost opportunity to book alternative work.'),

      h(2, 'Acceptance'),
      p('By signing below, ', v('couple_name'), ' agrees to these deposit and cancellation terms.'),
    ),
  },
]

/**
 * Resolve starter contracts by name. Unknown names are dropped so a stale
 * client can never inject arbitrary contract content.
 */
export function starterContractsByName(names: readonly string[]): StarterContract[] {
  const wanted = new Set(names)
  return STARTER_CONTRACTS.filter((c) => wanted.has(c.name))
}
