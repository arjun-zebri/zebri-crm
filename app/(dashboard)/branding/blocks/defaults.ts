import type { Block, BlockType, TextStyle } from './types'

let counter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

export function blockTemplate(type: BlockType): Block {
  switch (type) {
    case 'headerBanner':
      return { id: newId('hb'), type: 'headerBanner' }
    case 'businessName':
      return { id: newId('bn'), type: 'businessName' }
    case 'tagline':
      return { id: newId('tg'), type: 'tagline' }
    case 'title':
      return {
        id: newId('tt'),
        type: 'title',
        title: 'Document title',
        subtitle: 'Couple name · Date',
        showRef: true,
        showExpires: true,
        showAbn: false,
      }
    case 'lineItems':
      return { id: newId('li'), type: 'lineItems', colSpread: true }
    case 'totals':
      return { id: newId('to'), type: 'totals', taxRate: 10, showSubtotal: true, colSpread: true }
    case 'text':
      return { id: newId('tx'), type: 'text', text: 'Add a note to your client.' }
    case 'action':
      return { id: newId('ac'), type: 'action', primary: 'Submit', secondary: null }
    case 'divider':
      return { id: newId('dv'), type: 'divider' }
    case 'footer':
      return { id: newId('ft'), type: 'footer', closingNote: 'Thank you for choosing us.' }
    case 'paymentDetails':
      return { id: newId('pd'), type: 'paymentDetails', heading: 'Bank transfer', accountName: 'Your business name', bsb: '000-000', accountNumber: '0000 0000' }
    case 'couplePortal':
      return { id: newId('cp'), type: 'couplePortal', locked: true }
    case 'paymentSchedule':
      return { id: newId('ps'), type: 'paymentSchedule', locked: true }
  }
}

// ── Curated styles ────────────────────────────────────────────────────────────
// Intentional overrides that give the starter template a designed feel.
// Kept minimal so theme/font changes still flow through cleanly.

const HERO_SUBTITLE: TextStyle = {
  fontSize: 12,
  color: '#9CA3AF',
  letterSpacing: 0.08,
  lineHeight: 1.4,
}

const FORMAL_TITLE: TextStyle = {
  fontSize: 38,
  fontWeight: 500,
  letterSpacing: -0.015,
  lineHeight: 1.1,
}

const EMPHASIZED_TOTAL: TextStyle = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: -0.01,
}

const SOFT_MESSAGE: TextStyle = {
  fontSize: 13,
  lineHeight: 1.7,
  color: '#4B5563',
}

const CONTRACT_TERMS: TextStyle = {
  fontSize: 13,
  lineHeight: 1.85,
  color: '#374151',
}

const SOFT_DIVIDER = { thickness: 1, color: '#E5E7EB' } as const

// ── Defaults ──────────────────────────────────────────────────────────────────

export function defaultBlocksFor(surface: 'quote' | 'invoice' | 'contract' | 'portal'): Block[] {
  if (surface === 'portal') {
    return [
      { id: newId('hb'), type: 'headerBanner' },
      { id: newId('bn'), type: 'businessName' },
      { id: newId('cp'), type: 'couplePortal', locked: true },
    ]
  }
  if (surface === 'quote') {
    return [
      { id: newId('hb'), type: 'headerBanner' },
      { id: newId('bn'), type: 'businessName' },
      {
        id: newId('tt'),
        type: 'title',
        title: 'Quote',
        subtitle: 'ALEX & JORDAN  ·  14 SEPTEMBER 2026',
        showRef: true,
        showExpires: true,
        showAbn: false,
        titleStyle: FORMAL_TITLE,
        subtitleStyle: HERO_SUBTITLE,
      },
      { id: newId('li'), type: 'lineItems', colSpread: true },
      {
        id: newId('to'),
        type: 'totals',
        taxRate: 10,
        showSubtotal: true,
        totalStyle: EMPHASIZED_TOTAL,
      },
      { id: newId('dv'), type: 'divider', ...SOFT_DIVIDER },
      {
        id: newId('tx'),
        type: 'text',
        text: 'Thanks for thinking of me for your day. The deposit secures the date - happy to jump on a call before you decide.',
        textStyle: SOFT_MESSAGE,
      },
      { id: newId('ac'), type: 'action', primary: 'Accept quote', secondary: 'Decline' },
      { id: newId('ft'), type: 'footer', closingNote: 'Thank you for thinking of us.' },
    ]
  }
  if (surface === 'invoice') {
    return [
      { id: newId('hb'), type: 'headerBanner' },
      { id: newId('bn'), type: 'businessName' },
      {
        id: newId('tt'),
        type: 'title',
        title: 'Invoice',
        subtitle: 'ALEX & JORDAN  ·  14 SEPTEMBER 2026',
        showRef: true,
        showExpires: true,
        showAbn: true,
        titleStyle: FORMAL_TITLE,
        subtitleStyle: HERO_SUBTITLE,
      },
      { id: newId('li'), type: 'lineItems', colSpread: true },
      {
        id: newId('to'),
        type: 'totals',
        taxRate: 10,
        showSubtotal: true,
        totalStyle: EMPHASIZED_TOTAL,
      },
      { id: newId('ps'), type: 'paymentSchedule', locked: true },
      {
        id: newId('tx'),
        type: 'text',
        text: 'Payment due within 14 days. Pay by card, or by bank transfer using the details below.',
        textStyle: SOFT_MESSAGE,
      },
      { id: newId('pd'), type: 'paymentDetails', heading: 'Bank transfer', accountName: 'Your business name', bsb: '000-000', accountNumber: '0000 0000' },
      { id: newId('ac'), type: 'action', primary: 'Pay with card', secondary: null },
      { id: newId('ft'), type: 'footer', closingNote: 'Questions? Reply any time and we will sort it.' },
    ]
  }
  // contract
  return [
    { id: newId('hb'), type: 'headerBanner' },
    { id: newId('bn'), type: 'businessName' },
    {
      id: newId('tt'),
      type: 'title',
      title: 'Wedding MC Service Agreement',
      subtitle: 'ALEX & JORDAN  ·  14 SEPTEMBER 2026',
      showRef: true,
      showExpires: false,
      showAbn: true,
      titleStyle: FORMAL_TITLE,
      subtitleStyle: HERO_SUBTITLE,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        'PARTIES\n\nMC: [Your business name], [ABN], of [your address] ("the MC")\nClients: Alex & Jordan, of [client address] ("the Clients")\n\nThis agreement takes effect on the date the Clients sign below and continues until all obligations under it have been performed. It supersedes any prior proposal, quote or correspondence relating to the event.',
      textStyle: SOFT_MESSAGE,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        'EVENT DETAILS\n\nDate: Saturday, 14 September 2026\nVenue: The Glasshouse, Sydney NSW\nCeremony: 3:00 PM (call time 1:30 PM)\nReception: 5:30 PM\nMC finish: 11:00 PM\nGuest count: 110 (provisional)\nDress code: Cocktail',
      textStyle: SOFT_MESSAGE,
    },

    { id: newId('dv'), type: 'divider', ...SOFT_DIVIDER },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '1. SERVICES\n\nThe MC will host the ceremony and reception on the event date set out above. Services include:\n\n  (a) a pre-event planning consultation (in person or video) of up to ninety (90) minutes;\n  (b) preparation of an agenda and run-sheet in collaboration with the Clients;\n  (c) a final confirmation call within seven (7) days of the event;\n  (d) professional MC duties from the agreed call time through to the agreed finish time;\n  (e) coordination with the venue, photographer, videographer, celebrant and band or DJ; and\n  (f) presenting all formalities through to the final speech or last dance.\n\nThe MC will make reasonable efforts to accommodate cultural, religious or family requirements communicated by the Clients before the event.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '2. EQUIPMENT & TECHNICAL REQUIREMENTS\n\nThe MC will arrive no later than ninety (90) minutes before the agreed call time to sound-check microphones, review staging and confirm the run-sheet with the venue. The Clients are responsible for ensuring the venue provides a functional sound system with at least one wireless microphone, monitor speaker for speeches and adequate lighting for the MC station. Where the venue cannot supply this equipment, the MC may provide it for an additional fee agreed in writing.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '3. FEES & PAYMENT SCHEDULE\n\nThe total fee for the services is set out in the attached invoice (the "Total Fee"). The Clients agree to pay:\n\n  (a) a non-refundable deposit of twenty-five percent (25%) of the Total Fee on signing this agreement, which secures the date; and\n  (b) the remaining balance no later than fourteen (14) days before the event date.\n\nPayments may be made by bank transfer or credit card. Late payments accrue interest at 2% per calendar month or part-month from the due date. Travel beyond a fifty (50) kilometre radius of the MC\'s base address is charged at $1.20 per kilometre, agreed in advance.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '4. CANCELLATION BY THE CLIENTS\n\nIf the Clients cancel this agreement, the following fees apply:\n\n  (a) more than 90 days before the event: deposit forfeited;\n  (b) between 60 and 90 days before the event: 50% of the Total Fee;\n  (c) between 14 and 60 days before the event: 75% of the Total Fee;\n  (d) within 14 days of the event: 100% of the Total Fee.\n\nAll cancellations must be made in writing to the MC at the email address on the attached invoice.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '5. CANCELLATION BY THE MC\n\nIf the MC is unable to perform on the event date for any reason within the MC\'s control, the MC will use reasonable efforts to provide a suitably qualified replacement MC acceptable to the Clients at no additional cost. If no replacement can be arranged, all amounts paid by the Clients will be refunded in full within seven (7) days. The MC\'s total liability under this clause is limited to that refund.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '6. POSTPONEMENT\n\nThe Clients may postpone the event once at no additional charge, subject to:\n\n  (a) the MC\'s availability on the proposed new date;\n  (b) at least thirty (30) days\' written notice before the original event date; and\n  (c) the new date falling within twelve (12) months of the original event date.\n\nA second postponement is treated as a cancellation under clause 4.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '7. FORCE MAJEURE\n\nNeither party is liable for failure to perform this agreement where performance is prevented by circumstances beyond that party\'s reasonable control, including (without limitation) serious illness, injury, government order, pandemic, natural disaster or transport failure. Where a force majeure event prevents performance, fees already paid will be credited toward a rescheduled date within twelve (12) months of the original event date.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '8. CONDUCT, BREAKS & OVERTIME\n\nThe MC will conduct themselves professionally at all times and treat the Clients\' guests, vendors and venue staff with respect. The Clients agree to provide a hot meal and non-alcoholic refreshments for the MC during the event, and a private space to take a short break of up to twenty (20) minutes during the dinner service.\n\nPerformances run for the period set out in the Event Details. If the Clients request the MC to continue beyond the agreed finish time, an overtime fee of $200 per hour or part-hour applies, payable on the night by bank transfer or card.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '9. RECORDINGS, IMAGES & MARKETING\n\nThe Clients grant the MC a non-exclusive, royalty-free licence to use photographs, audio recordings and video from the event for portfolio, social media and marketing purposes. The Clients may opt out of this clause by giving written notice before the event, in which case the MC will not publish any identifying material from the event. The MC will never publish images of children or non-public family members without explicit permission.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '10. INSURANCE, LIABILITY & INDEMNITY\n\nThe MC holds current public liability insurance to the value of AUD $20,000,000 and will provide a certificate of currency on request. The MC\'s total liability under this agreement is limited to the fees actually paid by the Clients. Neither party is liable for indirect, special or consequential loss, including loss of profit or loss of enjoyment. Each party indemnifies the other against any third-party claim arising from that party\'s own negligence or breach of this agreement.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '11. CONFIDENTIALITY\n\nThe MC will treat as confidential any personal information, family details or sensitive content shared during the planning of the event (including run-sheets, speeches and guest lists), except to the extent disclosure is required to deliver the services or by law.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '12. VARIATIONS & ENTIRE AGREEMENT\n\nAny variation to this agreement must be in writing and signed by both parties. This document, together with the attached invoice, constitutes the entire agreement between the parties and supersedes all prior discussions, proposals or correspondence relating to the event.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('tx'),
      type: 'text',
      text:
        '13. DISPUTE RESOLUTION & GOVERNING LAW\n\nThe parties will attempt to resolve any dispute under this agreement by good-faith discussion within thirty (30) days of the dispute arising. If the dispute is not resolved, the parties agree to attempt mediation through a recognised mediator before commencing any court proceedings. This agreement is governed by the laws of New South Wales, Australia, and the parties submit to the non-exclusive jurisdiction of its courts.',
      textStyle: CONTRACT_TERMS,
    },

    { id: newId('dv'), type: 'divider', ...SOFT_DIVIDER },

    {
      id: newId('tx'),
      type: 'text',
      text:
        'SIGNATURES\n\nBy clicking "Sign contract" below, the Clients confirm they have read, understood and accept the terms of this agreement on behalf of both parties to the marriage. Digital signatures are recorded with a timestamp and an audit log and are binding.\n\nClient signature       ______________________________________     Date   ____ / ____ / ______\n\nClient signature       ______________________________________     Date   ____ / ____ / ______\n\nMC signature           ______________________________________     Date   ____ / ____ / ______\n\nA counter-signed PDF copy will be returned to the Clients within two (2) business days of receipt.',
      textStyle: SOFT_MESSAGE,
    },

    { id: newId('ac'), type: 'action', primary: 'Sign contract', secondary: null },
    { id: newId('ft'), type: 'footer', closingNote: 'A counter-signed copy will be returned to you.' },
  ]
}

/**
 * Migrate persisted block data from older shapes (e.g. type: 'message') to the
 * current schema. Safe to run on every load.
 */
export function migrateBlocks(blocks: unknown, surface?: 'quote' | 'invoice' | 'contract' | 'portal'): Block[] {
  if (!Array.isArray(blocks)) return []
  let migrated = blocks
    .map((raw): Block | null => {
      if (!raw || typeof raw !== 'object') return null
      const b = raw as Record<string, unknown> & { type?: string }
      if (b.type === 'message') {
        const { style: _style, ...rest } = b as Record<string, unknown>
        void _style
        return stripDashes({ ...(rest as object), type: 'text' } as unknown as Block)
      }
      if (b.type === 'lineItems' && 'showAddPlaceholder' in b) {
        const { showAddPlaceholder: _drop, ...rest } = b as Record<string, unknown>
        void _drop
        return stripDashes(rest as unknown as Block)
      }
      return stripDashes(b as unknown as Block)
    })
    .filter((b): b is Block => b !== null)

  // (Removed: previous code auto-inserted a header banner if missing. That
  // ran on every load, so deleting the banner caused it to reappear on
  // refresh. New users still get a banner via defaultBlocksFor.)

  // Ensure a single businessName sits right after the header banner. Older
  // invoice templates dropped it at the end of the document; normalise.
  const businessIdxs = migrated
    .map((b, i) => (b.type === 'businessName' ? i : -1))
    .filter((i) => i >= 0)
  if (businessIdxs.length > 0) {
    const first = migrated[businessIdxs[0]]
    const without = migrated.filter((b) => b.type !== 'businessName')
    const bannerIdx = without.findIndex((b) => b.type === 'headerBanner')
    const insertAt = bannerIdx >= 0 ? bannerIdx + 1 : 0
    migrated = [...without.slice(0, insertAt), first, ...without.slice(insertAt)]
  }

  void surface
  return migrated
}

// Replace em-dashes and en-dashes with plain hyphens in any user-visible text
// fields. The product voice avoids them; this catches them in persisted data
// without forcing users through a manual reset.
function stripDashes(block: Block): Block {
  const swap = (s: string | undefined) =>
    typeof s === 'string' ? s.replace(/—|–/g, '-') : s
  switch (block.type) {
    case 'text':
      return { ...block, text: swap(block.text) ?? block.text }
    case 'title':
      return {
        ...block,
        title: swap(block.title) ?? block.title,
        subtitle: swap(block.subtitle) ?? block.subtitle,
      }
    case 'action':
      return {
        ...block,
        primary: swap(block.primary) ?? block.primary,
        secondary: block.secondary == null ? null : swap(block.secondary) ?? block.secondary,
      }
    default:
      return block
  }
}
