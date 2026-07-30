/**
 * Phase 14a UI-only action scaffolding.
 *
 * Every action below is surfaced in the action picker + inspector
 * so MCs can compose flows against them today. The handlers all
 * return `kind: 'error'` with a clear "not yet wired" message — the
 * runner records the error in the audit log, no side effects occur.
 *
 * Hooking each one up is a per-action follow-up. The Zod schemas
 * are authoritative for the field shapes the inspector renders, so
 * any future handler implementation can rely on the same parse.
 *
 * @module lib/automations/actions/extended
 */

import { z } from 'zod'

import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult, ActionType, RunContext } from '@/types/automations'

import type { ActionSpec } from './index'

/** Standard stub handler — records a clear runtime error. */
function notWired(label: string): () => Promise<ActionResult> {
  return async () => ({
    kind: 'error',
    message: `${label}: handler not yet wired (Phase 14a UI scaffolding only).`,
    recoverable: false,
  })
}

/** Build a stub spec from a config schema + UI metadata. */
function stub<T>(
  type: ActionType,
  configSchema: z.ZodSchema<T>,
  ui: ActionSpec['ui'],
): ActionSpec<T> {
  return {
    type,
    configSchema,
    handler: notWired(ui.label),
    ui: { ...ui, comingSoon: true },
  }
}

// ────────────────────────────────────────────────────────────────
// Consultation / calendar
// ────────────────────────────────────────────────────────────────

const createConsultation = stub(
  'create_consultation',
  z.object({
    meetingType: z.enum(['discovery', 'planning', 'rehearsal', 'final_meeting', 'other']),
    proposedSlots: z.array(z.string()).optional(),
    durationMinutes: z.number().int().min(15).max(480).default(30),
    location: z.enum(['in_person', 'video', 'phone']).default('video'),
    sendCoupleBookingLink: z.boolean().optional(),
  }).passthrough(),
  { category: 'consultation', label: 'Create consultation', description: 'Book a discovery / planning meeting with the couple', icon: 'CalendarPlus' },
)

const cancelConsultation = stub(
  'cancel_consultation',
  z.object({
    consultationId: z.string().uuid().optional(),
    reason: z.string().optional(),
    notifyCouple: z.boolean().optional(),
  }).passthrough(),
  { category: 'consultation', label: 'Cancel consultation', description: 'Cancel a scheduled meeting', icon: 'CalendarX' },
)

const blockCalendarSlot = stub(
  'block_calendar_slot',
  z.object({
    startDateTime: z.string(),
    endDateTime: z.string(),
    reason: z.string().optional(),
  }).passthrough(),
  { category: 'calendar', label: 'Block calendar slot', description: 'Block out a time on your calendar (travel, setup, etc.)', icon: 'CalendarOff' },
)

const unblockCalendarSlot = stub(
  'unblock_calendar_slot',
  z.object({
    slotId: z.string().uuid(),
  }).passthrough(),
  { category: 'calendar', label: 'Unblock calendar slot', description: 'Release a previously blocked time', icon: 'CalendarCheck' },
)

const sendCalendarInvite = stub(
  'send_calendar_invite',
  z.object({
    eventId: z.string().uuid().optional(),
    recipientRole: z.enum(['primary', 'spouse', 'both', 'vendors']).default('primary'),
    format: z.enum(['ics', 'google']).default('ics'),
  }).passthrough(),
  { category: 'calendar', label: 'Send calendar invite', description: 'Email an ICS / Google invite to the couple', icon: 'CalendarHeart' },
)

// ────────────────────────────────────────────────────────────────
// AU paperwork
// ────────────────────────────────────────────────────────────────

const lodgeNoimReminder = stub(
  'lodge_noim_reminder',
  z.object({
    daysBeforeEvent: z.number().int().min(0).max(540).default(35),
    recipientRole: z.enum(['primary', 'spouse', 'both']).default('both'),
  }).passthrough(),
  { category: 'compliance', label: 'NOIM reminder', description: 'Email the couple a Notice-of-Intended-Marriage prompt', icon: 'FileCheck' },
)

const generateNoimPdf = stub(
  'generate_noim_pdf',
  z.object({
    eventId: z.string().uuid().optional(),
    prefillFromCoupleData: z.boolean().optional(),
  }).passthrough(),
  { category: 'compliance', label: 'Generate NOIM PDF', description: 'Render a NOIM form for the couple to sign', icon: 'FileText' },
)

const generateDonlimPdf = stub(
  'generate_donlim_pdf',
  z.object({
    eventId: z.string().uuid().optional(),
    prefillFromCoupleData: z.boolean().optional(),
  }).passthrough(),
  { category: 'compliance', label: 'Generate DONLIM PDF', description: 'Render the Declaration of No Legal Impediment', icon: 'FileText' },
)

const generateMarriageCertificate = stub(
  'generate_marriage_certificate',
  z.object({
    eventId: z.string().uuid().optional(),
    template: z.enum(['ceremonial', 'official']).default('ceremonial'),
  }).passthrough(),
  { category: 'compliance', label: 'Generate marriage certificate', description: 'Produce ceremonial or BDM-official certificate PDF', icon: 'Award' },
)

const lodgeBdmPaperwork = stub(
  'lodge_bdm_paperwork',
  z.object({
    eventId: z.string().uuid().optional(),
    submittedDate: z.string().optional(),
  }).passthrough(),
  { category: 'compliance', label: 'Lodge BDM paperwork', description: 'Track state-registry lodgement deadline', icon: 'Stamp' },
)

// ────────────────────────────────────────────────────────────────
// Tags + segmentation + scoring
// ────────────────────────────────────────────────────────────────

const assignTag = stub(
  'assign_tag',
  z.object({
    tag: z.string().min(1),
    expiresAt: z.string().optional(),
  }).passthrough(),
  { category: 'segmentation', label: 'Assign tag', description: 'Add a tag to the couple', icon: 'Tag' },
)

const removeTag = stub(
  'remove_tag',
  z.object({
    tag: z.string().min(1),
  }).passthrough(),
  { category: 'segmentation', label: 'Remove tag', description: 'Remove a tag from the couple', icon: 'TagOff' },
)

const updateLeadScore = stub(
  'update_lead_score',
  z.object({
    delta: z.number().optional(),
    setTo: z.number().optional(),
    reason: z.string().optional(),
  }).passthrough(),
  { category: 'segmentation', label: 'Update lead score', description: 'Adjust the couple\'s lead score (+/− or set)', icon: 'TrendingUp' },
)

const addToSegment = stub(
  'add_to_segment',
  z.object({
    segmentKey: z.string().min(1),
  }).passthrough(),
  { category: 'segmentation', label: 'Add to segment', description: 'Place the couple in a saved segment', icon: 'Users' },
)

const removeFromSegment = stub(
  'remove_from_segment',
  z.object({
    segmentKey: z.string().min(1),
  }).passthrough(),
  { category: 'segmentation', label: 'Remove from segment', description: 'Pull the couple out of a segment', icon: 'UserMinus' },
)

const enqueueForNewsletter = stub(
  'enqueue_for_newsletter',
  z.object({
    newsletterId: z.string().min(1),
    sendAt: z.string().optional(),
  }).passthrough(),
  { category: 'segmentation', label: 'Queue for newsletter', description: 'Schedule the couple into a newsletter send', icon: 'Mailbox' },
)

// ────────────────────────────────────────────────────────────────
// Payments
// ────────────────────────────────────────────────────────────────

const createInvoiceFromProposalSchema = z.object({
  proposalId: z.string().uuid().optional(),
  paymentSchedule: z.enum(['deposit_only', 'full', 'split']).default('deposit_only'),
  dueDate: z.string().optional(),
}).passthrough()

/**
 * Resolve which proposal to invoice: an explicit config id, else the
 * `proposal_id` on the triggering event (e.g. a `proposal_accepted` event),
 * else the couple's most recent ACCEPTED proposal.
 */
async function resolveProposalId(
  supabase: ReturnType<typeof createAdminClient>,
  ctx: RunContext,
  explicitId?: string,
): Promise<string | null> {
  if (explicitId) return explicitId
  const payload = (ctx.triggerEvent.payload as Record<string, unknown>) ?? {}
  if (typeof payload['proposal_id'] === 'string') return payload['proposal_id'] as string
  if (!ctx.couple) return null
  const { data } = await supabase
    .from('proposals')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('couple_id', ctx.couple.id)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/**
 * Draft an invoice from an accepted proposal: copies the accepted
 * option's items and add-ons, links the same couple, leaves it `draft`
 * for the MC to review. `paymentSchedule` seeds the deposit split —
 * a 50% deposit is the editable default for `deposit_only` / `split`.
 */
const createInvoiceFromProposal: ActionSpec<z.infer<typeof createInvoiceFromProposalSchema>> = {
  type: 'create_invoice_from_proposal',
  configSchema: createInvoiceFromProposalSchema,
  async handler(ctx, config) {
    const supabase = createAdminClient()
    const proposalId = await resolveProposalId(supabase, ctx, config.proposalId)
    if (!proposalId) return { kind: 'ok', output: { skipped: 'no accepted proposal found' } }

    const { data: proposal, error: pErr } = await supabase
      .from('proposals')
      .select('id, couple_id, title, status, accepted_option_id, accepted_addon_selection')
      .eq('id', proposalId)
      .eq('user_id', ctx.userId)
      .maybeSingle()
    if (pErr) return { kind: 'error', message: `load proposal: ${pErr.message}`, recoverable: true }
    if (!proposal) return { kind: 'ok', output: { skipped: 'proposal not found' } }
    const p = proposal as {
      id: string; couple_id: string; title: string | null; status: string
      accepted_option_id: string | null; accepted_addon_selection: Record<string, boolean> | null
    }

    if (p.status !== 'accepted') {
      return { kind: 'ok', output: { skipped: 'proposal not accepted' } }
    }

    if (!p.accepted_option_id) {
      return { kind: 'error', message: 'accepted proposal has no accepted_option_id', recoverable: true }
    }

    // Load the accepted option to get its items and GST setting.
    const { data: option, error: oErr } = await supabase
      .from('proposal_options')
      .select('id, title, gst_inclusive, subtotal')
      .eq('id', p.accepted_option_id)
      .eq('proposal_id', p.id)
      .maybeSingle()
    if (oErr) return { kind: 'error', message: `load option: ${oErr.message}`, recoverable: true }
    if (!option) return { kind: 'error', message: 'accepted option not found', recoverable: true }
    const opt = option as {
      id: string; title: string | null; gst_inclusive: boolean; subtotal: number
    }

    // Load the option's items.
    const { data: optionItems, error: oiErr } = await supabase
      .from('proposal_option_items')
      .select('id, description, amount, is_addon, position')
      .eq('option_id', opt.id)
      .order('position', { ascending: true })
    if (oiErr) return { kind: 'error', message: `load option items: ${oiErr.message}`, recoverable: true }

    const items = (optionItems ?? []) as Array<{
      id: string; description: string; amount: number; is_addon: boolean; position: number
    }>

    // Filter: base items + add-ons that were selected.
    const addonSelection = p.accepted_addon_selection ?? {}
    const invoiceItems = items.filter((it) => {
      if (!it.is_addon) return true
      return addonSelection[it.id] === true
    })

    const { data: numData, error: numErr } = await supabase.rpc('generate_invoice_number', {
      p_user_id: ctx.userId,
    } as never)
    if (numErr) return { kind: 'error', message: `invoice number: ${numErr.message}`, recoverable: true }

    // Tax rate: 10 if GST not included, 0 if already included.
    const taxRate = opt.gst_inclusive ? 0 : 10
    const dueDate = config.dueDate ?? null

    const { data: inserted, error: insErr } = await supabase
      .from('invoices')
      .insert({
        user_id: ctx.userId,
        couple_id: p.couple_id,
        proposal_id: p.id,
        status: 'draft',
        invoice_number: numData as string,
        title: p.title ?? 'Invoice',
        due_date: dueDate,
        subtotal: opt.subtotal,
        tax_rate: taxRate,
      } as never)
      .select('id')
      .single()
    if (insErr || !inserted) {
      return { kind: 'error', message: `create invoice: ${insErr?.message ?? 'no row'}`, recoverable: true }
    }
    const invoiceId = (inserted as { id: string }).id

    if (invoiceItems.length > 0) {
      const rows = invoiceItems.map((it) => ({
        invoice_id: invoiceId,
        user_id: ctx.userId,
        description: it.description,
        amount: it.amount,
        quantity: 1,
        unit_price: it.amount,
        position: it.position,
      }))
      const { error: itErr } = await supabase.from('invoice_items').insert(rows as never)
      if (itErr) return { kind: 'error', message: `invoice items: ${itErr.message}`, recoverable: true }
    }

    return { kind: 'ok', output: { invoice_id: invoiceId, from_proposal_id: p.id } }
  },
  ui: { category: 'payments', label: 'Create invoice from proposal', description: 'Auto-draft an invoice from the accepted proposal', icon: 'Receipt' },
}

const createContractFromTemplate = stub(
  'create_contract_from_template',
  z.object({
    templateId: z.string().min(1),
    expiresInDays: z.number().int().min(1).max(365).optional(),
    signerRole: z.enum(['primary', 'spouse', 'both']).optional(),
  }).passthrough(),
  { category: 'payments', label: 'Create contract from template', description: 'Build a draft contract from a saved template', icon: 'FileSignature' },
)

const voidInvoice = stub(
  'void_invoice',
  z.object({
    invoiceId: z.string().uuid().optional(),
    reason: z.string().optional(),
    notifyCouple: z.boolean().optional(),
  }).passthrough(),
  { category: 'payments', label: 'Void invoice', description: 'Cancel an outstanding invoice', icon: 'Ban' },
)

const revokeContract = stub(
  'revoke_contract',
  z.object({
    contractId: z.string().uuid().optional(),
    reason: z.string().optional(),
    notifyCouple: z.boolean().optional(),
  }).passthrough(),
  { category: 'payments', label: 'Revoke contract', description: 'Pull back a sent contract', icon: 'Undo2' },
)

const applyDiscount = stub(
  'apply_discount',
  z.object({
    target: z.enum(['proposal', 'invoice']).default('invoice'),
    targetId: z.string().uuid().optional(),
    amount: z.number().optional(),
    percent: z.number().min(0).max(100).optional(),
    reason: z.string().optional(),
  }).passthrough(),
  { category: 'payments', label: 'Apply discount', description: 'Discount a proposal or invoice', icon: 'BadgePercent' },
)

const addLineItem = stub(
  'add_line_item',
  z.object({
    target: z.enum(['proposal', 'invoice']).default('invoice'),
    targetId: z.string().uuid().optional(),
    description: z.string().min(1),
    amount: z.number().nonnegative(),
    taxable: z.boolean().optional(),
  }).passthrough(),
  { category: 'payments', label: 'Add line item', description: 'Add an item to a proposal or invoice (upsell)', icon: 'ListPlus' },
)

const sendPaymentLink = stub(
  'send_payment_link',
  z.object({
    amount: z.number().nonnegative(),
    description: z.string().min(1),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  }).passthrough(),
  { category: 'payments', label: 'Send payment link', description: 'Generate a standalone Stripe link and email it', icon: 'Link' },
)

const recordOfflinePayment = stub(
  'record_offline_payment',
  z.object({
    amount: z.number().positive(),
    method: z.enum(['bank_transfer', 'cash', 'cheque', 'other']),
    paidAt: z.string(),
    notes: z.string().optional(),
  }).passthrough(),
  { category: 'payments', label: 'Record offline payment', description: 'Log a bank transfer / cash payment to an invoice', icon: 'Banknote' },
)

const requestPaymentMethodUpdate = stub(
  'request_payment_method_update',
  z.object({
    customerId: z.string().optional(),
    daysUntilRetry: z.number().int().min(0).max(30).optional(),
  }).passthrough(),
  { category: 'payments', label: 'Request card update', description: 'Email the couple to refresh their payment method', icon: 'CreditCard' },
)

// ────────────────────────────────────────────────────────────────
// Couple
// ────────────────────────────────────────────────────────────────

const assignContactToCouple = stub(
  'assign_contact_to_couple',
  z.object({
    contactId: z.string().uuid().optional(),
    contactCategory: z.string().optional(),
    autoPickByRegion: z.boolean().optional(),
  }).passthrough(),
  { category: 'couple', label: 'Assign contact to couple', description: 'Link a vendor / contact to this couple', icon: 'Link2' },
)

const requestVendorConfirmation = stub(
  'request_vendor_confirmation',
  z.object({
    vendorContactIds: z.array(z.string().uuid()).optional(),
    message: z.string().optional(),
    confirmationDeadline: z.string().optional(),
  }).passthrough(),
  { category: 'couple', label: 'Request vendor confirmation', description: 'Ask vendors to confirm the run sheet by deadline', icon: 'ClipboardCheck' },
)

const escalateToPhoneCall = stub(
  'escalate_to_phone_call',
  z.object({
    assignTo: z.string().optional(),
    dueWithinHours: z.number().int().min(1).max(168).default(24),
    note: z.string().optional(),
  }).passthrough(),
  { category: 'couple', label: 'Escalate to phone call', description: 'Create a high-priority "call this couple" task', icon: 'Phone' },
)

const markCoupleAsLost = stub(
  'mark_couple_as_lost',
  z.object({
    reason: z.string().optional(),
    tagWith: z.array(z.string()).optional(),
  }).passthrough(),
  { category: 'couple', label: 'Mark couple as lost', description: 'Terminal status — close out the lead', icon: 'XCircle' },
)

const sharePortalSectionWithVendor = stub(
  'share_portal_section_with_vendor',
  z.object({
    section: z.enum(['onboarding', 'pre_event', 'day_of', 'people', 'songs', 'files', 'timeline']),
    vendorContactId: z.string().uuid(),
    accessExpiresInDays: z.number().int().min(1).max(180).optional(),
  }).passthrough(),
  { category: 'couple', label: 'Share portal section with vendor', description: 'Section-scoped magic link for a vendor', icon: 'Share2' },
)

const cloneCoupleToNewEvent = stub(
  'clone_couple_to_new_event',
  z.object({
    coupleId: z.string().uuid().optional(),
    eventDate: z.string(),
    eventType: z.string().optional(),
  }).passthrough(),
  { category: 'couple', label: 'Clone couple to new event', description: 'Repeat customer (renewal of vows / party anniversary)', icon: 'Copy' },
)

const mergeCouples = stub(
  'merge_couples',
  z.object({
    primaryId: z.string().uuid(),
    secondaryId: z.string().uuid(),
  }).passthrough(),
  { category: 'couple', label: 'Merge couples', description: 'Combine duplicate couple records', icon: 'GitMerge' },
)

const archiveCouple = stub(
  'archive_couple',
  z.object({
    reason: z.string().optional(),
    retainDataMonths: z.number().int().min(0).max(120).optional(),
  }).passthrough(),
  { category: 'couple', label: 'Archive couple', description: 'GDPR / Australian-Privacy retention close-out', icon: 'Archive' },
)

const exportCoupleData = stub(
  'export_couple_data',
  z.object({
    format: z.enum(['json', 'pdf']).default('json'),
    deliverTo: z.string().email(),
  }).passthrough(),
  { category: 'couple', label: 'Export couple data', description: 'Privacy / handover — email a data export', icon: 'Download' },
)

// ────────────────────────────────────────────────────────────────
// Drip / sequence flow control
// ────────────────────────────────────────────────────────────────

const startDripCampaign = stub(
  'start_drip_campaign',
  z.object({
    campaignId: z.string().min(1),
    cadence: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).optional(),
  }).passthrough(),
  { category: 'flow', label: 'Start drip campaign', description: 'Enrol this couple into a multi-touch nurture', icon: 'Send' },
)

const pauseDripCampaign = stub(
  'pause_drip_campaign',
  z.object({
    campaignId: z.string().min(1),
  }).passthrough(),
  { category: 'flow', label: 'Pause drip campaign', description: 'Halt a running drip for this couple', icon: 'Pause' },
)

const resumeDripCampaign = stub(
  'resume_drip_campaign',
  z.object({
    campaignId: z.string().min(1),
  }).passthrough(),
  { category: 'flow', label: 'Resume drip campaign', description: 'Continue a paused drip', icon: 'Play' },
)

const pauseSequence = stub(
  'pause_sequence',
  z.object({
    sequenceId: z.string().min(1),
  }).passthrough(),
  { category: 'flow', label: 'Pause sequence', description: 'Per-sequence pause (finer than couple-wide)', icon: 'PauseCircle' },
)

const resumeSequence = stub(
  'resume_sequence',
  z.object({
    sequenceId: z.string().min(1),
  }).passthrough(),
  { category: 'flow', label: 'Resume sequence', description: 'Continue a paused sequence', icon: 'PlayCircle' },
)

const gotoStep = stub(
  'goto_step',
  z.object({
    stepId: z.string().min(1),
  }).passthrough(),
  { category: 'flow', label: 'Go to step', description: 'Jump to another step in this automation (advanced)', icon: 'CornerUpLeft' },
)

// ────────────────────────────────────────────────────────────────
// Integrations (outbound)
// ────────────────────────────────────────────────────────────────

const sendToSlack = stub(
  'send_to_slack',
  z.object({
    channel: z.string().min(1),
    message: z.string().min(1),
    mentionRole: z.enum(['none', 'oncall', 'mc', 'channel', 'here']).default('none'),
    includeCoupleLink: z.boolean().optional(),
  }).passthrough(),
  { category: 'integration', label: 'Send to Slack', description: 'Post a message into a Slack channel', icon: 'MessageSquare' },
)

const sendToWebhook = stub(
  'send_to_webhook',
  z.object({
    url: z.string().url(),
    payloadTemplate: z.string().optional(),
    signWith: z.string().optional(),
  }).passthrough(),
  { category: 'integration', label: 'Send to webhook', description: 'POST a JSON payload to any URL', icon: 'Webhook' },
)

const addToZapier = stub(
  'add_to_zapier',
  z.object({
    triggerKey: z.string().min(1),
  }).passthrough(),
  { category: 'integration', label: 'Send to Zapier', description: 'Fire a Zapier trigger from this step', icon: 'Zap' },
)

// ────────────────────────────────────────────────────────────────
// Notifications + misc
// ────────────────────────────────────────────────────────────────

const notifyCoupleViaPush = stub(
  'notify_couple_via_push',
  z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    deepLink: z.string().optional(),
  }).passthrough(),
  { category: 'general', label: 'Notify couple (push)', description: 'PWA push notification to the couple\'s portal app', icon: 'Bell' },
)

const printLabelForCertificate = stub(
  'print_label_for_certificate',
  z.object({
    eventId: z.string().uuid().optional(),
    printerName: z.string().optional(),
  }).passthrough(),
  { category: 'compliance', label: 'Print certificate label', description: 'Queue a mailing label for batch BDM lodgement', icon: 'Printer' },
)

// ────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────

// Mirrors the registry typing used in every other action file
// (`couple.ts`, `messaging.ts`, `task.ts`, …). The handler param is
// contravariant, so a typed `ActionSpec<Config>` can't be widened to
// `ActionSpec<unknown>` — the explicit `any` here is intentional.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const extendedActions: Partial<Record<ActionType, ActionSpec<any>>> = {
  // Consultations / calendar
  create_consultation: createConsultation,
  cancel_consultation: cancelConsultation,
  block_calendar_slot: blockCalendarSlot,
  unblock_calendar_slot: unblockCalendarSlot,
  send_calendar_invite: sendCalendarInvite,
  // Compliance
  lodge_noim_reminder: lodgeNoimReminder,
  generate_noim_pdf: generateNoimPdf,
  generate_donlim_pdf: generateDonlimPdf,
  generate_marriage_certificate: generateMarriageCertificate,
  lodge_bdm_paperwork: lodgeBdmPaperwork,
  print_label_for_certificate: printLabelForCertificate,
  // Segmentation
  assign_tag: assignTag,
  remove_tag: removeTag,
  update_lead_score: updateLeadScore,
  add_to_segment: addToSegment,
  remove_from_segment: removeFromSegment,
  enqueue_for_newsletter: enqueueForNewsletter,
  // Payments
  create_invoice_from_proposal: createInvoiceFromProposal,
  create_contract_from_template: createContractFromTemplate,
  void_invoice: voidInvoice,
  revoke_contract: revokeContract,
  apply_discount: applyDiscount,
  add_line_item: addLineItem,
  send_payment_link: sendPaymentLink,
  record_offline_payment: recordOfflinePayment,
  request_payment_method_update: requestPaymentMethodUpdate,
  // Couple
  assign_contact_to_couple: assignContactToCouple,
  request_vendor_confirmation: requestVendorConfirmation,
  escalate_to_phone_call: escalateToPhoneCall,
  mark_couple_as_lost: markCoupleAsLost,
  share_portal_section_with_vendor: sharePortalSectionWithVendor,
  clone_couple_to_new_event: cloneCoupleToNewEvent,
  merge_couples: mergeCouples,
  archive_couple: archiveCouple,
  export_couple_data: exportCoupleData,
  // Drip / sequence
  start_drip_campaign: startDripCampaign,
  pause_drip_campaign: pauseDripCampaign,
  resume_drip_campaign: resumeDripCampaign,
  pause_sequence: pauseSequence,
  resume_sequence: resumeSequence,
  goto_step: gotoStep,
  // Integrations
  send_to_slack: sendToSlack,
  send_to_webhook: sendToWebhook,
  add_to_zapier: addToZapier,
  // Notifications
  notify_couple_via_push: notifyCoupleViaPush,
}
