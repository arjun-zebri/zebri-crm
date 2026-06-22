/**
 * Email-template variable catalogue (editor popover) + a sample
 * context for the library preview.
 *
 * The editor inserts a mention node whose `attrs.id` is the variable
 * expression carried here — a namespaced automation key, optionally
 * with a filter (e.g. `event.date | friendly`). At render time
 * `lib/email/templates` resolves it through the shared automation
 * resolver, so what the MC inserts is exactly what gets filled.
 *
 * The flat list is derived from the automation `VARIABLE_CATALOGUE`
 * so the two never drift.
 *
 * @module lib/email/template-variables
 */

import { VARIABLE_CATALOGUE } from '@/lib/automations/variables'
import type { RunContext } from '@/types/automations'

/** Shape the {@link RichTextEditor} variable popover expects. */
export interface EditorVariable {
  /** The mention id — a variable expression, e.g. `couple.primary_name`. */
  id: string
  label: string
  description: string
}

/**
 * Flat, editor-ready list of every email variable, grouped order
 * preserved from {@link VARIABLE_CATALOGUE}. `id` is the bare
 * expression (no `{{ }}`); `description` shows an example value.
 */
export const EMAIL_TEMPLATE_VARIABLES: readonly EditorVariable[] = VARIABLE_CATALOGUE.flatMap(
  (group) =>
    group.variables.map((v) => ({
      id: v.token.replace(/[{}]/g, '').trim(),
      label: v.label,
      description: `e.g. ${v.example}`,
    })),
)

/**
 * A representative, fully-populated context for previewing a template
 * in the library editor (no real couple selected). Every namespace
 * resolves, so the preview shows the template "filled in" with example
 * data rather than missing-variable highlights — the missing-variable
 * gate only matters at send time against a real couple.
 *
 * @param businessName - The MC's real business name when known, so the
 *   preview signs off correctly.
 */
export function buildSampleContext(businessName?: string, contactName?: string): RunContext {
  return {
    userId: 'sample',
    automationId: 'sample',
    runId: 'sample',
    coupleId: 'sample',
    triggerEvent: {
      id: 'sample',
      user_id: 'sample',
      source_table: 'couples',
      source_id: 'sample',
      event_type: 'new_enquiry' as never,
      // Stuff link namespaces onto the payload so they resolve in preview.
      payload: {
        portal_link: 'https://app.zebri.com.au/p/sample',
        quote_link: 'https://app.zebri.com.au/q/sample',
        quote_number: 'QUO-001',
        quote_total: '2500',
        invoice_link: 'https://app.zebri.com.au/i/sample',
        invoice_number: 'INV-001',
        invoice_total: '2500',
        contract_link: 'https://app.zebri.com.au/c/sample',
        contract_number: 'CTR-001',
      } as never,
      couple_id: 'sample',
      created_at: new Date().toISOString(),
      processed_at: null,
      error_message: null,
    },
    couple: {
      id: 'sample',
      name: 'Sam & Alex',
      email: 'sam@example.com',
      phone: '0412 345 678',
      eventDate: '2026-11-14',
      venue: 'The Calile',
      status: 'booked',
      primaryName: 'Sam',
      spouseName: 'Alex',
      spouseEmail: 'alex@example.com',
      spousePhone: null,
      timezone: 'Australia/Sydney',
    },
    mc: {
      userId: 'sample',
      businessName: businessName?.trim() || 'Your business',
      contactName: contactName?.trim() || 'You',
      email: 'hello@example.com',
      phone: null,
      brandColor: null,
      logoUrl: null,
      quietHoursStart: '21:00',
      quietHoursEnd: '08:00',
      quietHoursTimezone: 'Australia/Sydney',
      // A representative static signature so a template that uses
      // `{{mc.signature}}` previews filled in. Plain rich text, no
      // variables (signatures are Gmail/Outlook-style sign-offs).
      signature: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Warm regards,' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: businessName?.trim() || 'Your business' }],
          },
        ],
      },
    },
    actionResults: {},
  }
}
