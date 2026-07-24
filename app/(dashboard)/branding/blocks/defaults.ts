import type { Block, BlockType } from './types'

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
      // Empty by default so the prompt shows as editor placeholder only and
      // an untouched text block renders nothing on the public document.
      return { id: newId('tx'), type: 'text', text: '' }
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
    case 'proposalBody':
      return { id: newId('pb'), type: 'proposalBody', locked: true }
    case 'packageHeader':
      return { id: newId('ph'), type: 'packageHeader' }
    case 'packageDetails':
      return { id: newId('pd2'), type: 'packageDetails' }
    case 'packageInclusions':
      return { id: newId('pi'), type: 'packageInclusions' }
    case 'packageTotals':
      return { id: newId('pt'), type: 'packageTotals' }
    case 'vendorTimelineBody':
      return { id: newId('vt'), type: 'vendorTimelineBody', locked: true }
    case 'questionnaireBody':
      return { id: newId('qb'), type: 'questionnaireBody', locked: true, mode: 'form' }
    case 'image':
      return { id: newId('im'), type: 'image', fit: 'cover', heightPx: 160 }
    case 'spacer':
      return { id: newId('sp'), type: 'spacer', heightPx: 32 }
  }
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export function defaultBlocksFor(surface: 'proposal' | 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire'): Block[] {
  if (surface === 'portal') {
    return [
      { id: newId('bn'), type: 'businessName' },
      { id: newId('cp'), type: 'couplePortal', locked: true },
    ]
  }
  if (surface === 'proposal') {
    return [
      { id: newId('bn'), type: 'businessName' },
      { id: newId('ph'), type: 'packageHeader' },
      { id: newId('pd2'), type: 'packageDetails' },
      { id: newId('pi'), type: 'packageInclusions' },
      { id: newId('pt'), type: 'packageTotals' },
      { id: newId('ac'), type: 'action', primary: 'Accept & reserve our date', secondary: null },
      { id: newId('ft'), type: 'footer', closingNote: 'Thank you for thinking of us.' },
    ]
  }
  if (surface === 'invoice') {
    // Only what an invoice cannot be an invoice without: who it is from, what
    // it is, what is owed, and how to pay. No banner, and no pre-written prose
    // the MC did not ask for. Everything else stays one click away in the
    // block palette.
    //
    // The title carries NO subtitle. It used to ship a sample one, and since
    // the public renderer has no slot to override it, that placeholder was
    // rendering verbatim on real invoices sent to real couples.
    return [
      { id: newId('bn'), type: 'businessName' },
      {
        id: newId('tt'),
        type: 'title',
        title: 'Invoice',
        subtitle: '',
        showRef: true,
        showExpires: true,
        showAbn: true,
      },
      { id: newId('li'), type: 'lineItems', colSpread: true },
      {
        id: newId('to'),
        type: 'totals',
        taxRate: 10,
        showSubtotal: true,
      },
      { id: newId('ps'), type: 'paymentSchedule', locked: true },
      { id: newId('pd'), type: 'paymentDetails', heading: 'Bank transfer', accountName: 'Your business name', bsb: '000-000', accountNumber: '0000 0000' },
      { id: newId('ac'), type: 'action', primary: 'Pay with card', secondary: null },
      { id: newId('ft'), type: 'footer', closingNote: 'Thank you for choosing us.' },
    ]
  }
  if (surface === 'vendorTimeline') {
    return [
      { id: newId('bn'), type: 'businessName' },
      { id: newId('vt'), type: 'vendorTimelineBody', locked: true },
    ]
  }
  if (surface === 'questionnaire') {
    return [
      { id: newId('bn'), type: 'businessName' },
      blockTemplate('questionnaireBody'),
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
    { id: newId('bn'), type: 'businessName' },
    { id: newId('cb'), type: 'contractBody', locked: true },
  ]
}

/**
 * Migrate persisted block data from older shapes (e.g. type: 'message') to the
 * current schema. Safe to run on every load.
 */
export function migrateBlocks(blocks: unknown, surface?: 'proposal' | 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire'): Block[] {
  if (!Array.isArray(blocks)) return []
  let migrated = blocks
    .map((raw): Block | null => {
      if (!raw || typeof raw !== 'object') return null
      const b = raw as Record<string, unknown> & { type?: string }
      if (b.type === 'headerBanner') {
        // Spec §6: banner block is deleted; migrate to an image block, keeping
        // whatever image/positioning fields it carried.
        return stripDashes({ ...(b as object), type: 'image' } as unknown as Block)
      }
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

  // (Removed: previous code force-moved businessName to the top on every load,
  // so the "My details" block jumped to the top on refresh. Blocks now keep
  // whatever order the user arranged.)

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

  // Proposal surface migration: expand any surviving `proposalBody` marker
  // into the four real package blocks (header, details, inclusions, totals).
  if (surface === 'proposal') {
    migrated = expandProposalBody(migrated)
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

/**
 * Spec §6: expand a legacy `proposalBody` marker into the four real package
 * blocks (header, details, optional inclusions, totals) in place. The Accept
 * CTA is the existing `action` block that already sits after the marker; we do
 * not synthesise one here (readiness flags its absence). Idempotent: a tree
 * with no `proposalBody` is returned unchanged.
 */
export function expandProposalBody(blocks: Block[]): Block[] {
  const idx = blocks.findIndex((b) => b.type === 'proposalBody')
  if (idx < 0) return blocks
  const pkg: Block[] = [
    blockTemplate('packageHeader'),
    blockTemplate('packageDetails'),
    blockTemplate('packageInclusions'),
    blockTemplate('packageTotals'),
  ]
  // Drop the marker and any duplicate proposalBody markers further down.
  const rest = blocks.filter((b) => b.type !== 'proposalBody')
  return [...rest.slice(0, idx), ...pkg, ...rest.slice(idx)]
}
