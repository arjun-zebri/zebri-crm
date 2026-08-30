import type { JSONContent } from '@tiptap/core'

import { htmlToPlainText } from '@/lib/branding/sanitize'
import type { SurfaceTab } from '@/types/branding-preview'

import type { Block, BlockType, FormFieldBlock, FormFieldInputType, FormFieldRole } from './types'

/** Build a single-paragraph rich-text doc from a plain string (empty = blank paragraph). */
function textDoc(s: string): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph', ...(s ? { content: [{ type: 'text', text: s }] } : {}) }] }
}

/**
 * Plain text of a rich-text field value, whether a legacy HTML string or a
 * TipTap JSON doc. Used by the contract migration heuristic, which matches the
 * old template's headings against a text block's content.
 */
function richPlainText(value: unknown): string {
  if (typeof value === 'string') return htmlToPlainText(value)
  if (!value || typeof value !== 'object') return ''
  const node = value as { text?: string; content?: unknown[] }
  if (typeof node.text === 'string') return node.text
  if (Array.isArray(node.content)) return node.content.map(richPlainText).join('')
  return ''
}

let counter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

/**
 * Default primary/secondary labels for an action block. Every surface pays,
 * with no decline.
 */
export function actionDefaults(): { primary: string; secondary: string | null } {
  return { primary: 'Pay now', secondary: null }
}

export function blockTemplate(type: BlockType, surface?: SurfaceTab): Block {
  switch (type) {
    case 'headerBanner':
      return { id: newId('hb'), type: 'headerBanner' }
    case 'businessName':
      return { id: newId('bn'), type: 'businessName' }
    case 'tagline':
      return { id: newId('tg'), type: 'tagline' }
    case 'title':
      // A contract is signed, not quoted or billed, so no customer-facing
      // "Expires" date: `contracts.expires_at` is a signing deadline, not a
      // term, and labelling it "Expires" reads as the agreement lapsing.
      // The reference and ABN DO belong on an agreement: the ref identifies
      // the document and the ABN identifies the supplier as a legal party.
      // The header then reads as the contract title + couple name.
      if (surface === 'contract') {
        return {
          id: newId('tt'),
          type: 'title',
          title: 'Contract',
          showCoupleName: true,
          showRef: true,
          showExpires: false,
          showAbn: true,
        }
      }
      return {
        id: newId('tt'),
        type: 'title',
        title: 'Document title',
        showCoupleName: true,
        showRef: true,
        showExpires: true,
        showAbn: false,
      }
    case 'lineItems':
      return { id: newId('li'), type: 'lineItems', colSpread: true }
    case 'totals':
      return { id: newId('to'), type: 'totals', taxRate: 10, showSubtotal: true, colSpread: true }
    case 'text':
      // Empty rich-text doc by default so the prompt shows as editor placeholder
      // only and an untouched text block renders nothing on the public document.
      return { id: newId('tx'), type: 'text', text: textDoc('') }
    case 'action':
      return { id: newId('ac'), type: 'action', ...actionDefaults() }
    case 'divider':
      return { id: newId('dv'), type: 'divider' }
    case 'footer':
      return { id: newId('ft'), type: 'footer', closingNote: textDoc('Thank you for choosing us.') }
    case 'paymentDetails':
      return { id: newId('pd'), type: 'paymentDetails', heading: textDoc('Bank transfer'), accountName: 'Your business name', bsb: '000-000', accountNumber: '0000 0000' }
    case 'couplePortal':
      return { id: newId('cp'), type: 'couplePortal', locked: true }
    case 'paymentSchedule':
      return { id: newId('ps'), type: 'paymentSchedule' }
    case 'contractBody':
      return { id: newId('cb'), type: 'contractBody', locked: true }
    case 'contractSign':
      return { id: newId('cs'), type: 'contractSign', locked: true }
    case 'vendorTimelineBody':
      return { id: newId('vt'), type: 'vendorTimelineBody', locked: true }
    case 'questionnaireOneAtATime':
      // Locked so it can't be duplicated; still deletable + re-addable as a
      // clearable marker (the MC swaps form styles by deleting one, adding the
      // other). See policy.CLEARABLE_MARKERS.
      return { id: newId('q1'), type: 'questionnaireOneAtATime', locked: true }
    case 'questionnaireAllOnePage':
      return { id: newId('qa'), type: 'questionnaireAllOnePage', locked: true }
    case 'image':
      return { id: newId('im'), type: 'image', fit: 'cover', heightPx: 160 }
    case 'spacer':
      return { id: newId('sp'), type: 'spacer', heightPx: 32 }
    case 'formField':
      // A fresh field seeds as a required Name so a lead always yields a couple
      // name (the one couple-required column). The MC changes role/type/label
      // from the field controls.
      return {
        id: newId('ff'), type: 'formField',
        role: 'name', inputType: 'text',
        label: 'Your name', required: true,
      }
    case 'formSubmit':
      // Locked so it can't be duplicated; still deletable + re-addable as a
      // clearable marker singleton (see policy.CLEARABLE_MARKERS / EXACTLY_ONE).
      return {
        id: newId('fs'), type: 'formSubmit', locked: true,
        label: 'Send enquiry',
        successMessage: 'Thanks! Your enquiry has been sent. We will be in touch soon.',
      }
  }
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export function defaultBlocksFor(surface: 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire' | 'lead'): Block[] {
  if (surface === 'lead') {
    // Mirrors the fixed-field fallback form on the public /lead/[token] page:
    // same questions, same order, same labels, so customising starts from
    // exactly what the couple already sees. Required matches what the couple
    // must fill in there (name + email). Every field maps to a couple column
    // via `role`; the MC can add/remove/reorder fields and add custom ones.
    const field = (
      role: FormFieldRole, inputType: FormFieldInputType, label: string,
      required = false,
    ): FormFieldBlock => ({ id: newId('ff'), type: 'formField', role, inputType, label, required })
    return [
      { id: newId('bn'), type: 'businessName' },
      {
        id: newId('tx'),
        type: 'text',
        text: textDoc(
          "Planning your wedding? Tell me a little about your day below and I'll be in touch soon.",
        ),
      },
      field('name', 'text', 'Your name', true),
      field('partnerName', 'text', "Partner's name"),
      field('email', 'email', 'Email', true),
      field('phone', 'tel', 'Phone'),
      field('weddingDate', 'date', 'Wedding date'),
      field('venue', 'text', 'Venue'),
      field('referral', 'text', 'How did you hear about me?'),
      field('message', 'textarea', 'Message'),
      blockTemplate('formSubmit'),
    ]
  }
  if (surface === 'portal') {
    return [
      { id: newId('bn'), type: 'businessName' },
      { id: newId('cp'), type: 'couplePortal', locked: true },
    ]
  }
  if (surface === 'invoice') {
    // Only what an invoice cannot be an invoice without: who it is from, what
    // it is, what is owed, and how to pay. No banner, and no pre-written prose
    // the MC did not ask for. Everything else stays one click away in the
    // block palette.
    //
    // The subtitle is the couple's real name (opt-in via the Include dropdown),
    // sourced from document data — never free text — so nothing placeholder-ish
    // can render on a real invoice. Off by default to preserve the historically
    // subtitle-free invoice header until the MC turns it on.
    return [
      { id: newId('bn'), type: 'businessName' },
      {
        id: newId('tt'),
        type: 'title',
        title: 'Invoice',
        showCoupleName: false,
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
      { id: newId('ps'), type: 'paymentSchedule' },
      { id: newId('pd'), type: 'paymentDetails', heading: textDoc('Bank transfer'), note: 'Please transfer the total to the account below.', accountName: 'Your business name', bsb: '000-000', accountNumber: '0000 0000' },
      { id: newId('ac'), type: 'action', primary: 'Pay now', secondary: null, note: 'Or pay securely online with your card.' },
      { id: newId('ft'), type: 'footer', closingNote: textDoc('Thank you for choosing us.') },
    ]
  }
  if (surface === 'vendorTimeline') {
    return [
      { id: newId('bn'), type: 'businessName' },
      { id: newId('vt'), type: 'vendorTimelineBody', locked: true },
    ]
  }
  if (surface === 'questionnaire') {
    // Seed the "All on one page" form so a new questionnaire starts in a valid
    // (exactly-one) state. This maps to the old default presentation (mode:
    // 'form'). The MC can swap to "One at a time" from the block palette.
    return [
      { id: newId('bn'), type: 'businessName' },
      blockTemplate('questionnaireAllOnePage'),
    ]
  }
  // contract — minimal chrome scaffold: business identity, a contract
  // header, the body marker, then the sign marker. The contract body is
  // written by the MC per-couple in the builder modal's TipTap editor and
  // renders at the `contractBody` marker; the sign/decline form + MC
  // countersignature render at the `contractSign` marker below it. MCs can
  // add any other chrome blocks they want (custom intro text, divider,
  // footer, etc) above, below, or between the markers; this default stays
  // lean so MCs aren't fighting pre-canned structure they didn't ask for.
  return [
    { id: newId('bn'), type: 'businessName' },
    {
      id: newId('tt'),
      type: 'title',
      title: 'Contract',
      showCoupleName: true,
      showRef: true,
      showExpires: false,
      showAbn: true,
    },
    { id: newId('cb'), type: 'contractBody', locked: true },
    { id: newId('cs'), type: 'contractSign', locked: true },
  ]
}

/**
 * Migrate persisted block data from older shapes (e.g. type: 'message') to the
 * current schema. Safe to run on every load.
 */
export function migrateBlocks(blocks: unknown, surface?: 'invoice' | 'contract' | 'portal' | 'vendorTimeline' | 'questionnaire' | 'lead'): Block[] {
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
      if (b.type === 'questionnaireBody') {
        // The single questionnaireBody marker (with a `mode` toggle) is replaced
        // by two form-style marker blocks. Map by the old mode, preserving the
        // block id + all frame styling; drop the now-meaningless `mode` field.
        const { mode, ...rest } = b as Record<string, unknown>
        const type = mode === 'oneAtATime' ? 'questionnaireOneAtATime' : 'questionnaireAllOnePage'
        return stripDashes({ ...(rest as object), type } as unknown as Block)
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

  // Invoices can be paid but not declined, so an action block on the invoice
  // surface never carries a secondary button. Clear any legacy one.
  if (surface === 'invoice') {
    migrated = migrated.map((b) =>
      b.type === 'action' && b.secondary !== null ? ({ ...b, secondary: null } as Block) : b,
    )
  }

  // Contract surface migration (Phase 3.1):
  // Old default for the contract surface inserted ~13 text blocks
  // carrying the full contract template (PARTIES / SERVICES /
  // CANCELLATION / etc). Those duplicated whatever the MC wrote in
  // the per-couple builder modal. Replace the body-content blocks
  // with a single `contractBody` marker; keep chrome (header,
  // business name, title, footer). Idempotent — runs harmlessly
  // when the data is already in the new shape.
  //
  // Heuristic: any text block whose content matches the old template's
  // distinctive headings (PARTIES / EVENT DETAILS / numbered clauses /
  // SIGNATURES) was canned content from the previous default. Custom
  // text blocks the MC wrote themselves do NOT trip this — we only
  // match start-of-string against the old default's headings.
  if (surface === 'contract') {
    const oldDefaultPattern = /^(PARTIES|EVENT DETAILS|\d+\.\s+[A-Z][A-Z &,]+|SIGNATURES)\b/
    const hasMarker = migrated.some((b) => b.type === 'contractBody')
    const hadLegacyTemplate = migrated.some(
      (b) => b.type === 'text' && oldDefaultPattern.test(richPlainText((b as { text?: unknown }).text).trimStart()),
    )
    // Only heal a genuine legacy contract (the pre-Phase-3.1 inline
    // template). A modern contract with no marker is one the MC cleared
    // via "Clear all blocks" — leave it marker-less so the removal
    // sticks. The body is re-addable from the block palette, and the
    // readiness panel flags its absence until it returns.
    if (!hasMarker && hadLegacyTemplate) {
      const chrome = migrated.filter(
        (b) => b.type !== 'text' || !oldDefaultPattern.test(richPlainText((b as { text?: unknown }).text).trimStart()),
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
      // Upgrade a legacy plain-string body to a rich-text JSON doc so the editor
      // (which expects TipTap JSON) can load it. HTML tags in the old string are
      // reduced to plain text; new content already arrives as JSON and passes
      // through untouched.
      if (typeof block.text === 'string') {
        return { ...block, text: textDoc(htmlToPlainText(block.text)) }
      }
      return block
    case 'footer':
      // Same upgrade for the footer's closing note (now rich text).
      if (typeof block.closingNote === 'string') {
        return { ...block, closingNote: textDoc(htmlToPlainText(block.closingNote)) }
      }
      return block
    case 'paymentDetails':
      // Same upgrade for the payment-details heading (now rich text).
      if (typeof block.heading === 'string') {
        return { ...block, heading: textDoc(htmlToPlainText(block.heading)) }
      }
      return block
    case 'title':
      return {
        ...block,
        title: swap(block.title) ?? block.title,
        // The free-text subtitle is retired in favour of the auto couple-name
        // line. Migrate intent: a block that had any subtitle text becomes a
        // shown couple-name line; an empty/absent one stays off. Idempotent —
        // once showCoupleName is set we leave it alone.
        showCoupleName:
          block.showCoupleName ?? (typeof block.subtitle === 'string' && block.subtitle.trim().length > 0),
      }
    case 'action':
      return {
        ...block,
        primary: swap(block.primary) ?? block.primary,
        secondary: block.secondary == null ? null : swap(block.secondary) ?? block.secondary,
      }
    case 'paymentSchedule':
      // The payment schedule is now a normal, selectable + deletable block (it
      // used to ship `locked`, which hid its toolbar entirely). Unlock any saved
      // instances so clicking it shows the toolbar and it can be removed/re-added.
      return block.locked ? { ...block, locked: false } : block
    default:
      return block
  }
}
