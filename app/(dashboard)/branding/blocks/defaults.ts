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
    case 'contractBody':
      return { id: newId('cb'), type: 'contractBody', locked: true }
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
  // contract — minimal chrome scaffold. The contract body is
  // written by the MC per-couple in the builder modal's TipTap
  // editor and renders at the `contractBody` marker. MCs can add
  // any other chrome blocks they want (title, custom intro text,
  // divider, footer, etc) above or below the marker; this default
  // stays intentionally lean so MCs aren't fighting pre-canned
  // structure they didn't ask for.
  return [
    { id: newId('hb'), type: 'headerBanner' },
    { id: newId('bn'), type: 'businessName' },
    { id: newId('cb'), type: 'contractBody', locked: true },
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

  // Contract surface migration (Phase 3.1):
  // Old default for the contract surface inserted ~13 text blocks
  // carrying the full contract template (PARTIES / SERVICES /
  // CANCELLATION / etc). Those duplicated whatever the MC wrote in
  // the per-couple builder modal. Replace the body-content blocks
  // with a single `contractBody` marker; keep chrome (header,
  // business name, title, footer). Idempotent — runs harmlessly
  // when the data is already in the new shape.
  if (surface === 'contract') {
    const hasMarker = migrated.some((b) => b.type === 'contractBody')
    if (!hasMarker) {
      // Heuristic: any text block whose content matches the old
      // template's distinctive headings (PARTIES / EVENT DETAILS /
      // numbered clauses / SIGNATURES) was canned content from the
      // previous default. Strip them. Custom text blocks the MC
      // added themselves should NOT trip this — we only match
      // start-of-string against the old default's headings.
      const oldDefaultPattern = /^(PARTIES|EVENT DETAILS|\d+\.\s+[A-Z][A-Z &,]+|SIGNATURES)\b/
      const chrome = migrated.filter(
        (b) => b.type !== 'text' || !oldDefaultPattern.test((b as { text?: string }).text ?? ''),
      )
      // Drop the action + standalone dividers that bracketed the
      // old template's signature section — they're chrome but
      // semantically tied to the body content we just removed.
      const cleaned = chrome.filter((b, i, arr) => {
        if (b.type === 'action' && b.primary === 'Sign contract') return false
        if (b.type === 'divider') {
          // Drop dividers adjacent to where the text blocks used
          // to be. Heuristic: a divider with no other content next
          // to it is residue from the stripped template.
          const prev = arr[i - 1]
          const next = arr[i + 1]
          if (!prev || !next) return false
          if (prev.type === 'divider' || next.type === 'divider') return false
        }
        return true
      })
      // Insert the marker after the title block (if present),
      // else after the businessName block, else at the end.
      const titleIdx = cleaned.findIndex((b) => b.type === 'title')
      const businessIdx = cleaned.findIndex((b) => b.type === 'businessName')
      const insertAt =
        titleIdx >= 0
          ? titleIdx + 1
          : businessIdx >= 0
            ? businessIdx + 1
            : cleaned.length
      const marker: Block = {
        id: `cb_${Math.random().toString(36).slice(2, 9)}`,
        type: 'contractBody',
        locked: true,
      }
      migrated = [
        ...cleaned.slice(0, insertAt),
        marker,
        ...cleaned.slice(insertAt),
      ]
    }
  }

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
