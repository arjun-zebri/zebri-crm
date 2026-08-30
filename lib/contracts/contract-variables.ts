import Mention from '@tiptap/extension-mention'
import { TableKit } from '@tiptap/extension-table'
import { generateHTML } from '@tiptap/html'
import type { JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import sanitizeHtml from 'sanitize-html'

import { resolveVendorRole } from '@/lib/branding/vendor-role'
import { coupleDisplayName } from '@/lib/couples/display-name'

export interface ContractVariable {
  id: string
  label: string
  description: string
}

export const CONTRACT_VARIABLES: ContractVariable[] = [
  { id: 'couple_name', label: 'Couple name', description: "The couple's full name" },
  { id: 'couple_email', label: 'Couple email', description: 'Primary email on the couple record' },
  { id: 'event_date', label: 'Event date', description: 'Earliest wedding event date' },
  { id: 'venue', label: 'Venue', description: 'Earliest event venue' },
  { id: 'mc_business_name', label: 'Your business name', description: 'Your business name from settings' },
  {
    id: 'vendor_role',
    label: 'Your role',
    description: 'MC, DJ or Celebrant, from your business type in settings',
  },
  { id: 'partner_1_name', label: 'Partner 1 name', description: "The first partner's name" },
  { id: 'partner_2_name', label: 'Partner 2 name', description: "The second partner's name" },
  { id: 'mc_abn', label: 'Your ABN', description: 'Your ABN from Branding settings' },
  { id: 'mc_email', label: 'Your email', description: 'The email address on your account' },
  { id: 'mc_phone', label: 'Your phone', description: 'Your phone number from settings' },
  { id: 'mc_website', label: 'Your website', description: 'Your website from settings' },
  { id: 'mc_address', label: 'Your address', description: 'Your business address from settings' },
  { id: 'mc_signature_name', label: 'Your signature name', description: 'Your typed signature name from settings' },
  { id: 'today', label: "Today's date", description: 'Date the contract was sent' },
]

export const VARIABLE_IDS = new Set(CONTRACT_VARIABLES.map((v) => v.id))

export interface ContractVariableValues {
  couple_name: string
  couple_email: string
  event_date: string
  venue: string
  mc_business_name: string
  vendor_role: string
  partner_1_name: string
  partner_2_name: string
  mc_abn: string
  mc_email: string
  mc_phone: string
  mc_website: string
  mc_address: string
  mc_signature_name: string
  today: string
}

/**
 * First non-blank value as a trimmed display string, or the dash placeholder.
 *
 * Takes several candidates because the dash is truthy: chaining with `||` on
 * an already-defaulted value would never reach the fallback.
 */
function text(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return '-'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Build the substitution values for a contract's mention variables.
 *
 * A contract has no linked money source, so the seven variables are all
 * derived from the couple, their first event, and the MC's own settings.
 */
export function buildContractVariables(input: {
  couple: {
    name: string
    email: string | null
    /** Split partner fields, so a clause can name one signatory. */
    primary_name?: string | null
    secondary_name?: string | null
  }
  firstEvent: { date: string | null; venue: string | null } | null
  userMeta: Record<string, unknown>
  /** The account holder's login email. Not held in user metadata. */
  userEmail?: string | null
}): ContractVariableValues {
  return {
    // Both partners in full. The legacy `name` column is often one partner's
    // first name, which is not who a service agreement binds.
    couple_name: coupleDisplayName(input.couple) || '-',
    couple_email: input.couple.email || '-',
    event_date: formatDate(input.firstEvent?.date ?? null),
    venue: input.firstEvent?.venue || '-',
    mc_business_name: (input.userMeta.business_name as string) || '-',
    vendor_role: resolveVendorRole(input.userMeta),
    // Fall back to the couple's display name for partner 1 so a contract for a
    // couple whose split fields were never filled in still reads sensibly.
    partner_1_name: text(input.couple.primary_name, input.couple.name),
    partner_2_name: text(input.couple.secondary_name),
    mc_abn: text(input.userMeta.abn),
    mc_email: text(input.userEmail),
    mc_phone: text(input.userMeta.phone),
    mc_website: text(input.userMeta.website),
    mc_address: text(input.userMeta.address_text),
    mc_signature_name:
      (input.userMeta.mc_signature_name as string) ||
      (input.userMeta.display_name as string) ||
      (input.userMeta.business_name as string) ||
      '-',
    today: formatDate(new Date().toISOString().slice(0, 10)),
  }
}

/**
 * Collect every mention id in a contract body that {@link buildContractVariables}
 * cannot resolve.
 *
 * Why this exists: {@link substituteMentions} falls back to rendering the raw
 * `{{id}}` token when a mention has no matching variable, which is invisible in
 * the editor (the chip still shows a friendly label) and only surfaces in the
 * document the couple receives. That shipped: the seeded default template
 * carried `total_amount` / `deposit_amount` mentions that were never in the
 * catalog, so real contracts went out with "{{total_amount}}" in the fee
 * clause. Send is now blocked on this check instead.
 *
 * @param contentJson - The contract body as TipTap JSON.
 * @returns Unknown mention ids, de-duplicated, in first-seen order.
 */
export function findUnknownVariables(contentJson: JSONContent): string[] {
  const unknown = new Set<string>()
  const walk = (node: JSONContent): void => {
    if (node.type === 'mention') {
      const id = node.attrs?.id
      if (typeof id === 'string' && !VARIABLE_IDS.has(id)) unknown.add(id)
    }
    node.content?.forEach(walk)
  }
  walk(contentJson)
  return [...unknown]
}

// Walk TipTap JSON and replace every mention node with a text node containing
// the substituted value. This way generateHTML renders the literal string.
function substituteMentions(node: JSONContent, vars: ContractVariableValues): JSONContent {
  if (node.type === 'mention' && node.attrs?.id) {
    const id = node.attrs.id as keyof ContractVariableValues
    const value = vars[id] ?? `{{${id}}}`
    // Carry the mention's own marks onto the substituted text, otherwise a
    // variable sitting inside italic or bold copy loses that formatting the
    // moment it is resolved and the surrounding run breaks in two.
    return { type: 'text', text: String(value), ...(node.marks ? { marks: node.marks } : {}) }
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map((c) => substituteMentions(c, vars)) }
  }
  return node
}

export function renderContractHtml(contentJson: JSONContent, vars: ContractVariableValues): string {
  const substituted = substituteMentions(contentJson, vars)
  // TableKit must be registered here too, not just in the editor: generateHTML
  // throws "Unknown node type: table" for any node whose extension is absent,
  // which would fail the send outright rather than degrade.
  const raw = generateHTML(substituted, [
    StarterKit,
    TableKit,
    Mention.configure({
      HTMLAttributes: { class: 'inline-block rounded-control bg-surface-emphasis px-1.5 py-0.5 text-body' },
    }),
  ])
  return sanitizeHtml(raw, {
    allowedTags: [
      'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
      'strong', 'em', 'u', 's', 'br', 'a', 'blockquote', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col',
      'code', 'pre', 'span',
    ],
    allowedAttributes: {
      '*': ['href', 'target', 'rel', 'class'],
      // Without these, sanitize-html silently drops merged cells and column
      // widths, so a table survives the round trip visually mangled.
      td: ['colspan', 'rowspan', 'colwidth'],
      th: ['colspan', 'rowspan', 'colwidth'],
      col: ['width', 'span'],
    },
  })
}
