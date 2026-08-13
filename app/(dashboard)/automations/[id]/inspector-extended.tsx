/**
 * Inspector panel form fields for Phase 14a UI-only triggers and
 * actions. The main inspector delegates rendering for any new
 * trigger / action type to the dispatch components exported here so
 * `inspector-panel.tsx` doesn't balloon further.
 *
 * Every field is wired to the same `config` object the parent owns
 * and uses the same debounced autosave path — no new persistence
 * logic lives here.
 *
 * @module app/(dashboard)/automations/[id]/inspector-extended
 */
'use client'

import { Trash2 } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  ANY_SENTINEL,
  APPROVAL_CHANNELS,
  APPROVAL_CHANNEL_LABELS,
  APPROVAL_EXPIRY_BEHAVIOURS,
  APPROVAL_EXPIRY_BEHAVIOUR_LABELS,
  CALENDAR_EVENT_CATEGORIES,
  CALENDAR_EVENT_CATEGORY_LABELS,
  OFFERED_COMPARISON_OPS,
  COMPARISON_OP_LABELS,
  CONSULTATION_LOCATIONS,
  CONSULTATION_LOCATION_LABELS,
  CONSULTATION_OUTCOMES,
  CONSULTATION_OUTCOME_LABELS,
  CONSULTATION_TYPES,
  CONSULTATION_TYPE_LABELS,
  CONTACT_CATEGORIES,
  CONTACT_CATEGORY_LABELS,
  EMAIL_ENGAGEMENT_KINDS,
  EMAIL_ENGAGEMENT_KIND_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  FIELD_MERGE_MODES,
  FIELD_MERGE_MODE_LABELS,
  PAYMENT_FAILURE_REASONS,
  PAYMENT_FAILURE_REASON_LABELS,
  PORTAL_COMPLETION_RANGES,
  PORTAL_COMPLETION_RANGE_LABELS,
  SIGNER_REQUIREMENTS,
  SIGNER_REQUIREMENT_LABELS,
  SLACK_MENTION_ROLES,
  SLACK_MENTION_ROLE_LABELS,
  SUB_FLOW_CONTEXT_MODES,
  SUB_FLOW_CONTEXT_MODE_LABELS,
  WEBHOOK_SOURCES,
  WEBHOOK_SOURCE_LABELS,
} from '@/lib/automations/trigger-constants'
import type { ActionType, TriggerType } from '@/types/automations'

import { QuestionnaireChips } from './action-chips'

/* ─── Field primitives (small wrappers around the design system) ─ */

type Cfg = Record<string, unknown>
type SetCfg = (c: Cfg) => void

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-body font-medium text-text mb-1">{children}</label>
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-control border border-border bg-surface-muted px-3 py-2 text-body text-text-muted">
      {children}
    </div>
  )
}

function TextField({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <Input
      label={label}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function NumField({
  label, value, onChange, placeholder,
}: {
  label: string; value: number; onChange: (v: number) => void; placeholder?: string
}) {
  return (
    <Input
      label={label}
      type="number"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

function DateField({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <DatePicker value={value} onChange={onChange} />
    </div>
  )
}

/**
 * Time-of-day picker built on the design-system Select (30-minute
 * steps) instead of a native `type="time"` input, whose platform
 * chrome ignores our tokens. A previously saved arbitrary value
 * (e.g. "14:45" from the old free-form input) is injected as an
 * extra option so it still displays and round-trips.
 */
function TimeField({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void
}) {
  const options = [{ value: '', label: 'Not set' }]
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      options.push({ value: v, label: formatTimeLabel(h, m) })
    }
  }
  if (value && !options.some((o) => o.value === value)) {
    const [h, m] = value.split(':').map(Number)
    options.push({
      value,
      label: Number.isFinite(h) && Number.isFinite(m) ? formatTimeLabel(h!, m!) : value,
    })
  }
  return <SelectField label={label} value={value} onChange={onChange} options={options} />
}

function formatTimeLabel(h: number, m: number): string {
  const period = h < 12 ? 'am' : 'pm'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function TextAreaField({
  label, value, onChange, rows = 4,
}: {
  label: string; value: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-control bg-surface text-text placeholder:text-text-subtle border border-border px-2.5 py-2 text-body transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-fg focus-visible:border-brand-fg"
      />
    </div>
  )
}

function Check({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return <Checkbox label={label} checked={checked} onChange={onChange} />
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const radixOptions = options.map((o) => ({ value: o.value === '' ? ANY_SENTINEL : o.value, label: o.label }))
  return (
    <Select
      label={label}
      value={value === '' ? ANY_SENTINEL : value}
      onValueChange={(v) => onChange(v === ANY_SENTINEL ? '' : v)}
      options={radixOptions}
    />
  )
}

function NumericComparison({
  label, opField, valueField, config, setConfig,
}: {
  label: string; opField: string; valueField: string; config: Cfg; setConfig: SetCfg
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label=""
          value={(config[opField] as string) ?? ''}
          onChange={(v) => setConfig({ ...config, [opField]: v || undefined })}
          options={[
            { value: '', label: 'Any value' },
            ...OFFERED_COMPARISON_OPS.map((o) => ({ value: o, label: COMPARISON_OP_LABELS[o] })),
          ]}
        />
        <NumField
          label=""
          value={(config[valueField] as number | undefined) ?? 0}
          onChange={(v) => setConfig({ ...config, [valueField]: v })}
        />
      </div>
    </div>
  )
}

function enumOptions<T extends string>(slugs: readonly T[], labels: Record<T, string>, anyLabel?: string) {
  return [
    ...(anyLabel ? [{ value: '', label: anyLabel }] : []),
    ...slugs.map((s) => ({ value: s, label: labels[s] })),
  ]
}

/* ─── Extended trigger fields ───────────────────────────────────── */

/**
 * Dispatch: render any extra inspector fields for a trigger. Returns
 * `null` when the trigger has no Phase 14a extensions — the main
 * inspector keeps rendering its original fields above this.
 */
export function ExtendedTriggerFields({
  triggerType, config, setConfig,
}: {
  triggerType: TriggerType; config: Cfg; setConfig: SetCfg
}) {
  switch (triggerType) {
    // `new_enquiry` has no extras: its full filter set is rendered by
    // the inspector's TriggerFilterList (see new-enquiry-filters.tsx).
    case 'lead_inactive':
      return <LeadInactiveExtra config={config} setConfig={setConfig} />
    case 'custom_field_changed':
      return <CustomFieldChangedExtra config={config} setConfig={setConfig} />
    case 'payment_failed':
      return <PaymentFailedExtra config={config} setConfig={setConfig} />
    case 'specific_date_reached':
      return <SpecificDateExtra config={config} setConfig={setConfig} />
    case 'portal_section_started_not_finished':
      return <PortalAbandonExtra config={config} setConfig={setConfig} />
    case 'contact_updated':
      return <ContactExtra config={config} setConfig={setConfig} />
    case 'manual_fire':
      return <ManualFireExtra config={config} setConfig={setConfig} />
    // ── New triggers ────────────────────────────────────────────
    case 'consultation_booked':
    case 'consultation_completed':
    case 'consultation_no_show':
    case 'rehearsal_scheduled':
    case 'rehearsal_completed':
      return <ConsultationExtra triggerType={triggerType} config={config} setConfig={setConfig} />
    case 'noim_lodged':
    case 'noim_overdue':
    case 'donlim_due':
    case 'donlim_signed':
    case 'marriage_certificate_issued':
      return <ComplianceExtra triggerType={triggerType} config={config} setConfig={setConfig} />
    case 'couple_replied_to_email':
    case 'couple_opened_email':
    case 'couple_clicked_link':
      return <EngagementExtra config={config} setConfig={setConfig} />
    case 'couple_did_not_reply':
      return <NoReplyExtra config={config} setConfig={setConfig} />
    case 'couple_email_bounced':
      return <BounceExtra config={config} setConfig={setConfig} />
    case 'couple_unsubscribed':
    case 'couple_set_do_not_contact':
    case 'branding_published':
      return <Hint>This trigger fires whenever the event happens — no extra parameters needed.</Hint>
    case 'vendor_contact_assigned':
      return <VendorAssignedExtra config={config} setConfig={setConfig} />
    case 'subscription_status_changed':
      return <SubscriptionStatusExtra config={config} setConfig={setConfig} />
    case 'subscription_trial_ending':
      return <TrialEndingExtra config={config} setConfig={setConfig} />
    case 'team_member_added':
      return <TextField label="Role (optional)" value={(config['role'] as string) ?? ''} onChange={(v) => setConfig({ ...config, role: v || undefined })} placeholder="e.g. assistant" />
    case 'automation_failed':
      return <AutomationFailedExtra config={config} setConfig={setConfig} />
    case 'webhook_received':
      return <WebhookExtra config={config} setConfig={setConfig} />
    case 'tag_added_to_couple':
    case 'tag_removed_from_couple':
      return <TextField label="Tag (optional)" value={(config['tag'] as string) ?? ''} onChange={(v) => setConfig({ ...config, tag: v || undefined })} placeholder="e.g. peak-season" />
    case 'couple_birthday':
      return <BirthdayExtra config={config} setConfig={setConfig} />
    case 'payment_plan_milestone_reached':
      return <PaymentPlanMilestoneExtra config={config} setConfig={setConfig} />
    case 'refund_issued':
      return <RefundIssuedExtra config={config} setConfig={setConfig} />
    default:
      return null
  }
}

/* ── Per-trigger field bundles ── */

function LeadInactiveExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField
        label="Last activity (optional)"
        value={(config['lastActivityType'] as string) ?? 'any'}
        onChange={(v) => setConfig({ ...config, lastActivityType: v === 'any' ? undefined : v })}
        options={[
          { value: 'any', label: 'Any inactivity' },
          { value: 'no_email_reply', label: 'No email reply' },
          { value: 'no_portal_visit', label: 'No portal visit' },
          { value: 'no_quote_view', label: 'No quote view' },
        ]}
      />
      <Check label="Exclude if couple is set to do-not-contact" checked={config['excludeIfDoNotContact'] === true} onChange={(v) => setConfig({ ...config, excludeIfDoNotContact: v || undefined })} />
      <Check label="Exclude if couple already replied" checked={config['excludeIfReplied'] === true} onChange={(v) => setConfig({ ...config, excludeIfReplied: v || undefined })} />
    </>
  )
}

function CustomFieldChangedExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <TextField label="Match text value (optional)" value={(config['valueText'] as string) ?? ''} onChange={(v) => setConfig({ ...config, valueText: v || undefined })} />
      <TextField label="Previous value was (optional)" value={(config['previousValueText'] as string) ?? ''} onChange={(v) => setConfig({ ...config, previousValueText: v || undefined })} />
      <SelectField
        label="Changed by (optional)"
        value={(config['changedBy'] as string) ?? 'any'}
        onChange={(v) => setConfig({ ...config, changedBy: v === 'any' ? undefined : v })}
        options={[
          { value: 'any', label: 'Any source' },
          { value: 'mc', label: 'MC' },
          { value: 'system', label: 'System / automation' },
          { value: 'couple_portal', label: 'Couple via portal' },
        ]}
      />
    </>
  )
}

function PaymentFailedExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField
        label="Failure reason (optional)"
        value={(config['failureReason'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, failureReason: v || undefined })}
        options={enumOptions(PAYMENT_FAILURE_REASONS, PAYMENT_FAILURE_REASON_LABELS, 'Any reason')}
      />
      <NumField label="Attempt number (1 = first, 2+ = retry)" value={(config['attemptNumber'] as number | undefined) ?? 1} onChange={(v) => setConfig({ ...config, attemptNumber: v || undefined })} />
    </>
  )
}

function SpecificDateExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <TextField label="Only for couples with this status (optional)" value={(config['audienceStatus'] as string) ?? ''} onChange={(v) => setConfig({ ...config, audienceStatus: v || undefined })} placeholder="e.g. enquiry" />
      <NumField label="Only couples with weddings in next N months (optional)" value={(config['eventDateWithinMonths'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, eventDateWithinMonths: v || undefined })} />
    </>
  )
}

// anniversary_of_event keeps only `years` + `maxYears` (rendered by the
// base inspector). The `onlyIf*` gates were dropped — no data backs them.
function PortalAbandonExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField
        label="Percent complete (optional)"
        value={(config['percentCompleteRange'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, percentCompleteRange: v || undefined })}
        options={enumOptions(PORTAL_COMPLETION_RANGES, PORTAL_COMPLETION_RANGE_LABELS, 'Any progress')}
      />
      <NumField label="Last activity within (days, optional)" value={(config['lastActivityWithinDays'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, lastActivityWithinDays: v || undefined })} />
    </>
  )
}

const ContactExtra: (p: { config: Cfg; setConfig: SetCfg }) => null = () => null

function ManualFireExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <Check label="Require confirmation before firing" checked={config['requireConfirmation'] === true} onChange={(v) => setConfig({ ...config, requireConfirmation: v || undefined })} />
      <Check label="Require a note describing why" checked={config['requireNote'] === true} onChange={(v) => setConfig({ ...config, requireNote: v || undefined })} />
    </>
  )
}

/* ── New triggers ── */

function ConsultationExtra({
  triggerType, config, setConfig,
}: { triggerType: TriggerType; config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField label="Meeting type (optional)" value={(config['meetingType'] as string) ?? ''} onChange={(v) => setConfig({ ...config, meetingType: v || undefined })} options={enumOptions(CONSULTATION_TYPES, CONSULTATION_TYPE_LABELS, 'Any type')} />
      <SelectField label="Location (optional)" value={(config['location'] as string) ?? ''} onChange={(v) => setConfig({ ...config, location: v || undefined })} options={enumOptions(CONSULTATION_LOCATIONS, CONSULTATION_LOCATION_LABELS, 'Any location')} />
      <NumericComparison label="Days until event date" opField="daysUntilEventOp" valueField="daysUntilEventValue" config={config} setConfig={setConfig} />
      {triggerType === 'consultation_booked' && (
        <NumField label="Within N days of today (optional)" value={(config['dateWithinDays'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, dateWithinDays: v || undefined })} />
      )}
      {triggerType === 'consultation_completed' && (
        <SelectField label="Outcome (optional)" value={(config['outcome'] as string) ?? ''} onChange={(v) => setConfig({ ...config, outcome: v || undefined })} options={enumOptions(CONSULTATION_OUTCOMES, CONSULTATION_OUTCOME_LABELS, 'Any outcome')} />
      )}
      {triggerType === 'rehearsal_scheduled' && (
        <NumericComparison label="Days before event" opField="daysBeforeEventOp" valueField="daysBeforeEventValue" config={config} setConfig={setConfig} />
      )}
    </>
  )
}

function ComplianceExtra({
  triggerType, config, setConfig,
}: { triggerType: TriggerType; config: Cfg; setConfig: SetCfg }) {
  if (triggerType === 'noim_lodged') {
    return <NumericComparison label="Days before event" opField="daysBeforeEventOp" valueField="daysBeforeEventValue" config={config} setConfig={setConfig} />
  }
  if (triggerType === 'noim_overdue') {
    return <NumericComparison label="Days overdue" opField="daysOverdueOp" valueField="daysOverdueValue" config={config} setConfig={setConfig} />
  }
  if (triggerType === 'donlim_due') {
    return <NumField label="Days before event (default 3)" value={(config['daysBeforeEvent'] as number | undefined) ?? 3} onChange={(v) => setConfig({ ...config, daysBeforeEvent: v || undefined })} />
  }
  return <Hint>This compliance milestone fires whenever the event happens. No extra parameters needed.</Hint>
}

function EngagementExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <NumericComparison label="Within hours of send" opField="withinHoursOp" valueField="withinHoursValue" config={config} setConfig={setConfig} />
      <TextField label="Template ID matched (optional)" value={(config['templateMatched'] as string) ?? ''} onChange={(v) => setConfig({ ...config, templateMatched: v || undefined })} />
      <TextField label="Link type (optional)" value={(config['linkType'] as string) ?? ''} onChange={(v) => setConfig({ ...config, linkType: v || undefined })} placeholder="e.g. portal_link, quote_link" />
    </>
  )
}

function NoReplyExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <NumField label="Days since sent" value={(config['daysSinceSent'] as number | undefined) ?? 7} onChange={(v) => setConfig({ ...config, daysSinceSent: v })} />
      <TextField label="Template ID (optional)" value={(config['templateMatched'] as string) ?? ''} onChange={(v) => setConfig({ ...config, templateMatched: v || undefined })} />
    </>
  )
}

function BounceExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <SelectField
      label="Bounce kind (optional)"
      value={(config['kind'] as string) ?? ''}
      onChange={(v) => setConfig({ ...config, kind: v || undefined })}
      options={enumOptions(EMAIL_ENGAGEMENT_KINDS, EMAIL_ENGAGEMENT_KIND_LABELS, 'Any kind')}
    />
  )
}

function VendorAssignedExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField label="Vendor category (optional)" value={(config['category'] as string) ?? ''} onChange={(v) => setConfig({ ...config, category: v || undefined })} options={enumOptions(CONTACT_CATEGORIES, CONTACT_CATEGORY_LABELS, 'Any category')} />
      <SelectField label="For event type (optional)" value={(config['forEventType'] as string) ?? ''} onChange={(v) => setConfig({ ...config, forEventType: v || undefined })} options={enumOptions(EVENT_TYPES, EVENT_TYPE_LABELS, 'Any event type')} />
    </>
  )
}

// couple_uploaded_file (P1) fires on every file upload — the
// file_type / section / size filters were dropped (no backing data).
function SubscriptionStatusExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <TextField label="From status (optional)" value={(config['fromStatus'] as string) ?? ''} onChange={(v) => setConfig({ ...config, fromStatus: v || undefined })} placeholder="e.g. trial" />
      <TextField label="To status (optional)" value={(config['toStatus'] as string) ?? ''} onChange={(v) => setConfig({ ...config, toStatus: v || undefined })} placeholder="e.g. active" />
    </>
  )
}

function TrialEndingExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return <NumField label="Days remaining" value={(config['daysRemaining'] as number | undefined) ?? 3} onChange={(v) => setConfig({ ...config, daysRemaining: v || undefined })} />
}

function AutomationFailedExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <TextField label="Specific automation ID (optional)" value={(config['automationId'] as string) ?? ''} onChange={(v) => setConfig({ ...config, automationId: v || undefined })} placeholder="UUID" />
      <TextField label="Failure category (optional)" value={(config['failureCategory'] as string) ?? ''} onChange={(v) => setConfig({ ...config, failureCategory: v || undefined })} placeholder="e.g. send_failure" />
    </>
  )
}

function WebhookExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField label="Source (optional)" value={(config['source'] as string) ?? ''} onChange={(v) => setConfig({ ...config, source: v || undefined })} options={enumOptions(WEBHOOK_SOURCES, WEBHOOK_SOURCE_LABELS, 'Any source')} />
      <TextField label="Payload schema slug (optional)" value={(config['payloadSchema'] as string) ?? ''} onChange={(v) => setConfig({ ...config, payloadSchema: v || undefined })} placeholder="e.g. typeform_form_v1" />
    </>
  )
}

function BirthdayExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <NumField label="Fire N days before the birthday" value={(config['daysBefore'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, daysBefore: v || undefined })} />
      <SelectField
        label="Who (optional)"
        value={(config['who'] as string) ?? 'either'}
        onChange={(v) => setConfig({ ...config, who: v === 'either' ? undefined : v })}
        options={[
          { value: 'either', label: 'Either partner' },
          { value: 'primary', label: 'Primary only' },
          { value: 'spouse', label: 'Spouse only' },
        ]}
      />
    </>
  )
}

function PaymentPlanMilestoneExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <NumField label="Installment number (optional)" value={(config['installmentNumber'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, installmentNumber: v || undefined })} />
      <NumericComparison label="Percent paid" opField="percentPaidOp" valueField="percentPaidValue" config={config} setConfig={setConfig} />
    </>
  )
}

function RefundIssuedExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <NumericComparison label="Refund amount" opField="amountOp" valueField="amountValue" config={config} setConfig={setConfig} />
      <TextField label="Reason (optional)" value={(config['reason'] as string) ?? ''} onChange={(v) => setConfig({ ...config, reason: v || undefined })} placeholder="e.g. cancellation" />
    </>
  )
}

/* ─── Extended action forms ─────────────────────────────────────── */

/**
 * Action-level dispatcher. Returns the form for any Phase 14a UI
 * stub action; returns `null` for actions whose forms still live in
 * the main inspector panel.
 */
export function ExtendedActionForm({
  actionType, config, updateConfig,
}: {
  actionType: ActionType
  config: Cfg
  updateConfig: (patch: Cfg) => void
}) {
  switch (actionType) {
    case 'create_consultation':
      return <CreateConsultationForm config={config} updateConfig={updateConfig} />
    case 'cancel_consultation':
      return <CancelConsultationForm config={config} updateConfig={updateConfig} />
    case 'block_calendar_slot':
      return <BlockSlotForm config={config} updateConfig={updateConfig} />
    case 'unblock_calendar_slot':
      return <TextField label="Slot ID" value={(config['slotId'] as string) ?? ''} onChange={(v) => updateConfig({ slotId: v })} placeholder="UUID of the blocked slot" />
    case 'send_calendar_invite':
      return <SendCalendarInviteForm config={config} updateConfig={updateConfig} />
    case 'lodge_noim_reminder':
      return <LodgeNoimReminderForm config={config} updateConfig={updateConfig} />
    case 'generate_noim_pdf':
    case 'generate_donlim_pdf':
      return <PaperworkPdfForm config={config} updateConfig={updateConfig} />
    case 'generate_marriage_certificate':
      return <CertificateForm config={config} updateConfig={updateConfig} />
    case 'lodge_bdm_paperwork':
      return <LodgeBdmForm config={config} updateConfig={updateConfig} />
    case 'print_label_for_certificate':
      return <PrintLabelForm config={config} updateConfig={updateConfig} />
    case 'assign_tag':
      return <AssignTagForm config={config} updateConfig={updateConfig} />
    case 'remove_tag':
      return <TextField label="Tag" value={(config['tag'] as string) ?? ''} onChange={(v) => updateConfig({ tag: v })} placeholder="e.g. peak-season" />
    case 'update_lead_score':
      return <UpdateLeadScoreForm config={config} updateConfig={updateConfig} />
    case 'add_to_segment':
    case 'remove_from_segment':
      return <TextField label="Segment key" value={(config['segmentKey'] as string) ?? ''} onChange={(v) => updateConfig({ segmentKey: v })} placeholder="e.g. peak_season_2026" />
    case 'enqueue_for_newsletter':
      return <NewsletterEnqueueForm config={config} updateConfig={updateConfig} />
    case 'create_contract_from_template':
      return <CreateContractFromTemplateForm config={config} updateConfig={updateConfig} />
    case 'send_couple_questionnaire':
      return <SendQuestionnaireForm config={config} updateConfig={updateConfig} />
    case 'void_invoice':
    case 'revoke_contract':
      return <VoidDocumentForm config={config} updateConfig={updateConfig} actionType={actionType} />
    case 'apply_discount':
      return <ApplyDiscountForm config={config} updateConfig={updateConfig} />
    case 'add_line_item':
      return <AddLineItemForm config={config} updateConfig={updateConfig} />
    case 'send_payment_link':
      return <SendPaymentLinkForm config={config} updateConfig={updateConfig} />
    case 'record_offline_payment':
      return <RecordOfflinePaymentForm config={config} updateConfig={updateConfig} />
    case 'request_payment_method_update':
      return <RequestPaymentMethodForm config={config} updateConfig={updateConfig} />
    case 'assign_contact_to_couple':
      return <AssignContactForm config={config} updateConfig={updateConfig} />
    case 'request_vendor_confirmation':
      return <RequestVendorConfirmationForm config={config} updateConfig={updateConfig} />
    case 'escalate_to_phone_call':
      return <EscalateForm config={config} updateConfig={updateConfig} />
    case 'mark_couple_as_lost':
      return <MarkLostForm config={config} updateConfig={updateConfig} />
    case 'share_portal_section_with_vendor':
      return <SharePortalSectionForm config={config} updateConfig={updateConfig} />
    case 'clone_couple_to_new_event':
      return <CloneCoupleForm config={config} updateConfig={updateConfig} />
    case 'merge_couples':
      return <MergeCouplesForm config={config} updateConfig={updateConfig} />
    case 'archive_couple':
      return <ArchiveCoupleForm config={config} updateConfig={updateConfig} />
    case 'export_couple_data':
      return <ExportCoupleDataForm config={config} updateConfig={updateConfig} />
    case 'start_drip_campaign':
      return <StartDripForm config={config} updateConfig={updateConfig} />
    case 'pause_drip_campaign':
    case 'resume_drip_campaign':
      return <TextField label="Campaign ID" value={(config['campaignId'] as string) ?? ''} onChange={(v) => updateConfig({ campaignId: v })} />
    case 'pause_sequence':
    case 'resume_sequence':
      return <TextField label="Sequence ID" value={(config['sequenceId'] as string) ?? ''} onChange={(v) => updateConfig({ sequenceId: v })} />
    case 'goto_step':
      return <TextField label="Step ID" value={(config['stepId'] as string) ?? ''} onChange={(v) => updateConfig({ stepId: v })} placeholder="Action ID from this automation" />
    case 'send_to_slack':
      return <SendToSlackForm config={config} updateConfig={updateConfig} />
    case 'send_to_webhook':
      return <SendToWebhookForm config={config} updateConfig={updateConfig} />
    case 'add_to_zapier':
      return <TextField label="Zapier trigger key" value={(config['triggerKey'] as string) ?? ''} onChange={(v) => updateConfig({ triggerKey: v })} placeholder="From your Zapier integration" />
    case 'notify_couple_via_push':
      return <PushForm config={config} updateConfig={updateConfig} />
    default:
      return null
  }
}

/* ── Per-action forms ── */

type FormProps = { config: Cfg; updateConfig: (patch: Cfg) => void }

function CreateConsultationForm({ config, updateConfig }: FormProps) {
  const slots = (config['proposedSlots'] as string[] | undefined) ?? []
  return (
    <>
      <SelectField label="Meeting type" value={(config['meetingType'] as string) ?? 'discovery'} onChange={(v) => updateConfig({ meetingType: v })} options={enumOptions(CONSULTATION_TYPES, CONSULTATION_TYPE_LABELS)} />
      <NumField label="Duration (minutes)" value={(config['durationMinutes'] as number | undefined) ?? 30} onChange={(v) => updateConfig({ durationMinutes: v })} />
      <SelectField label="Location" value={(config['location'] as string) ?? 'video'} onChange={(v) => updateConfig({ location: v })} options={enumOptions(CONSULTATION_LOCATIONS, CONSULTATION_LOCATION_LABELS)} />
      <div>
        <Label>Proposed slots (ISO datetimes)</Label>
        <div className="space-y-2">
          {slots.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                label=""
                type="datetime-local"
                value={slot}
                onChange={(e) => updateConfig({ proposedSlots: slots.map((s, idx) => idx === i ? e.target.value : s) })}
              />
              <button type="button" onClick={() => updateConfig({ proposedSlots: slots.filter((_, idx) => idx !== i) })} className="text-text-muted hover:text-danger cursor-pointer p-1" aria-label="Remove slot">
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => updateConfig({ proposedSlots: [...slots, ''] })} className="text-body text-text-muted hover:text-text cursor-pointer">+ Add slot</button>
        </div>
      </div>
      <Check label="Send the couple a booking link" checked={config['sendCoupleBookingLink'] === true} onChange={(v) => updateConfig({ sendCoupleBookingLink: v })} />
    </>
  )
}

function CancelConsultationForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Consultation ID (optional)" value={(config['consultationId'] as string) ?? ''} onChange={(v) => updateConfig({ consultationId: v || undefined })} placeholder="Leave blank for latest" />
      <TextAreaField label="Reason (optional)" value={(config['reason'] as string) ?? ''} onChange={(v) => updateConfig({ reason: v || undefined })} />
      <Check label="Notify the couple by email" checked={config['notifyCouple'] === true} onChange={(v) => updateConfig({ notifyCouple: v })} />
    </>
  )
}

function BlockSlotForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <Input label="Start" type="datetime-local" value={(config['startDateTime'] as string) ?? ''} onChange={(e) => updateConfig({ startDateTime: e.target.value })} />
      <Input label="End" type="datetime-local" value={(config['endDateTime'] as string) ?? ''} onChange={(e) => updateConfig({ endDateTime: e.target.value })} />
      <TextField label="Reason (optional)" value={(config['reason'] as string) ?? ''} onChange={(v) => updateConfig({ reason: v || undefined })} placeholder="e.g. travel" />
    </>
  )
}

function SendCalendarInviteForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Event ID (optional)" value={(config['eventId'] as string) ?? ''} onChange={(v) => updateConfig({ eventId: v || undefined })} />
      <SelectField label="Recipient" value={(config['recipientRole'] as string) ?? 'primary'} onChange={(v) => updateConfig({ recipientRole: v })} options={[{ value: 'primary', label: 'Primary' }, { value: 'spouse', label: 'Spouse' }, { value: 'both', label: 'Both partners' }, { value: 'vendors', label: 'Vendors' }]} />
      <SelectField label="Format" value={(config['format'] as string) ?? 'ics'} onChange={(v) => updateConfig({ format: v })} options={[{ value: 'ics', label: 'ICS attachment' }, { value: 'google', label: 'Google Calendar link' }]} />
    </>
  )
}

function LodgeNoimReminderForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <NumField label="Days before event" value={(config['daysBeforeEvent'] as number | undefined) ?? 35} onChange={(v) => updateConfig({ daysBeforeEvent: v })} />
      <SelectField label="Recipient" value={(config['recipientRole'] as string) ?? 'both'} onChange={(v) => updateConfig({ recipientRole: v })} options={enumOptions(SIGNER_REQUIREMENTS, SIGNER_REQUIREMENT_LABELS)} />
    </>
  )
}

function PaperworkPdfForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Event ID (optional)" value={(config['eventId'] as string) ?? ''} onChange={(v) => updateConfig({ eventId: v || undefined })} placeholder="Defaults to the couple's main event" />
      <Check label="Prefill from couple data" checked={config['prefillFromCoupleData'] === true} onChange={(v) => updateConfig({ prefillFromCoupleData: v })} />
    </>
  )
}

function CertificateForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Event ID (optional)" value={(config['eventId'] as string) ?? ''} onChange={(v) => updateConfig({ eventId: v || undefined })} />
      <SelectField label="Template" value={(config['template'] as string) ?? 'ceremonial'} onChange={(v) => updateConfig({ template: v })} options={[{ value: 'ceremonial', label: 'Ceremonial copy (for couple)' }, { value: 'official', label: 'Official copy (for BDM)' }]} />
    </>
  )
}

function LodgeBdmForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Event ID (optional)" value={(config['eventId'] as string) ?? ''} onChange={(v) => updateConfig({ eventId: v || undefined })} />
      <DateField label="Submitted on (optional)" value={(config['submittedDate'] as string) ?? ''} onChange={(v) => updateConfig({ submittedDate: v || undefined })} />
    </>
  )
}

function PrintLabelForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Event ID (optional)" value={(config['eventId'] as string) ?? ''} onChange={(v) => updateConfig({ eventId: v || undefined })} />
      <TextField label="Printer (optional)" value={(config['printerName'] as string) ?? ''} onChange={(v) => updateConfig({ printerName: v || undefined })} placeholder="e.g. Office-Brother" />
    </>
  )
}

function AssignTagForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Tag" value={(config['tag'] as string) ?? ''} onChange={(v) => updateConfig({ tag: v })} placeholder="e.g. peak-season" />
      <DateField label="Expires on (optional)" value={(config['expiresAt'] as string) ?? ''} onChange={(v) => updateConfig({ expiresAt: v || undefined })} />
    </>
  )
}

function UpdateLeadScoreForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <NumField label="Delta (positive or negative; blank to use Set)" value={(config['delta'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ delta: v || undefined })} />
      <NumField label="Set to absolute value (optional)" value={(config['setTo'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ setTo: v || undefined })} />
      <TextField label="Reason (optional)" value={(config['reason'] as string) ?? ''} onChange={(v) => updateConfig({ reason: v || undefined })} placeholder="e.g. viewed quote" />
    </>
  )
}

function NewsletterEnqueueForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Newsletter ID" value={(config['newsletterId'] as string) ?? ''} onChange={(v) => updateConfig({ newsletterId: v })} />
      <Input label="Send at (optional)" type="datetime-local" value={(config['sendAt'] as string) ?? ''} onChange={(e) => updateConfig({ sendAt: e.target.value || undefined })} />
    </>
  )
}

function SendQuestionnaireForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <QuestionnaireChips config={config} setConfig={(c) => updateConfig(c)} />
      <TextField
        label="Title override (optional)"
        value={(config['title'] as string) ?? ''}
        onChange={(v) => updateConfig({ title: v || undefined })}
        placeholder="Defaults to the template name"
      />
    </>
  )
}

function CreateContractFromTemplateForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Template ID" value={(config['templateId'] as string) ?? ''} onChange={(v) => updateConfig({ templateId: v })} />
      <NumField label="Expires in (days, optional)" value={(config['expiresInDays'] as number | undefined) ?? 14} onChange={(v) => updateConfig({ expiresInDays: v || undefined })} />
      <SelectField label="Signer requirement" value={(config['signerRole'] as string) ?? 'both'} onChange={(v) => updateConfig({ signerRole: v })} options={enumOptions(SIGNER_REQUIREMENTS, SIGNER_REQUIREMENT_LABELS)} />
    </>
  )
}

function VoidDocumentForm({ config, updateConfig, actionType }: FormProps & { actionType: ActionType }) {
  const idLabel = actionType === 'void_invoice' ? 'Invoice ID (optional)' : 'Contract ID (optional)'
  const idKey = actionType === 'void_invoice' ? 'invoiceId' : 'contractId'
  return (
    <>
      <TextField label={idLabel} value={(config[idKey] as string) ?? ''} onChange={(v) => updateConfig({ [idKey]: v || undefined })} />
      <TextAreaField label="Reason (optional)" value={(config['reason'] as string) ?? ''} onChange={(v) => updateConfig({ reason: v || undefined })} />
      <Check label="Notify the couple by email" checked={config['notifyCouple'] === true} onChange={(v) => updateConfig({ notifyCouple: v })} />
    </>
  )
}

function ApplyDiscountForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <SelectField label="Target" value={(config['target'] as string) ?? 'invoice'} onChange={(v) => updateConfig({ target: v })} options={[{ value: 'quote', label: 'Quote' }, { value: 'invoice', label: 'Invoice' }]} />
      <TextField label="Target ID (optional)" value={(config['targetId'] as string) ?? ''} onChange={(v) => updateConfig({ targetId: v || undefined })} placeholder="Defaults to the latest" />
      <NumField label="Amount (optional)" value={(config['amount'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ amount: v || undefined })} />
      <NumField label="Percent (optional)" value={(config['percent'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ percent: v || undefined })} />
      <TextField label="Reason (optional)" value={(config['reason'] as string) ?? ''} onChange={(v) => updateConfig({ reason: v || undefined })} placeholder="e.g. referral discount" />
    </>
  )
}

function AddLineItemForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <SelectField label="Target" value={(config['target'] as string) ?? 'invoice'} onChange={(v) => updateConfig({ target: v })} options={[{ value: 'quote', label: 'Quote' }, { value: 'invoice', label: 'Invoice' }]} />
      <TextField label="Target ID (optional)" value={(config['targetId'] as string) ?? ''} onChange={(v) => updateConfig({ targetId: v || undefined })} />
      <TextField label="Description" value={(config['description'] as string) ?? ''} onChange={(v) => updateConfig({ description: v })} />
      <NumField label="Amount" value={(config['amount'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ amount: v })} />
      <Check label="Taxable" checked={config['taxable'] === true} onChange={(v) => updateConfig({ taxable: v })} />
    </>
  )
}

function SendPaymentLinkForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <NumField label="Amount" value={(config['amount'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ amount: v })} />
      <TextField label="Description" value={(config['description'] as string) ?? ''} onChange={(v) => updateConfig({ description: v })} placeholder="What's this payment for?" />
      <NumField label="Expires in (days, optional)" value={(config['expiresInDays'] as number | undefined) ?? 14} onChange={(v) => updateConfig({ expiresInDays: v || undefined })} />
    </>
  )
}

function RecordOfflinePaymentForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <NumField label="Amount" value={(config['amount'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ amount: v })} />
      <SelectField label="Method" value={(config['method'] as string) ?? 'bank_transfer'} onChange={(v) => updateConfig({ method: v })} options={[{ value: 'bank_transfer', label: 'Bank transfer' }, { value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' }, { value: 'other', label: 'Other' }]} />
      <DateField label="Paid on" value={(config['paidAt'] as string) ?? ''} onChange={(v) => updateConfig({ paidAt: v })} />
      <TextAreaField label="Notes (optional)" value={(config['notes'] as string) ?? ''} onChange={(v) => updateConfig({ notes: v || undefined })} />
    </>
  )
}

function RequestPaymentMethodForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Stripe customer ID (optional)" value={(config['customerId'] as string) ?? ''} onChange={(v) => updateConfig({ customerId: v || undefined })} />
      <NumField label="Days until next retry (optional)" value={(config['daysUntilRetry'] as number | undefined) ?? 3} onChange={(v) => updateConfig({ daysUntilRetry: v || undefined })} />
    </>
  )
}

function AssignContactForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Contact ID (optional)" value={(config['contactId'] as string) ?? ''} onChange={(v) => updateConfig({ contactId: v || undefined })} placeholder="UUID" />
      <SelectField label="Or pick by category" value={(config['contactCategory'] as string) ?? ''} onChange={(v) => updateConfig({ contactCategory: v || undefined })} options={enumOptions(CONTACT_CATEGORIES, CONTACT_CATEGORY_LABELS, 'No category preset')} />
      <Check label="Auto-pick the closest by region" checked={config['autoPickByRegion'] === true} onChange={(v) => updateConfig({ autoPickByRegion: v })} />
    </>
  )
}

function RequestVendorConfirmationForm({ config, updateConfig }: FormProps) {
  const ids = (config['vendorContactIds'] as string[] | undefined) ?? []
  return (
    <>
      <div>
        <Label>Vendor contact IDs (leave empty to ping every vendor)</Label>
        <div className="space-y-2">
          {ids.map((id, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                label=""
                type="text"
                value={id}
                placeholder="UUID"
                onChange={(e) => updateConfig({ vendorContactIds: ids.map((v, idx) => idx === i ? e.target.value : v) })}
              />
              <button type="button" onClick={() => updateConfig({ vendorContactIds: ids.filter((_, idx) => idx !== i) })} className="text-text-muted hover:text-danger cursor-pointer p-1" aria-label="Remove">
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => updateConfig({ vendorContactIds: [...ids, ''] })} className="text-body text-text-muted hover:text-text cursor-pointer">+ Add vendor</button>
        </div>
      </div>
      <TextAreaField label="Message (optional)" value={(config['message'] as string) ?? ''} onChange={(v) => updateConfig({ message: v || undefined })} />
      <DateField label="Confirm by (optional)" value={(config['confirmationDeadline'] as string) ?? ''} onChange={(v) => updateConfig({ confirmationDeadline: v || undefined })} />
    </>
  )
}

function EscalateForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Assign to (optional)" value={(config['assignTo'] as string) ?? ''} onChange={(v) => updateConfig({ assignTo: v || undefined })} placeholder="email or 'self'" />
      <NumField label="Due within (hours)" value={(config['dueWithinHours'] as number | undefined) ?? 24} onChange={(v) => updateConfig({ dueWithinHours: v })} />
      <TextAreaField label="Note (optional)" value={(config['note'] as string) ?? ''} onChange={(v) => updateConfig({ note: v || undefined })} />
    </>
  )
}

function MarkLostForm({ config, updateConfig }: FormProps) {
  const tags = (config['tagWith'] as string[] | undefined) ?? []
  return (
    <>
      <TextField label="Reason (optional)" value={(config['reason'] as string) ?? ''} onChange={(v) => updateConfig({ reason: v || undefined })} placeholder="e.g. went with another celebrant" />
      <div>
        <Label>Tags to apply</Label>
        <div className="space-y-2">
          {tags.map((tag, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input label="" type="text" value={tag} onChange={(e) => updateConfig({ tagWith: tags.map((t, idx) => idx === i ? e.target.value : t) })} />
              <button type="button" onClick={() => updateConfig({ tagWith: tags.filter((_, idx) => idx !== i) })} className="text-text-muted hover:text-danger cursor-pointer p-1" aria-label="Remove tag">
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => updateConfig({ tagWith: [...tags, ''] })} className="text-body text-text-muted hover:text-text cursor-pointer">+ Add tag</button>
        </div>
      </div>
    </>
  )
}

function SharePortalSectionForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <SelectField label="Section" value={(config['section'] as string) ?? 'timeline'} onChange={(v) => updateConfig({ section: v })} options={[{ value: 'onboarding', label: 'Onboarding' }, { value: 'pre_event', label: 'Pre-event' }, { value: 'day_of', label: 'Day-of' }, { value: 'people', label: 'People' }, { value: 'songs', label: 'Songs' }, { value: 'files', label: 'Files' }, { value: 'timeline', label: 'Timeline' }]} />
      <TextField label="Vendor contact ID" value={(config['vendorContactId'] as string) ?? ''} onChange={(v) => updateConfig({ vendorContactId: v })} placeholder="UUID" />
      <NumField label="Access expires in (days, optional)" value={(config['accessExpiresInDays'] as number | undefined) ?? 30} onChange={(v) => updateConfig({ accessExpiresInDays: v || undefined })} />
    </>
  )
}

function CloneCoupleForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Couple ID (optional)" value={(config['coupleId'] as string) ?? ''} onChange={(v) => updateConfig({ coupleId: v || undefined })} placeholder="Defaults to the current couple" />
      <DateField label="New event date" value={(config['eventDate'] as string) ?? ''} onChange={(v) => updateConfig({ eventDate: v })} />
      <SelectField label="Event type (optional)" value={(config['eventType'] as string) ?? ''} onChange={(v) => updateConfig({ eventType: v || undefined })} options={enumOptions(EVENT_TYPES, EVENT_TYPE_LABELS, 'Same as original')} />
    </>
  )
}

function MergeCouplesForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Primary couple ID" value={(config['primaryId'] as string) ?? ''} onChange={(v) => updateConfig({ primaryId: v })} placeholder="UUID to keep" />
      <TextField label="Secondary couple ID" value={(config['secondaryId'] as string) ?? ''} onChange={(v) => updateConfig({ secondaryId: v })} placeholder="UUID to merge & delete" />
    </>
  )
}

function ArchiveCoupleForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Reason (optional)" value={(config['reason'] as string) ?? ''} onChange={(v) => updateConfig({ reason: v || undefined })} />
      <NumField label="Retain data for N months (optional)" value={(config['retainDataMonths'] as number | undefined) ?? 12} onChange={(v) => updateConfig({ retainDataMonths: v || undefined })} />
    </>
  )
}

function ExportCoupleDataForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <SelectField label="Format" value={(config['format'] as string) ?? 'json'} onChange={(v) => updateConfig({ format: v })} options={[{ value: 'json', label: 'JSON' }, { value: 'pdf', label: 'PDF' }]} />
      <TextField label="Email to" value={(config['deliverTo'] as string) ?? ''} onChange={(v) => updateConfig({ deliverTo: v })} placeholder="you@example.com" />
    </>
  )
}

function StartDripForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Campaign ID" value={(config['campaignId'] as string) ?? ''} onChange={(v) => updateConfig({ campaignId: v })} />
      <SelectField label="Cadence (optional)" value={(config['cadence'] as string) ?? ''} onChange={(v) => updateConfig({ cadence: v || undefined })} options={[{ value: '', label: 'Use the campaign default' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Bi-weekly' }, { value: 'monthly', label: 'Monthly' }]} />
    </>
  )
}

function SendToSlackForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Channel" value={(config['channel'] as string) ?? ''} onChange={(v) => updateConfig({ channel: v })} placeholder="#wins or @user" />
      <TextAreaField label="Message" value={(config['message'] as string) ?? ''} onChange={(v) => updateConfig({ message: v })} rows={3} />
      <SelectField label="Mention (optional)" value={(config['mentionRole'] as string) ?? 'none'} onChange={(v) => updateConfig({ mentionRole: v })} options={enumOptions(SLACK_MENTION_ROLES, SLACK_MENTION_ROLE_LABELS)} />
      <Check label="Include a link to the couple's profile" checked={config['includeCoupleLink'] === true} onChange={(v) => updateConfig({ includeCoupleLink: v })} />
    </>
  )
}

function SendToWebhookForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="URL" value={(config['url'] as string) ?? ''} onChange={(v) => updateConfig({ url: v })} placeholder="https://" />
      <TextAreaField label="Payload template (JSON, optional)" value={(config['payloadTemplate'] as string) ?? ''} onChange={(v) => updateConfig({ payloadTemplate: v || undefined })} rows={5} />
      <TextField label="HMAC signing secret (optional)" value={(config['signWith'] as string) ?? ''} onChange={(v) => updateConfig({ signWith: v || undefined })} placeholder="Leave blank to send unsigned" />
    </>
  )
}

function PushForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Title" value={(config['title'] as string) ?? ''} onChange={(v) => updateConfig({ title: v })} />
      <TextAreaField label="Body" value={(config['body'] as string) ?? ''} onChange={(v) => updateConfig({ body: v })} rows={3} />
      <TextField label="Deep link (optional)" value={(config['deepLink'] as string) ?? ''} onChange={(v) => updateConfig({ deepLink: v || undefined })} placeholder="e.g. /portal/timeline" />
    </>
  )
}

/* ─── New-param fragments injected into existing-action forms ───── */

/**
 * Extra fields appended to the inspector's existing `send_email`
 * form. Only fields the handler actually honours are offered:
 * reply-to override, CC vendors, BCC self.
 *
 * The Phase 14a scaffolding fields (attachments, per-email quiet
 * hours, do-not-email, preview-before-send, track-opens, send-at)
 * were removed from the form because the handler ignores them —
 * advertising a control that silently does nothing is worse than
 * not offering it. The config schema still accepts them so saved
 * configs keep parsing; see `sendEmailConfigSchema` in
 * `lib/automations/actions/messaging.ts` for the per-field
 * blockers. Timing belongs to a `wait` action and approval to an
 * Approval-gate action, both first-class builder steps.
 */
export function SendEmailExtraFields({
  config, updateConfig,
}: FormProps) {
  return (
    <>
      <TextField label="Reply-to override (optional)" value={(config['replyToOverride'] as string) ?? ''} onChange={(v) => updateConfig({ replyToOverride: v || undefined })} placeholder="you@your-business.com" />
      <Check label="CC every vendor contact attached to the couple" checked={config['ccVendors'] === true} onChange={(v) => updateConfig({ ccVendors: v })} />
      <Check label="BCC yourself for the paper trail" checked={config['bccSelf'] === true} onChange={(v) => updateConfig({ bccSelf: v })} />
    </>
  )
}

/** Extra fields for the `update_couple_stage` form. */
export const UpdateCoupleStageExtraFields: (p: FormProps) => null = () => null

/** Extra fields for the `add_note` form. */
export const AddNoteExtraFields: (p: FormProps) => null = () => null

/** Extra fields for the `update_custom_fields` form. */
export function UpdateCustomFieldsExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <SelectField label="Merge mode" value={(config['mergeMode'] as string) ?? 'set'} onChange={(v) => updateConfig({ mergeMode: v })} options={enumOptions(FIELD_MERGE_MODES, FIELD_MERGE_MODE_LABELS)} />
      <Check label="Only set if currently unset" checked={config['onlyIfUnset'] === true} onChange={(v) => updateConfig({ onlyIfUnset: v })} />
    </>
  )
}

/** Extra fields for the `send_portal_link` form. */
export const SendPortalLinkExtraFields: (p: FormProps) => null = () => null

/** Extra fields for the `request_information` form. */
export const RequestInformationExtraFields: (p: FormProps) => null = () => null

/** Extra fields for the `create_couple` form. */
export const CreateCoupleExtraFields: (p: FormProps) => null = () => null

/** Extra fields for the `pause_couple_automations` form. */
export const PauseCoupleExtraFields: (p: FormProps) => React.JSX.Element = () => (
  <Hint>Pauses every other running automation on this couple.</Hint>
)

/** Extra fields for `create_task`. */
export const CreateTaskExtraFields: (p: FormProps) => null = () => null

/** Extra fields for `update_task`. */
export const UpdateTaskExtraFields: (p: FormProps) => null = () => null

/** Extra fields for `create_calendar_event` / `create_reminder`. */
export function CalendarEventExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <TimeField label="Start time (optional)" value={(config['startTime'] as string) ?? ''} onChange={(v) => updateConfig({ startTime: v || undefined })} />
      <TimeField label="End time (optional)" value={(config['endTime'] as string) ?? ''} onChange={(v) => updateConfig({ endTime: v || undefined })} />
      <TextField label="Location (optional)" value={(config['location'] as string) ?? ''} onChange={(v) => updateConfig({ location: v || undefined })} placeholder="address or video link" />
      <SelectField label="Category" value={(config['category'] as string) ?? 'admin'} onChange={(v) => updateConfig({ category: v })} options={enumOptions(CALENDAR_EVENT_CATEGORIES, CALENDAR_EVENT_CATEGORY_LABELS)} />
      <Check label="Email the couple a calendar invite (ICS)" checked={config['inviteCouple'] === true} onChange={(v) => updateConfig({ inviteCouple: v })} />
      <TextField label="Colour tag (optional)" value={(config['colorTag'] as string) ?? ''} onChange={(v) => updateConfig({ colorTag: v || undefined })} placeholder="#a78bfa" />
      <NumField label="Reminder hours before start (optional)" value={(config['reminderHoursBefore'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ reminderHoursBefore: v || undefined })} />
      <SelectField label="Notification channel" value={(config['notificationChannel'] as string) ?? 'email'} onChange={(v) => updateConfig({ notificationChannel: v })} options={[{ value: 'email', label: 'Email' }, { value: 'slack', label: 'Slack' }, { value: 'in_app', label: 'In-app' }]} />
    </>
  )
}

/** Extra fields for `send_contract`. */
export const SendContractExtraFields: (p: FormProps) => null = () => null

/** Extra fields for `send_invoice`. */
export const SendInvoiceExtraFields: (p: FormProps) => null = () => null

/** Extra fields for `trigger_payment_reminder`. */
export const PaymentReminderExtraFields: (p: FormProps) => null = () => null

/** Extra fields for `generate_run_sheet_pdf` (shares the run-sheet link). */
export function RunSheetExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <Hint>Emails you a link to the event run sheet (the timeline view).</Hint>
      <Check label="Also email the link to the couple" checked={config['sendToCouple'] === true} onChange={(v) => updateConfig({ sendToCouple: v })} />
    </>
  )
}

/** Extra fields for `create_timeline_event`. */
export const TimelineEventExtraFields: (p: FormProps) => null = () => null

/** Extra fields for `update_timeline_event`. */
export function UpdateTimelineEventExtraFields({ config, updateConfig }: FormProps) {
  const shift = (config['shiftBy'] as { amount?: number; unit?: string } | undefined) ?? {}
  return (
    <>
      <div>
        <Label>Shift this item & all following items</Label>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="" value={shift.amount ?? 0} onChange={(v) => updateConfig({ shiftBy: { amount: v, unit: shift.unit ?? 'minutes' } })} />
          <SelectField label="" value={shift.unit ?? 'minutes'} onChange={(v) => updateConfig({ shiftBy: { amount: shift.amount ?? 0, unit: v } })} options={[{ value: 'minutes', label: 'Minutes' }, { value: 'hours', label: 'Hours' }]} />
        </div>
      </div>
      <Check label="Auto-notify impacted vendors by email" checked={config['notifyVendors'] === true} onChange={(v) => updateConfig({ notifyVendors: v })} />
    </>
  )
}

/** Extra fields for `send_timeline_to_vendors` / `send_final_run_sheet`. */
/** Extra fields for the post-event email actions (baseSchema-based). */
export const PostEventExtraFields: (p: FormProps & { isReview?: boolean; isReferral?: boolean }) => null = () => null

/* ─── Flow-control extra fields ─────────────────────────────────── */

/** Extra fields for `wait`. */
export function WaitExtraFields({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <Check label="Skip weekends (Sat & Sun)" checked={config['respectWeekend'] === true} onChange={(v) => setConfig({ ...config, respectWeekend: v })} />
      <Check label="Respect Australian public holidays" checked={config['respectPublicHolidays'] === true} onChange={(v) => setConfig({ ...config, respectPublicHolidays: v })} />
      <TimeField label="Only resume after (optional)" value={(config['windowStart'] as string) ?? ''} onChange={(v) => setConfig({ ...config, windowStart: v || undefined })} />
      <TimeField label="Only resume before (optional)" value={(config['windowEnd'] as string) ?? ''} onChange={(v) => setConfig({ ...config, windowEnd: v || undefined })} />
      <NumField label="Safety cap — max wait days (optional)" value={(config['maxWaitDays'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, maxWaitDays: v || undefined })} />
    </>
  )
}

/** Extra fields for `approval`. */
export function ApprovalExtraFields({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField label="Approver role" value={(config['approverRole'] as string) ?? 'mc'} onChange={(v) => setConfig({ ...config, approverRole: v })} options={[{ value: 'mc', label: 'You (MC)' }, { value: 'assistant', label: 'Assistant' }, { value: 'partner', label: 'Partner' }]} />
      <SelectField label="Multi-approver mode" value={(config['multiApproverMode'] as string) ?? 'any'} onChange={(v) => setConfig({ ...config, multiApproverMode: v })} options={[{ value: 'any', label: 'Any one approver can decide' }, { value: 'all', label: 'All approvers must agree' }]} />
      <SelectField label="Channel" value={(config['channel'] as string) ?? 'email'} onChange={(v) => setConfig({ ...config, channel: v })} options={enumOptions(APPROVAL_CHANNELS, APPROVAL_CHANNEL_LABELS)} />
      <SelectField label="If the window expires" value={(config['defaultOnExpiry'] as string) ?? 'cancel'} onChange={(v) => setConfig({ ...config, defaultOnExpiry: v })} options={enumOptions(APPROVAL_EXPIRY_BEHAVIOURS, APPROVAL_EXPIRY_BEHAVIOUR_LABELS)} />
    </>
  )
}

/** Extra fields for `sub_flow`. */
export function SubFlowExtraFields({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField label="Pass context" value={(config['passContext'] as string) ?? 'inherit_all'} onChange={(v) => setConfig({ ...config, passContext: v })} options={enumOptions(SUB_FLOW_CONTEXT_MODES, SUB_FLOW_CONTEXT_MODE_LABELS)} />
      <Check label="Wait for the sub-flow to complete before continuing" checked={config['waitForCompletion'] === true} onChange={(v) => setConfig({ ...config, waitForCompletion: v })} />
      <SelectField label="If the sub-flow errors" value={(config['errorBehavior'] as string) ?? 'stop'} onChange={(v) => setConfig({ ...config, errorBehavior: v })} options={[{ value: 'stop', label: 'Stop this run' }, { value: 'continue', label: 'Continue regardless' }]} />
    </>
  )
}

/** Extra fields for `branch` — composable multi-predicate AND/OR groups. */
export function BranchExtraFields({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  const predicate = (config['predicate'] as Record<string, unknown> | undefined) ?? {}
  return (
    <>
      <SelectField
        label="Logical operator"
        value={(config['groupOperator'] as string) ?? 'single'}
        onChange={(v) => setConfig({ ...config, groupOperator: v })}
        options={[
          { value: 'single', label: 'Single condition' },
          { value: 'and', label: 'AND (all must match)' },
          { value: 'or', label: 'OR (any can match)' },
        ]}
      />
      <Hint>
        AND/OR groups are scaffolded — the runner still evaluates a single condition today.
        Composing groups will land alongside the engine update.
      </Hint>
      {!predicate['kind'] && null}
    </>
  )
}
