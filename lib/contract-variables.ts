import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import DOMPurify from 'isomorphic-dompurify'
import type { JSONContent } from '@tiptap/react'

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
  { id: 'total_amount', label: 'Total amount', description: 'Total from the linked quote' },
  { id: 'deposit_amount', label: 'Deposit amount', description: 'Deposit owed (default 25% of total)' },
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
  if (!dateStr) return '—'
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

function calcQuoteTotal(q: {
  subtotal: number
  tax_rate: number | null
  discount_type: 'percentage' | 'fixed' | null
  discount_value: number | null
}): number {
  const sub = Number(q.subtotal) || 0
  const discount =
    q.discount_type === 'percentage'
      ? (sub * Number(q.discount_value || 0)) / 100
      : q.discount_type === 'fixed'
      ? Number(q.discount_value || 0)
      : 0
  const taxable = sub - discount
  const tax = (taxable * Number(q.tax_rate || 0)) / 100
  return Math.max(0, taxable + tax)
}

export function buildContractVariables(input: {
  couple: { name: string; email: string | null }
  firstEvent: { date: string | null; venue: string | null } | null
  quote: {
    subtotal: number
    tax_rate: number | null
    discount_type: 'percentage' | 'fixed' | null
    discount_value: number | null
  } | null
  userMeta: Record<string, unknown>
  depositPercent: number
}): ContractVariableValues {
  const total = input.quote ? calcQuoteTotal(input.quote) : 0
  const deposit = (total * (input.depositPercent || 25)) / 100

  return {
    couple_name: input.couple.name || '—',
    couple_email: input.couple.email || '—',
    event_date: formatDate(input.firstEvent?.date ?? null),
    venue: input.firstEvent?.venue || '—',
    total_amount: input.quote ? formatCurrency(total) : '—',
    deposit_amount: input.quote ? formatCurrency(deposit) : '—',
    mc_business_name: (input.userMeta.business_name as string) || '—',
    mc_signature_name:
      (input.userMeta.mc_signature_name as string) ||
      (input.userMeta.display_name as string) ||
      (input.userMeta.business_name as string) ||
      '—',
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
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
      'strong', 'em', 'u', 's', 'br', 'a', 'blockquote', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre', 'span',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  })
}
