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
      return { id: newId('li'), type: 'lineItems', showAddPlaceholder: true }
    case 'totals':
      return { id: newId('to'), type: 'totals', taxRate: 10, showSubtotal: true }
    case 'message':
      return { id: newId('ms'), type: 'message', text: 'Add a message to your client.', style: 'card' }
    case 'action':
      return { id: newId('ac'), type: 'action', primary: 'Submit', secondary: null }
    case 'divider':
      return { id: newId('dv'), type: 'divider' }
  }
}

// ── Curated styles ────────────────────────────────────────────────────────────
// Intentional overrides that give the starter template a designed feel.
// Kept minimal so theme/font changes still flow through cleanly.

const HERO_TITLE: TextStyle = {
  fontSize: 44,
  letterSpacing: -0.025,
  lineHeight: 1.05,
}

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

export function defaultBlocksFor(surface: 'quote' | 'invoice' | 'contract'): Block[] {
  if (surface === 'quote') {
    return [
      { id: newId('bn'), type: 'businessName' },
      {
        id: newId('tt'),
        type: 'title',
        title: 'Your wedding, hosted.',
        subtitle: 'ALEX & JORDAN  ·  14 SEPTEMBER 2026',
        showRef: true,
        showExpires: true,
        showAbn: false,
        titleStyle: HERO_TITLE,
        subtitleStyle: HERO_SUBTITLE,
      },
      { id: newId('li'), type: 'lineItems', showAddPlaceholder: true },
      {
        id: newId('to'),
        type: 'totals',
        taxRate: 10,
        showSubtotal: true,
        totalStyle: EMPHASIZED_TOTAL,
      },
      { id: newId('dv'), type: 'divider', ...SOFT_DIVIDER },
      {
        id: newId('ms'),
        type: 'message',
        style: 'card',
        text: 'Thanks for thinking of me for your day. The deposit secures the date - happy to jump on a call before you decide.',
        textStyle: SOFT_MESSAGE,
      },
      { id: newId('ac'), type: 'action', primary: 'Accept quote', secondary: 'Decline' },
    ]
  }
  if (surface === 'invoice') {
    return [
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
      { id: newId('li'), type: 'lineItems', showAddPlaceholder: true },
      {
        id: newId('to'),
        type: 'totals',
        taxRate: 10,
        showSubtotal: true,
        totalStyle: EMPHASIZED_TOTAL,
      },
      {
        id: newId('ms'),
        type: 'message',
        style: 'plain',
        text: 'Payment due within 14 days. Bank details on the next page, or pay by card below.',
        textStyle: SOFT_MESSAGE,
      },
      { id: newId('ac'), type: 'action', primary: 'Pay with card', secondary: null },
    ]
  }
  // contract
  return [
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
    { id: newId('dv'), type: 'divider', ...SOFT_DIVIDER },

    {
      id: newId('ms'),
      type: 'message',
      style: 'card',
      text:
        'PARTIES\n\nMC: [Your business name], [ABN], of [your address] ("the MC").\n\nClient: Alex & Jordan, of [client address] ("the Clients").\n\nThis agreement is effective from the date the Clients sign below and continues until all obligations under it have been performed.',
      textStyle: SOFT_MESSAGE,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'card',
      text:
        'EVENT DETAILS\n\nDate: Saturday, 14 September 2026\nVenue: The Glasshouse, Sydney NSW\nCeremony start: 3:00 PM\nReception start: 5:30 PM\nMC finish: 11:00 PM\nExpected guests: 110',
      textStyle: SOFT_MESSAGE,
    },

    { id: newId('dv'), type: 'divider', ...SOFT_DIVIDER },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '1. SERVICES\n\nThe MC will host the ceremony and reception on the date set out above. Services include: a pre-event planning consultation, agenda and run-sheet preparation, a final confirmation call within seven (7) days of the event, professional MC duties from the agreed call time, coordination with the venue, photographer, videographer, celebrant and band or DJ, and presenting all formalities through to the final speech or last dance.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '2. EQUIPMENT & TECHNICAL\n\nThe MC will arrive no later than ninety (90) minutes before the agreed call time to sound-check microphones, review staging and confirm the run-sheet with the venue. The Clients are responsible for ensuring the venue provides a functional sound system with at least one wireless microphone, or for advising the MC if the MC must supply this equipment for an additional fee.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '3. FEES & PAYMENT SCHEDULE\n\nThe total fee for the services is set out in the attached invoice (the "Total Fee"). The Clients agree to pay:\n\n  (a) a non-refundable deposit of twenty-five percent (25%) of the Total Fee on signing this agreement, which secures the date; and\n  (b) the remaining balance no later than fourteen (14) days before the event date.\n\nPayments may be made by bank transfer or credit card. Late payments accrue interest at 2% per month or part-month from the due date.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '4. CANCELLATION BY THE CLIENTS\n\nIf the Clients cancel this agreement, the following fees apply:\n\n  (a) more than 90 days before the event: deposit forfeited;\n  (b) between 60 and 90 days before the event: 50% of the Total Fee;\n  (c) between 14 and 60 days before the event: 75% of the Total Fee;\n  (d) within 14 days of the event: 100% of the Total Fee.\n\nAll cancellations must be made in writing.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '5. CANCELLATION BY THE MC\n\nIf the MC is unable to perform on the event date for any reason within the MC\'s control, the MC will use reasonable efforts to provide a suitably qualified replacement MC acceptable to the Clients. If no replacement can be arranged, all amounts paid by the Clients will be refunded in full within seven (7) days. The MC\'s liability is limited to that refund.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '6. POSTPONEMENT\n\nThe Clients may postpone the event once at no additional charge, subject to the MC\'s availability on the new date and provided written notice is given at least thirty (30) days before the original event date. A second postponement is treated as a cancellation under clause 4.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '7. FORCE MAJEURE\n\nNeither party is liable for failure to perform this agreement where performance is prevented by circumstances beyond that party\'s reasonable control, including (without limitation) illness, injury, government order, pandemic, natural disaster or transport failure. If a force majeure event prevents performance, fees already paid will be credited toward a rescheduled date within twelve (12) months of the original event date.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '8. CONDUCT, BREAKS & OVERTIME\n\nThe MC will conduct themselves professionally at all times. The Clients agree to provide a meal and non-alcoholic refreshments for the MC during the event. Performances run for the period set out in the Event Details. If the Clients request the MC to continue beyond the agreed finish time, an overtime fee of $200 per hour or part-hour applies, payable on the night.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '9. RECORDINGS, IMAGES & MARKETING\n\nThe Clients grant the MC a non-exclusive, royalty-free licence to use photographs, audio and video from the event for portfolio, social media and marketing purposes. The Clients may opt out of this clause by giving written notice before the event, in which case the MC will not publish any identifying material from the event.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '10. INSURANCE, LIABILITY & INDEMNITY\n\nThe MC holds current public liability insurance to the value of AUD $20,000,000. The MC\'s total liability under this agreement is limited to the fees actually paid by the Clients. Neither party is liable for indirect, special or consequential loss, including loss of profit or loss of enjoyment. Each party indemnifies the other against any third-party claim arising from that party\'s own negligence or breach of this agreement.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '11. CONFIDENTIALITY\n\nThe MC will treat as confidential any personal information, family details or sensitive content shared during the planning of the event, except to the extent disclosure is required to deliver the services or by law.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '12. VARIATIONS & ENTIRE AGREEMENT\n\nAny variation to this agreement must be in writing and signed by both parties. This document, together with the attached invoice, constitutes the entire agreement between the parties and supersedes all prior discussions, proposals or correspondence relating to the event.',
      textStyle: CONTRACT_TERMS,
    },

    {
      id: newId('ms'),
      type: 'message',
      style: 'plain',
      text:
        '13. DISPUTE RESOLUTION & GOVERNING LAW\n\nThe parties will attempt to resolve any dispute by good-faith discussion. If a dispute is not resolved within thirty (30) days, the parties agree to attempt mediation before any court proceedings. This agreement is governed by the laws of New South Wales, Australia, and the parties submit to the non-exclusive jurisdiction of its courts.',
      textStyle: CONTRACT_TERMS,
    },

    { id: newId('dv'), type: 'divider', ...SOFT_DIVIDER },

    {
      id: newId('ms'),
      type: 'message',
      style: 'card',
      text:
        'SIGNATURES\n\nBy clicking "Sign contract" below, the Clients confirm they have read, understood and accept the terms of this agreement on behalf of both parties to the marriage.\n\nClient signature: ______________________________     Date: __________\n\nMC signature: ______________________________     Date: __________\n\nA counter-signed copy will be returned within two (2) business days.',
      textStyle: SOFT_MESSAGE,
    },

    { id: newId('ac'), type: 'action', primary: 'Sign contract', secondary: null },
  ]
}
