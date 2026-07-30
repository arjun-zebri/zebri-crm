import Mention from '@tiptap/extension-mention'
import { generateHTML } from '@tiptap/html'
import type { JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import sanitizeHtml from 'sanitize-html'

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
  { id: 'total_amount', label: 'Total amount', description: 'Total from the linked proposal' },
  { id: 'deposit_amount', label: 'Deposit amount', description: 'First payment on the schedule' },
  { id: 'mc_business_name', label: 'Your business name', description: 'Your business name from settings' },
  { id: 'mc_signature_name', label: 'Your signature name', description: 'Your typed signature name from settings' },
  { id: 'today', label: "Today's date", description: 'Date the contract was sent' },
]

export const VARIABLE_IDS = new Set(CONTRACT_VARIABLES.map((v) => v.id))

export interface ContractVariableValues {
  couple_name: string
  couple_email: string
  event_date: string
  venue: string
  total_amount: string
  deposit_amount: string
  mc_business_name: string
  mc_signature_name: string
  today: string
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

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}

export function buildContractVariables(input: {
  couple: { name: string; email: string | null }
  firstEvent: { date: string | null; venue: string | null } | null
  /** Linked ACCEPTED proposal. `total` is the recorded selection's subtotal. */
  proposal?: { total: number } | null
  /**
   * First stage of the schedule that will govern this contract's invoice.
   * Sourced from the invoice's stages when one exists, otherwise from the MC's
   * default saved schedule resolved against the proposal total. Null means the
   * MC has no schedule at all, in which case the contract cannot state a
   * deposit figure and renders a dash.
   */
  firstStage: { amountCents: number; dueDate: string | null } | null
  userMeta: Record<string, unknown>
}): ContractVariableValues {
  const total = input.proposal ? Number(input.proposal.total) || 0 : 0
  const hasMoneySource = !!input.proposal

  return {
    couple_name: input.couple.name || '-',
    couple_email: input.couple.email || '-',
    event_date: formatDate(input.firstEvent?.date ?? null),
    venue: input.firstEvent?.venue || '-',
    total_amount: hasMoneySource ? formatCurrency(total) : '-',
    deposit_amount:
      hasMoneySource && input.firstStage
        ? formatCurrency(input.firstStage.amountCents / 100)
        : '-',
    mc_business_name: (input.userMeta.business_name as string) || '-',
    mc_signature_name:
      (input.userMeta.mc_signature_name as string) ||
      (input.userMeta.display_name as string) ||
      (input.userMeta.business_name as string) ||
      '-',
    today: formatDate(new Date().toISOString().slice(0, 10)),
  }
}

// Walk TipTap JSON and replace every mention node with a text node containing
// the substituted value. This way generateHTML renders the literal string.
function substituteMentions(node: JSONContent, vars: ContractVariableValues): JSONContent {
  if (node.type === 'mention' && node.attrs?.id) {
    const id = node.attrs.id as keyof ContractVariableValues
    const value = vars[id] ?? `{{${id}}}`
    return { type: 'text', text: String(value) }
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map((c) => substituteMentions(c, vars)) }
  }
  return node
}

export function renderContractHtml(contentJson: JSONContent, vars: ContractVariableValues): string {
  const substituted = substituteMentions(contentJson, vars)
  const raw = generateHTML(substituted, [
    StarterKit,
    Mention.configure({
      HTMLAttributes: { class: 'inline-block rounded bg-gray-100 px-1.5 py-0.5 text-sm' },
    }),
  ])
  return sanitizeHtml(raw, {
    allowedTags: [
      'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
      'strong', 'em', 'u', 's', 'br', 'a', 'blockquote', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre', 'span',
    ],
    allowedAttributes: { '*': ['href', 'target', 'rel', 'class'] },
  })
}
