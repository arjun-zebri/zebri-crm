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

import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  ANY_SENTINEL,
  APPROVAL_CHANNELS,
  APPROVAL_CHANNEL_LABELS,
  APPROVAL_EXPIRY_BEHAVIOURS,
  APPROVAL_EXPIRY_BEHAVIOUR_LABELS,
  BOOKING_TIERS,
  BOOKING_TIER_LABELS,
  CALENDAR_EVENT_CATEGORIES,
  CALENDAR_EVENT_CATEGORY_LABELS,
  CANCELLATION_REASONS,
  CANCELLATION_REASON_LABELS,
  COMPARISON_OPS,
  COMPARISON_OP_LABELS,
  CONSULTATION_LOCATIONS,
  CONSULTATION_LOCATION_LABELS,
  CONSULTATION_OUTCOMES,
  CONSULTATION_OUTCOME_LABELS,
  CONSULTATION_TYPES,
  CONSULTATION_TYPE_LABELS,
  CONTACT_CATEGORIES,
  CONTACT_CATEGORY_LABELS,
  DAY_OF_WEEK_BUCKETS,
  DAY_OF_WEEK_LABELS,
  EMAIL_ENGAGEMENT_KINDS,
  EMAIL_ENGAGEMENT_KIND_LABELS,
  EVENT_CHANGE_FIELDS,
  EVENT_CHANGE_FIELD_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  FIELD_MERGE_MODES,
  FIELD_MERGE_MODE_LABELS,
  MONTHS,
  MONTH_LABELS,
  NOTE_CATEGORIES,
  NOTE_CATEGORY_LABELS,
  PAUSE_CATEGORIES,
  PAUSE_CATEGORY_LABELS,
  PAYMENT_FAILURE_REASONS,
  PAYMENT_FAILURE_REASON_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PORTAL_COMPLETION_RANGES,
  PORTAL_COMPLETION_RANGE_LABELS,
  PORTAL_SECTIONS,
  PORTAL_SECTION_LABELS,
  REMINDER_TONES,
  REMINDER_TONE_LABELS,
  REVIEW_PLATFORMS,
  REVIEW_PLATFORM_LABELS,
  RUN_SHEET_FORMATS,
  RUN_SHEET_FORMAT_LABELS,
  SEASONS,
  SEASON_LABELS,
  SIGNER_REQUIREMENTS,
  SIGNER_REQUIREMENT_LABELS,
  SLACK_MENTION_ROLES,
  SLACK_MENTION_ROLE_LABELS,
  SUB_FLOW_CONTEXT_MODES,
  SUB_FLOW_CONTEXT_MODE_LABELS,
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TIMELINE_CATEGORIES,
  TIMELINE_CATEGORY_LABELS,
  TIMELINE_CUE_TYPES,
  TIMELINE_CUE_TYPE_LABELS,
  WEBHOOK_SOURCES,
  WEBHOOK_SOURCE_LABELS,
} from '@/lib/automations/trigger-constants'
import type { ActionType, TriggerType } from '@/types/automations'

/* ─── Field primitives (small wrappers around the design system) ─ */

type Cfg = Record<string, unknown>
type SetCfg = (c: Cfg) => void

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-caption font-medium text-text mb-1">{children}</label>
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-control border border-border bg-surface-muted px-3 py-2 text-caption text-text-muted">
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
      size="sm"
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
      size="sm"
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
    <Input
      label={label}
      size="sm"
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function TimeField({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <Input
      label={label}
      size="sm"
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
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
        className="block w-full rounded-control bg-surface text-text placeholder:text-text-subtle border border-border px-2.5 py-2 text-caption transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-fg focus-visible:border-brand-fg"
      />
    </div>
  )
}

function Check({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-brand-fg"
      />
      <span className="text-caption text-text">{label}</span>
    </label>
  )
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
      size="sm"
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
            ...COMPARISON_OPS.map((o) => ({ value: o, label: COMPARISON_OP_LABELS[o] })),
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
    case 'new_enquiry':
      return <NewEnquiryExtra config={config} setConfig={setConfig} />
    case 'lead_inactive':
      return <LeadInactiveExtra config={config} setConfig={setConfig} />
    case 'custom_field_changed':
      return <CustomFieldChangedExtra config={config} setConfig={setConfig} />
    case 'couple_stage_changed':
      return <CoupleStageChangedExtra config={config} setConfig={setConfig} />
    case 'booking_cancelled':
      return <BookingCancelledExtra config={config} setConfig={setConfig} />
    case 'quote_created':
    case 'quote_sent':
    case 'quote_accepted':
    case 'quote_declined':
    case 'invoice_created':
    case 'invoice_sent':
    case 'payment_received':
      return <PaymentDocFiltersExtra config={config} setConfig={setConfig} forPayment={triggerType === 'payment_received'} />
    case 'quote_due':
    case 'invoice_due':
      return <DueExtra config={config} setConfig={setConfig} isInvoice={triggerType === 'invoice_due'} />
    case 'quote_overdue':
    case 'invoice_overdue':
      return <OverdueExtra config={config} setConfig={setConfig} isInvoice={triggerType === 'invoice_overdue'} />
    case 'quote_viewed_but_not_responded':
      return <QuoteViewedExtra config={config} setConfig={setConfig} />
    case 'payment_failed':
      return <PaymentFailedExtra config={config} setConfig={setConfig} />
    case 'contract_created':
    case 'contract_sent':
    case 'contract_signed':
    case 'contract_declined':
    case 'contract_revoked':
    case 'contract_expired':
    case 'document_signed':
      return <ContractFiltersExtra triggerType={triggerType} config={config} setConfig={setConfig} />
    case 'event_created':
    case 'event_updated':
    case 'event_deleted':
      return <EventExtra triggerType={triggerType} config={config} setConfig={setConfig} />
    case 'time_before_event':
    case 'time_after_event':
      return <CalendarExtra config={config} setConfig={setConfig} isAfter={triggerType === 'time_after_event'} />
    case 'specific_date_reached':
      return <SpecificDateExtra config={config} setConfig={setConfig} />
    case 'anniversary_of_event':
      return <AnniversaryExtra config={config} setConfig={setConfig} />
    case 'section_completed':
      return <SectionCompletedExtra config={config} setConfig={setConfig} />
    case 'portal_section_started_not_finished':
      return <PortalAbandonExtra config={config} setConfig={setConfig} />
    case 'timeline_edited':
      return <TimelineEditedExtra config={config} setConfig={setConfig} />
    case 'task_created':
    case 'task_completed':
    case 'task_overdue':
      return <TaskFiltersExtra triggerType={triggerType} config={config} setConfig={setConfig} />
    case 'contact_created':
    case 'contact_updated':
    case 'contact_linked_to_couple':
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
    case 'couple_uploaded_file':
      return <FileUploadExtra config={config} setConfig={setConfig} />
    case 'couple_added_song_to_playlist':
      return <SongPlaylistExtra config={config} setConfig={setConfig} />
    case 'couple_completed_vows':
      return <VowsExtra config={config} setConfig={setConfig} />
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

function NewEnquiryExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <Check label="Only when couple has an event date" checked={config['hasEventDate'] === true} onChange={(v) => setConfig({ ...config, hasEventDate: v || undefined })} />
      <Check label="Only when couple has a venue" checked={config['hasVenue'] === true} onChange={(v) => setConfig({ ...config, hasVenue: v || undefined })} />
      <SelectField
        label="Day of week (optional)"
        value={(config['dayOfWeek'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, dayOfWeek: v || undefined })}
        options={[{ value: '', label: 'Any day' }, ...DAY_OF_WEEK_BUCKETS.filter((d) => d !== 'any').map((d) => ({ value: d, label: DAY_OF_WEEK_LABELS[d] }))]}
      />
      <SelectField
        label="Event month (optional)"
        value={(config['eventMonth'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, eventMonth: v || undefined })}
        options={enumOptions(MONTHS, MONTH_LABELS, 'Any month')}
      />
      <SelectField
        label="Season (optional)"
        value={(config['season'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, season: v || undefined })}
        options={enumOptions(SEASONS, SEASON_LABELS)}
      />
      <SelectField
        label="Budget tier (optional)"
        value={(config['budgetTier'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, budgetTier: v || undefined })}
        options={enumOptions(BOOKING_TIERS, BOOKING_TIER_LABELS, 'Any tier')}
      />
      <TextField
        label="Referred by contact ID (optional)"
        placeholder="UUID of existing contact"
        value={(config['referralByContactId'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, referralByContactId: v || undefined })}
      />
    </>
  )
}

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

function CoupleStageChangedExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <NumericComparison
        label="Time spent in previous stage (days)"
        opField="timeInPreviousStageOp"
        valueField="timeInPreviousStageDays"
        config={config}
        setConfig={setConfig}
      />
      <SelectField
        label="Triggered by (optional)"
        value={(config['triggeredBy'] as string) ?? 'any'}
        onChange={(v) => setConfig({ ...config, triggeredBy: v === 'any' ? undefined : v })}
        options={[
          { value: 'any', label: 'Any source' },
          { value: 'mc', label: 'MC manual change' },
          { value: 'automation', label: 'Another automation' },
          { value: 'payment', label: 'Payment received' },
          { value: 'portal', label: 'Couple portal action' },
        ]}
      />
    </>
  )
}

function BookingCancelledExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField
        label="Cancellation reason (optional)"
        value={(config['cancellationReason'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, cancellationReason: v || undefined })}
        options={enumOptions(CANCELLATION_REASONS, CANCELLATION_REASON_LABELS, 'Any reason')}
      />
      <Check label="Deposit already paid" checked={config['depositAlreadyPaid'] === true} onChange={(v) => setConfig({ ...config, depositAlreadyPaid: v || undefined })} />
      <NumericComparison label="Days since booked" opField="daysSinceBookedOp" valueField="daysSinceBookedValue" config={config} setConfig={setConfig} />
    </>
  )
}

function PaymentDocFiltersExtra({
  config, setConfig, forPayment,
}: { config: Cfg; setConfig: SetCfg; forPayment: boolean }) {
  return (
    <>
      <SelectField
        label="Package / tier (optional)"
        value={(config['tier'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, tier: v || undefined })}
        options={enumOptions(BOOKING_TIERS, BOOKING_TIER_LABELS, 'Any tier')}
      />
      <Check label="Document has add-on line items" checked={config['hasAddOns'] === true} onChange={(v) => setConfig({ ...config, hasAddOns: v || undefined })} />
      <Check label="Discount was applied" checked={config['discountApplied'] === true} onChange={(v) => setConfig({ ...config, discountApplied: v || undefined })} />
      <NumField label="Version number (optional, blank for any)" value={(config['versionNumber'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, versionNumber: v || undefined })} />
      <Check label="Deposit only" checked={config['isDeposit'] === true} onChange={(v) => setConfig({ ...config, isDeposit: v || undefined })} />
      <Check label="Final balance only" checked={config['isFinalBalance'] === true} onChange={(v) => setConfig({ ...config, isFinalBalance: v || undefined })} />
      {forPayment && (
        <>
          <Check label="Partial payment only" checked={config['isPartial'] === true} onChange={(v) => setConfig({ ...config, isPartial: v || undefined })} />
          <SelectField
            label="Payment method (optional)"
            value={(config['paymentMethod'] as string) ?? ''}
            onChange={(v) => setConfig({ ...config, paymentMethod: v || undefined })}
            options={enumOptions(PAYMENT_METHODS, PAYMENT_METHOD_LABELS, 'Any method')}
          />
        </>
      )}
    </>
  )
}

function DueExtra({ config, setConfig, isInvoice }: { config: Cfg; setConfig: SetCfg; isInvoice: boolean }) {
  return (
    <>
      <NumField label="Reminder number (1 = first, 3 = final)" value={(config['notificationCount'] as number | undefined) ?? 1} onChange={(v) => setConfig({ ...config, notificationCount: v || undefined })} />
      <Check label="Defer into the next non-quiet-hours window" checked={config['respectQuietHours'] === true} onChange={(v) => setConfig({ ...config, respectQuietHours: v || undefined })} />
      {isInvoice && (
        <Check label="Final-balance invoices only" checked={config['isFinalBalance'] === true} onChange={(v) => setConfig({ ...config, isFinalBalance: v || undefined })} />
      )}
    </>
  )
}

function OverdueExtra({ config, setConfig, isInvoice }: { config: Cfg; setConfig: SetCfg; isInvoice: boolean }) {
  return (
    <>
      <NumField label="Maximum days overdue (optional)" value={(config['daysOverdueMax'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, daysOverdueMax: v || undefined })} />
      {/* The quote branch used to offer a "couple has previously
          viewed" checkbox, but quote view tracking doesn't exist in
          the schema yet — the filter silently did nothing. Hidden
          until view tracking ships (same blocker as the
          quote_viewed_but_not_responded trigger). The config schema
          still accepts the field, so previously saved values are
          harmless. */}
      {isInvoice && (
        <>
          <Check label="Final-balance invoices only" checked={config['isFinalBalance'] === true} onChange={(v) => setConfig({ ...config, isFinalBalance: v || undefined })} />
          <NumericComparison label="Days until event date" opField="daysUntilEventOp" valueField="daysUntilEventValue" config={config} setConfig={setConfig} />
        </>
      )}
    </>
  )
}

function QuoteViewedExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <NumericComparison label="View count" opField="viewCountOp" valueField="viewCountValue" config={config} setConfig={setConfig} />
      <NumField label="Last viewed within (days, optional)" value={(config['lastViewedWithinDays'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, lastViewedWithinDays: v || undefined })} />
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

function ContractFiltersExtra({
  triggerType, config, setConfig,
}: { triggerType: TriggerType; config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <NumericComparison label="Days until event date" opField="daysUntilEventOp" valueField="daysUntilEventValue" config={config} setConfig={setConfig} />
      <TextField label="Template used (optional)" value={(config['templateUsed'] as string) ?? ''} onChange={(v) => setConfig({ ...config, templateUsed: v || undefined })} placeholder="e.g. ceremony-agreement-v2" />
      <NumField label="Version number (blank for any)" value={(config['versionNumber'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, versionNumber: v || undefined })} />
      <SelectField
        label="Signer requirement (optional)"
        value={(config['signerRole'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, signerRole: v || undefined })}
        options={enumOptions(SIGNER_REQUIREMENTS, SIGNER_REQUIREMENT_LABELS, 'Any signer')}
      />
      {triggerType === 'contract_signed' && (
        <>
          <NumericComparison label="Time to sign (hours)" opField="timeToSignHoursOp" valueField="timeToSignHoursValue" config={config} setConfig={setConfig} />
          <Check label="Only when both partners have signed" checked={config['signedByBoth'] === true} onChange={(v) => setConfig({ ...config, signedByBoth: v || undefined })} />
        </>
      )}
    </>
  )
}

function EventExtra({
  triggerType, config, setConfig,
}: { triggerType: TriggerType; config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField label="Month (optional)" value={(config['month'] as string) ?? ''} onChange={(v) => setConfig({ ...config, month: v || undefined })} options={enumOptions(MONTHS, MONTH_LABELS, 'Any month')} />
      <SelectField label="Season (optional)" value={(config['season'] as string) ?? ''} onChange={(v) => setConfig({ ...config, season: v || undefined })} options={enumOptions(SEASONS, SEASON_LABELS)} />
      <NumericComparison label="Days until event" opField="daysUntilEventOp" valueField="daysUntilEventValue" config={config} setConfig={setConfig} />
      <Check label="Only events with a venue set" checked={config['hasVenue'] === true} onChange={(v) => setConfig({ ...config, hasVenue: v || undefined })} />
      <Check label="Only destination weddings" checked={config['isDestination'] === true} onChange={(v) => setConfig({ ...config, isDestination: v || undefined })} />
      <NumericComparison label="Guest count" opField="guestCountOp" valueField="guestCountValue" config={config} setConfig={setConfig} />
      {triggerType === 'event_updated' && (
        <SelectField
          label="Only when this field changed (optional)"
          value={(config['changed'] as string) ?? 'any'}
          onChange={(v) => setConfig({ ...config, changed: v === 'any' ? undefined : v })}
          options={enumOptions(EVENT_CHANGE_FIELDS, EVENT_CHANGE_FIELD_LABELS)}
        />
      )}
      {triggerType === 'event_deleted' && (
        <NumField label="Within N days of event (optional)" value={(config['withinDaysOfEvent'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, withinDaysOfEvent: v || undefined })} />
      )}
    </>
  )
}

function CalendarExtra({ config, setConfig, isAfter }: { config: Cfg; setConfig: SetCfg; isAfter: boolean }) {
  return (
    <>
      <SelectField
        label="Day of week (optional)"
        value={(config['dayOfWeek'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, dayOfWeek: v || undefined })}
        options={enumOptions(DAY_OF_WEEK_BUCKETS, DAY_OF_WEEK_LABELS, 'Any day')}
      />
      <Check label="Skip if the couple's automations are paused" checked={config['skipIfPaused'] === true} onChange={(v) => setConfig({ ...config, skipIfPaused: v || undefined })} />
      <TextField label="Only when couple status is (optional)" value={(config['eventStatus'] as string) ?? ''} onChange={(v) => setConfig({ ...config, eventStatus: v || undefined })} placeholder="e.g. booked" />
      <Check label="Respect Australian public holidays" checked={config['respectPublicHolidays'] === true} onChange={(v) => setConfig({ ...config, respectPublicHolidays: v || undefined })} />
      {isAfter && (
        <>
          <Check label="Only if no review has been posted yet" checked={config['onlyIfNoReviewPosted'] === true} onChange={(v) => setConfig({ ...config, onlyIfNoReviewPosted: v || undefined })} />
          <Check label="Only if no referral submitted yet" checked={config['onlyIfNotReferred'] === true} onChange={(v) => setConfig({ ...config, onlyIfNotReferred: v || undefined })} />
        </>
      )}
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

function AnniversaryExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <Check label="Only if you officiated the ceremony" checked={config['onlyIfMarriedByMe'] === true} onChange={(v) => setConfig({ ...config, onlyIfMarriedByMe: v || undefined })} />
      <Check label="Only if the couple left a positive review" checked={config['onlyIfHadGoodOutcome'] === true} onChange={(v) => setConfig({ ...config, onlyIfHadGoodOutcome: v || undefined })} />
    </>
  )
}

function SectionCompletedExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <NumField label="Completed within N days of event (optional)" value={(config['completedWithinDaysOfEvent'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, completedWithinDaysOfEvent: v || undefined })} />
      <NumericComparison label="Completion duration (hours)" opField="completionDurationHoursOp" valueField="completionDurationHoursValue" config={config} setConfig={setConfig} />
    </>
  )
}

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

function TimelineEditedExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField
        label="Edited by (optional)"
        value={(config['editedBy'] as string) ?? 'any'}
        onChange={(v) => setConfig({ ...config, editedBy: v === 'any' ? undefined : v })}
        options={[
          { value: 'any', label: 'Anyone' },
          { value: 'mc', label: 'You' },
          { value: 'couple', label: 'The couple' },
          { value: 'vendor', label: 'A vendor' },
        ]}
      />
      <NumericComparison label="Items added" opField="itemsAddedOp" valueField="itemsAddedValue" config={config} setConfig={setConfig} />
      <NumericComparison label="Items removed" opField="itemsRemovedOp" valueField="itemsRemovedValue" config={config} setConfig={setConfig} />
    </>
  )
}

function TaskFiltersExtra({
  triggerType, config, setConfig,
}: { triggerType: TriggerType; config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField label="Task category (optional)" value={(config['taskCategory'] as string) ?? ''} onChange={(v) => setConfig({ ...config, taskCategory: v || undefined })} options={enumOptions(TASK_CATEGORIES, TASK_CATEGORY_LABELS, 'Any category')} />
      <SelectField label="Priority (optional)" value={(config['taskPriority'] as string) ?? ''} onChange={(v) => setConfig({ ...config, taskPriority: v || undefined })} options={enumOptions(TASK_PRIORITIES, TASK_PRIORITY_LABELS, 'Any priority')} />
      <NumericComparison label="Due within (days)" opField="dueWithinDaysOp" valueField="dueWithinDaysValue" config={config} setConfig={setConfig} />
      {triggerType === 'task_overdue' && (
        <>
          <NumField label="Maximum days overdue (optional)" value={(config['daysOverdueMax'] as number | undefined) ?? 0} onChange={(v) => setConfig({ ...config, daysOverdueMax: v || undefined })} />
          <SelectField
            label="Assigned to (optional)"
            value={(config['assignedTo'] as string) ?? 'any'}
            onChange={(v) => setConfig({ ...config, assignedTo: v === 'any' ? undefined : v })}
            options={[
              { value: 'any', label: 'Anyone' },
              { value: 'self', label: 'You' },
              { value: 'delegated', label: 'Delegated' },
            ]}
          />
        </>
      )}
    </>
  )
}

function ContactExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <Check label="Only when the contact has a phone number" checked={config['hasPhone'] === true} onChange={(v) => setConfig({ ...config, hasPhone: v || undefined })} />
      <Check label="Only when this is the primary vendor for the couple" checked={config['isPrimaryVendorForCouple'] === true} onChange={(v) => setConfig({ ...config, isPrimaryVendorForCouple: v || undefined })} />
      <TextField label="Region / suburb (optional)" value={(config['region'] as string) ?? ''} onChange={(v) => setConfig({ ...config, region: v || undefined })} placeholder="e.g. Melbourne" />
    </>
  )
}

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

function FileUploadExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <TextField label="File type (optional)" value={(config['fileType'] as string) ?? ''} onChange={(v) => setConfig({ ...config, fileType: v || undefined })} placeholder="e.g. pdf, image" />
      <SelectField label="Portal section (optional)" value={(config['section'] as string) ?? ''} onChange={(v) => setConfig({ ...config, section: v || undefined })} options={enumOptions(PORTAL_SECTIONS, PORTAL_SECTION_LABELS, 'Any section')} />
      <NumericComparison label="File size (bytes)" opField="sizeBytesOp" valueField="sizeBytesValue" config={config} setConfig={setConfig} />
    </>
  )
}

function SongPlaylistExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <SelectField
        label="Playlist (optional)"
        value={(config['playlistKey'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, playlistKey: v || undefined })}
        options={[
          { value: '', label: 'Any playlist' },
          { value: 'entrance', label: 'Entrance' },
          { value: 'exit', label: 'Exit' },
          { value: 'first_dance', label: 'First dance' },
          { value: 'ceremony', label: 'Ceremony' },
          { value: 'reception', label: 'Reception' },
          { value: 'other', label: 'Other' },
        ]}
      />
      <NumericComparison label="Song count" opField="songCountOp" valueField="songCountValue" config={config} setConfig={setConfig} />
    </>
  )
}

function VowsExtra({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <SelectField
      label="Who submitted (optional)"
      value={(config['who'] as string) ?? 'either'}
      onChange={(v) => setConfig({ ...config, who: v === 'either' ? undefined : v })}
      options={[
        { value: 'either', label: 'Either partner' },
        { value: 'primary', label: 'Primary only' },
        { value: 'spouse', label: 'Spouse only' },
        { value: 'both', label: 'Both partners' },
      ]}
    />
  )
}

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
    case 'create_invoice_from_quote':
      return <CreateInvoiceFromQuoteForm config={config} updateConfig={updateConfig} />
    case 'create_quote_from_template':
      return <CreateQuoteFromTemplateForm config={config} updateConfig={updateConfig} />
    case 'create_contract_from_template':
      return <CreateContractFromTemplateForm config={config} updateConfig={updateConfig} />
    case 'void_quote':
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
                size="sm"
                type="datetime-local"
                value={slot}
                onChange={(e) => updateConfig({ proposedSlots: slots.map((s, idx) => idx === i ? e.target.value : s) })}
              />
              <button type="button" onClick={() => updateConfig({ proposedSlots: slots.filter((_, idx) => idx !== i) })} className="text-text-muted hover:text-danger cursor-pointer p-1" aria-label="Remove slot">
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => updateConfig({ proposedSlots: [...slots, ''] })} className="text-caption text-text-muted hover:text-text cursor-pointer">+ Add slot</button>
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
      <Input label="Start" size="sm" type="datetime-local" value={(config['startDateTime'] as string) ?? ''} onChange={(e) => updateConfig({ startDateTime: e.target.value })} />
      <Input label="End" size="sm" type="datetime-local" value={(config['endDateTime'] as string) ?? ''} onChange={(e) => updateConfig({ endDateTime: e.target.value })} />
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
      <Input label="Send at (optional)" size="sm" type="datetime-local" value={(config['sendAt'] as string) ?? ''} onChange={(e) => updateConfig({ sendAt: e.target.value || undefined })} />
    </>
  )
}

function CreateInvoiceFromQuoteForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Quote ID (optional)" value={(config['quoteId'] as string) ?? ''} onChange={(v) => updateConfig({ quoteId: v || undefined })} placeholder="Leave blank for latest accepted" />
      <SelectField label="Payment schedule" value={(config['paymentSchedule'] as string) ?? 'deposit_only'} onChange={(v) => updateConfig({ paymentSchedule: v })} options={[{ value: 'deposit_only', label: 'Deposit only' }, { value: 'full', label: 'Full amount' }, { value: 'split', label: 'Split (deposit + balance)' }]} />
      <DateField label="Due date (optional)" value={(config['dueDate'] as string) ?? ''} onChange={(v) => updateConfig({ dueDate: v || undefined })} />
    </>
  )
}

function CreateQuoteFromTemplateForm({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Template ID" value={(config['templateId'] as string) ?? ''} onChange={(v) => updateConfig({ templateId: v })} />
      <Check label="Prefill from couple data" checked={config['prefillFromCoupleData'] === true} onChange={(v) => updateConfig({ prefillFromCoupleData: v })} />
      <NumField label="Discount (optional)" value={(config['discount'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ discount: v || undefined })} />
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
  const idLabel = actionType === 'void_quote' ? 'Quote ID (optional)' : actionType === 'void_invoice' ? 'Invoice ID (optional)' : 'Contract ID (optional)'
  const idKey = actionType === 'void_quote' ? 'quoteId' : actionType === 'void_invoice' ? 'invoiceId' : 'contractId'
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
                size="sm"
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
          <button type="button" onClick={() => updateConfig({ vendorContactIds: [...ids, ''] })} className="text-caption text-text-muted hover:text-text cursor-pointer">+ Add vendor</button>
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
              <Input label="" size="sm" type="text" value={tag} onChange={(e) => updateConfig({ tagWith: tags.map((t, idx) => idx === i ? e.target.value : t) })} />
              <button type="button" onClick={() => updateConfig({ tagWith: tags.filter((_, idx) => idx !== i) })} className="text-text-muted hover:text-danger cursor-pointer p-1" aria-label="Remove tag">
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => updateConfig({ tagWith: [...tags, ''] })} className="text-caption text-text-muted hover:text-text cursor-pointer">+ Add tag</button>
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
 * form for the Phase 14a UI scaffolding (attachments, quiet hours,
 * preview-before-send, etc.).
 */
export function SendEmailExtraFields({
  config, updateConfig,
}: FormProps) {
  return (
    <>
      <TextField label="Reply-to override (optional)" value={(config['replyToOverride'] as string) ?? ''} onChange={(v) => updateConfig({ replyToOverride: v || undefined })} placeholder="you@your-business.com" />
      <Check label="CC every vendor contact attached to the couple" checked={config['ccVendors'] === true} onChange={(v) => updateConfig({ ccVendors: v })} />
      <Check label="BCC yourself for the paper trail" checked={config['bccSelf'] === true} onChange={(v) => updateConfig({ bccSelf: v })} />
      <div>
        <Label>Attachments</Label>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <Check label="Attach latest quote" checked={config['attachQuote'] === true} onChange={(v) => updateConfig({ attachQuote: v })} />
          <Check label="Attach latest contract" checked={config['attachContract'] === true} onChange={(v) => updateConfig({ attachContract: v })} />
          <Check label="Attach latest invoice" checked={config['attachInvoice'] === true} onChange={(v) => updateConfig({ attachInvoice: v })} />
          <Check label="Attach run-sheet PDF" checked={config['attachRunSheet'] === true} onChange={(v) => updateConfig({ attachRunSheet: v })} />
        </div>
      </div>
      <Check label="Defer if it lands inside quiet hours" checked={config['respectQuietHours'] === true} onChange={(v) => updateConfig({ respectQuietHours: v })} />
      <Check label="Skip if the couple has do-not-email set" checked={config['respectCoupleDoNotEmail'] === true} onChange={(v) => updateConfig({ respectCoupleDoNotEmail: v })} />
      <Check label="Send a preview to me first for approval" checked={config['previewBeforeSend'] === true} onChange={(v) => updateConfig({ previewBeforeSend: v })} />
      <Check label="Track opens" checked={config['trackOpens'] === true} onChange={(v) => updateConfig({ trackOpens: v })} />
      <Input label="Send at (optional)" size="sm" type="datetime-local" value={(config['sendAt'] as string) ?? ''} onChange={(e) => updateConfig({ sendAt: e.target.value || undefined })} />
    </>
  )
}

/** Extra fields for the `update_couple_stage` form. */
export function UpdateCoupleStageExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField
        label="Only run if current status is (comma-separated, optional)"
        value={((config['onlyIfCurrentStatus'] as string[] | undefined) ?? []).join(', ')}
        onChange={(v) => updateConfig({ onlyIfCurrentStatus: v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined })}
        placeholder="e.g. enquiry, contacted"
      />
      <TextField label="Auto-add note (optional)" value={(config['addNote'] as string) ?? ''} onChange={(v) => updateConfig({ addNote: v || undefined })} placeholder="e.g. Moved to booked via automation" />
    </>
  )
}

/** Extra fields for the `add_note` form. */
export function AddNoteExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <SelectField label="Category (optional)" value={(config['category'] as string) ?? 'general'} onChange={(v) => updateConfig({ category: v })} options={enumOptions(NOTE_CATEGORIES, NOTE_CATEGORY_LABELS)} />
      <Check label="Pin to the top of the couple's notes" checked={config['pinned'] === true} onChange={(v) => updateConfig({ pinned: v })} />
      <Check label="Allow this to be shown to the couple" checked={config['visibleToCouple'] === true} onChange={(v) => updateConfig({ visibleToCouple: v })} />
    </>
  )
}

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
export function SendPortalLinkExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Subject override (optional)" value={(config['subject'] as string) ?? ''} onChange={(v) => updateConfig({ subject: v || undefined })} />
      <NumField label="Link expires in (days, optional)" value={(config['expiresInDays'] as number | undefined) ?? 30} onChange={(v) => updateConfig({ expiresInDays: v || undefined })} />
      <SelectField label="Restrict to section (optional)" value={(config['restrictToSection'] as string) ?? ''} onChange={(v) => updateConfig({ restrictToSection: v || undefined })} options={[{ value: '', label: 'Full portal' }, { value: 'onboarding', label: 'Onboarding' }, { value: 'pre_event', label: 'Pre-event' }, { value: 'day_of', label: 'Day-of' }, { value: 'people', label: 'People' }, { value: 'songs', label: 'Songs' }, { value: 'files', label: 'Files' }, { value: 'timeline', label: 'Timeline' }]} />
      <SelectField label="Recipient" value={(config['magicLinkRecipient'] as string) ?? 'primary'} onChange={(v) => updateConfig({ magicLinkRecipient: v })} options={[{ value: 'primary', label: 'Primary' }, { value: 'spouse', label: 'Spouse' }, { value: 'both', label: 'Both partners' }]} />
    </>
  )
}

/** Extra fields for the `request_information` form. */
export function RequestInformationExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <DateField label="Due back by (optional)" value={(config['dueDate'] as string) ?? ''} onChange={(v) => updateConfig({ dueDate: v || undefined })} />
      <SelectField label="Reminder cadence" value={(config['reminderCadence'] as string) ?? 'none'} onChange={(v) => updateConfig({ reminderCadence: v })} options={[{ value: 'none', label: 'None' }, { value: 'two_day', label: 'Every 2 days' }, { value: 'weekly', label: 'Weekly' }]} />
      <NumField label="Escalate to MC after (days, optional)" value={(config['escalateAfterDays'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ escalateAfterDays: v || undefined })} />
    </>
  )
}

/** Extra fields for the `create_couple` form. */
export function CreateCoupleExtraFields({ config, updateConfig }: FormProps) {
  const tags = (config['assignTags'] as string[] | undefined) ?? []
  return (
    <>
      <TextField label="Event type (optional)" value={(config['eventType'] as string) ?? ''} onChange={(v) => updateConfig({ eventType: v || undefined })} placeholder="e.g. ceremony, reception" />
      <TextField label="Venue (optional)" value={(config['venue'] as string) ?? ''} onChange={(v) => updateConfig({ venue: v || undefined })} />
      <TextField label="Partner name (optional)" value={(config['partnerName'] as string) ?? ''} onChange={(v) => updateConfig({ partnerName: v || undefined })} />
      <div>
        <Label>Auto-apply tags</Label>
        <div className="space-y-2">
          {tags.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input label="" size="sm" type="text" value={t} onChange={(e) => updateConfig({ assignTags: tags.map((x, idx) => idx === i ? e.target.value : x) })} />
              <button type="button" onClick={() => updateConfig({ assignTags: tags.filter((_, idx) => idx !== i) })} className="text-text-muted hover:text-danger cursor-pointer p-1" aria-label="Remove tag">
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => updateConfig({ assignTags: [...tags, ''] })} className="text-caption text-text-muted hover:text-text cursor-pointer">+ Add tag</button>
        </div>
      </div>
      <Check label="Auto-create a welcome-call task" checked={config['autoCreateTask'] === true} onChange={(v) => updateConfig({ autoCreateTask: v })} />
      <Check label="Skip if an existing couple shares the same email" checked={config['dedupeOnEmail'] === true} onChange={(v) => updateConfig({ dedupeOnEmail: v })} />
    </>
  )
}

/** Extra fields for the `pause_couple_automations` form. */
export function PauseCoupleExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <NumField label="Auto-resume after (days, optional)" value={(config['pauseForDays'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ pauseForDays: v || undefined })} />
      <TextField label="Reason (audit log, optional)" value={(config['pauseReason'] as string) ?? ''} onChange={(v) => updateConfig({ pauseReason: v || undefined })} />
      <SelectField label="Category" value={(config['pauseCategory'] as string) ?? 'general'} onChange={(v) => updateConfig({ pauseCategory: v })} options={enumOptions(PAUSE_CATEGORIES, PAUSE_CATEGORY_LABELS)} />
    </>
  )
}

/** Extra fields for `create_task`. */
export function CreateTaskExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <SelectField label="Category (optional)" value={(config['category'] as string) ?? ''} onChange={(v) => updateConfig({ category: v || undefined })} options={enumOptions(TASK_CATEGORIES, TASK_CATEGORY_LABELS, 'No category')} />
      <SelectField label="Priority (optional)" value={(config['priority'] as string) ?? ''} onChange={(v) => updateConfig({ priority: v || undefined })} options={enumOptions(TASK_PRIORITIES, TASK_PRIORITY_LABELS, 'Default')} />
      <TextField label="Assign to (optional)" value={(config['assignTo'] as string) ?? ''} onChange={(v) => updateConfig({ assignTo: v || undefined })} placeholder="self / assistant / email" />
      <NumField label="Reminder N days before due (optional)" value={(config['reminderBeforeDays'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ reminderBeforeDays: v || undefined })} />
    </>
  )
}

/** Extra fields for `update_task`. */
export function UpdateTaskExtraFields({ config, updateConfig }: FormProps) {
  const push = (config['pushDueDateBy'] as { amount?: number; unit?: string } | undefined) ?? {}
  return (
    <>
      <TextAreaField label="Append a note (optional)" value={(config['appendNote'] as string) ?? ''} onChange={(v) => updateConfig({ appendNote: v || undefined })} />
      <TextField label="Reassign to (optional)" value={(config['reassignTo'] as string) ?? ''} onChange={(v) => updateConfig({ reassignTo: v || undefined })} />
      <div>
        <Label>Snooze: push the due date</Label>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="" value={push.amount ?? 0} onChange={(v) => updateConfig({ pushDueDateBy: { amount: v, unit: push.unit ?? 'days' } })} />
          <SelectField label="" value={push.unit ?? 'days'} onChange={(v) => updateConfig({ pushDueDateBy: { amount: push.amount ?? 0, unit: v } })} options={[{ value: 'days', label: 'Days' }, { value: 'weeks', label: 'Weeks' }]} />
        </div>
      </div>
    </>
  )
}

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

/** Extra fields for `send_quote`. */
export function SendQuoteExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Template ID (optional)" value={(config['templateId'] as string) ?? ''} onChange={(v) => updateConfig({ templateId: v || undefined })} />
      <NumField label="Expires in (days, optional)" value={(config['expiryDays'] as number | undefined) ?? 14} onChange={(v) => updateConfig({ expiryDays: v || undefined })} />
      <TextAreaField label="Custom message above the quote link (optional)" value={(config['customMessage'] as string) ?? ''} onChange={(v) => updateConfig({ customMessage: v || undefined })} />
    </>
  )
}

/** Extra fields for `send_contract`. */
export function SendContractExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <TextField label="Template ID (optional)" value={(config['templateId'] as string) ?? ''} onChange={(v) => updateConfig({ templateId: v || undefined })} />
      <SelectField label="Signers required" value={(config['signersRequired'] as string) ?? 'both'} onChange={(v) => updateConfig({ signersRequired: v })} options={enumOptions(SIGNER_REQUIREMENTS, SIGNER_REQUIREMENT_LABELS)} />
      <NumField label="Expires in (days, optional)" value={(config['expiryDays'] as number | undefined) ?? 14} onChange={(v) => updateConfig({ expiryDays: v || undefined })} />
      <TextAreaField label="Custom message (optional)" value={(config['customMessage'] as string) ?? ''} onChange={(v) => updateConfig({ customMessage: v || undefined })} />
    </>
  )
}

/** Extra fields for `send_invoice`. */
export function SendInvoiceExtraFields({ config, updateConfig }: FormProps) {
  const methods = (config['paymentMethods'] as string[] | undefined) ?? []
  function toggle(m: string) {
    const next = methods.includes(m) ? methods.filter((x) => x !== m) : [...methods, m]
    updateConfig({ paymentMethods: next })
  }
  return (
    <>
      <div>
        <Label>Payment methods to surface</Label>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {PAYMENT_METHODS.map((m) => (
            <Check key={m} label={PAYMENT_METHOD_LABELS[m]} checked={methods.includes(m)} onChange={() => toggle(m)} />
          ))}
        </div>
      </div>
      <NumField label="Due in (days, optional)" value={(config['dueInDays'] as number | undefined) ?? 14} onChange={(v) => updateConfig({ dueInDays: v || undefined })} />
      <NumField label="Late-payment fee (%, optional)" value={(config['latePaymentFeePercent'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ latePaymentFeePercent: v || undefined })} />
      <TextAreaField label="Custom message (optional)" value={(config['customMessage'] as string) ?? ''} onChange={(v) => updateConfig({ customMessage: v || undefined })} />
    </>
  )
}

/** Extra fields for `trigger_payment_reminder`. */
export function PaymentReminderExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <SelectField label="Tone" value={(config['tone'] as string) ?? 'friendly'} onChange={(v) => updateConfig({ tone: v })} options={enumOptions(REMINDER_TONES, REMINDER_TONE_LABELS)} />
      <NumField label="Escalation level (1 = first, 3 = final)" value={(config['escalationLevel'] as number | undefined) ?? 1} onChange={(v) => updateConfig({ escalationLevel: v })} />
      <Check label="Attach a late-fee notice PDF" checked={config['attachLateFeeNotice'] === true} onChange={(v) => updateConfig({ attachLateFeeNotice: v })} />
    </>
  )
}

/** Extra fields for `generate_run_sheet_pdf`. */
export function RunSheetExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <SelectField label="Format" value={(config['format'] as string) ?? 'full'} onChange={(v) => updateConfig({ format: v })} options={enumOptions(RUN_SHEET_FORMATS, RUN_SHEET_FORMAT_LABELS)} />
      <Check label="Include vendor contacts page" checked={config['includeContacts'] === true} onChange={(v) => updateConfig({ includeContacts: v })} />
      <Check label="Include explicit minute-by-minute timings" checked={config['includeTimings'] === true} onChange={(v) => updateConfig({ includeTimings: v })} />
      <Check label="Save a copy into the couple's portal files" checked={config['saveToCoupleFiles'] === true} onChange={(v) => updateConfig({ saveToCoupleFiles: v })} />
      <Check label="Email the PDF to me as well" checked={config['emailToSelf'] === true} onChange={(v) => updateConfig({ emailToSelf: v })} />
    </>
  )
}

/** Extra fields for `create_timeline_event`. */
export function TimelineEventExtraFields({ config, updateConfig }: FormProps) {
  return (
    <>
      <SelectField label="Category" value={(config['category'] as string) ?? 'other'} onChange={(v) => updateConfig({ category: v })} options={enumOptions(TIMELINE_CATEGORIES, TIMELINE_CATEGORY_LABELS)} />
      <TextField label="Responsible vendor contact ID (optional)" value={(config['responsibleVendor'] as string) ?? ''} onChange={(v) => updateConfig({ responsibleVendor: v || undefined })} placeholder="UUID" />
      <SelectField label="Cue" value={(config['cue'] as string) ?? 'none'} onChange={(v) => updateConfig({ cue: v })} options={enumOptions(TIMELINE_CUE_TYPES, TIMELINE_CUE_TYPE_LABELS)} />
      <NumField label="Buffer after (minutes, optional)" value={(config['bufferAfterMin'] as number | undefined) ?? 0} onChange={(v) => updateConfig({ bufferAfterMin: v || undefined })} />
    </>
  )
}

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
export function SendTimelineExtraFields({ config, updateConfig }: FormProps) {
  const filter = (config['vendorFilter'] as string[] | undefined) ?? []
  function toggle(c: string) {
    const next = filter.includes(c) ? filter.filter((x) => x !== c) : [...filter, c]
    updateConfig({ vendorFilter: next.length > 0 ? next : undefined })
  }
  return (
    <>
      <div>
        <Label>Send only to these vendor categories (leave empty for all)</Label>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {CONTACT_CATEGORIES.map((c) => (
            <Check key={c} label={CONTACT_CATEGORY_LABELS[c]} checked={filter.includes(c)} onChange={() => toggle(c)} />
          ))}
        </div>
      </div>
      <SelectField label="Format" value={(config['format'] as string) ?? 'full'} onChange={(v) => updateConfig({ format: v })} options={[{ value: 'full', label: 'Full timeline' }, { value: 'their_cues_only', label: 'Only this vendor\'s cues' }]} />
      <Check label="CC the couple's primary email" checked={config['ccCouple'] === true} onChange={(v) => updateConfig({ ccCouple: v })} />
      <Check label="Attach the run-sheet PDF" checked={config['attachRunSheet'] === true} onChange={(v) => updateConfig({ attachRunSheet: v })} />
      <Check label="Require each vendor to confirm receipt" checked={config['requireConfirmation'] === true} onChange={(v) => updateConfig({ requireConfirmation: v })} />
    </>
  )
}

/** Extra fields for the post-event email actions (baseSchema-based). */
export function PostEventExtraFields({
  config, updateConfig, isReview, isReferral,
}: FormProps & { isReview?: boolean; isReferral?: boolean }) {
  const platforms = (config['platforms'] as string[] | undefined) ?? []
  function togglePlatform(p: string) {
    const next = platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p]
    updateConfig({ platforms: next.length > 0 ? next : undefined })
  }
  return (
    <>
      <TextField label="Saved template ID (optional)" value={(config['templateId'] as string) ?? ''} onChange={(v) => updateConfig({ templateId: v || undefined })} placeholder="Overrides subject/body" />
      <SelectField label="Tone" value={(config['tone'] as string) ?? 'warm'} onChange={(v) => updateConfig({ tone: v })} options={[{ value: 'formal', label: 'Formal' }, { value: 'warm', label: 'Warm' }, { value: 'casual', label: 'Casual' }]} />
      <SelectField label="Recipient" value={(config['recipientRole'] as string) ?? 'primary'} onChange={(v) => updateConfig({ recipientRole: v })} options={[{ value: 'primary', label: 'Primary' }, { value: 'spouse', label: 'Spouse' }, { value: 'both', label: 'Both partners' }]} />
      <Check label="Track opens & clicks" checked={config['trackEngagement'] === true} onChange={(v) => updateConfig({ trackEngagement: v })} />
      {isReview && (
        <>
          <div>
            <Label>Review platforms to link</Label>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {REVIEW_PLATFORMS.map((p) => (
                <Check key={p} label={REVIEW_PLATFORM_LABELS[p]} checked={platforms.includes(p)} onChange={() => togglePlatform(p)} />
              ))}
            </div>
          </div>
          <TextField label="Incentive copy (optional)" value={(config['incentive'] as string) ?? ''} onChange={(v) => updateConfig({ incentive: v || undefined })} placeholder="e.g. first reviewer wins..." />
          <Check label="Auto-follow-up if no review left after 14 days" checked={config['followUpIfIgnored'] === true} onChange={(v) => updateConfig({ followUpIfIgnored: v })} />
        </>
      )}
      {isReferral && (
        <>
          <TextField label="Referral bonus (optional)" value={(config['referralBonus'] as string) ?? ''} onChange={(v) => updateConfig({ referralBonus: v || undefined })} placeholder="e.g. $100 off your next event" />
          <Check label="Include a unique tracking link" checked={config['trackingLink'] === true} onChange={(v) => updateConfig({ trackingLink: v })} />
        </>
      )}
    </>
  )
}

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

/** Extra fields for `stop`. */
export function StopExtraFields({ config, setConfig }: { config: Cfg; setConfig: SetCfg }) {
  return (
    <>
      <TextField label="Mark couple status (optional)" value={(config['markCoupleStatus'] as string) ?? ''} onChange={(v) => setConfig({ ...config, markCoupleStatus: v || undefined })} placeholder="e.g. lost" />
      <TextField label="Apply tag (optional)" value={(config['tagCouple'] as string) ?? ''} onChange={(v) => setConfig({ ...config, tagCouple: v || undefined })} />
      <Check label="Notify the MC by email" checked={config['notifyMc'] === true} onChange={(v) => setConfig({ ...config, notifyMc: v })} />
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
