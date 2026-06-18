/**
 * Right rail: config inspector for the currently-selected node.
 *
 * Setup / Configure tabs. Setup is a thin "what's this node?"
 * summary plus app-level connection / requirements; Configure is
 * the per-step config form (recycles the form logic from the
 * previous step-config-editor).
 *
 * Renders nothing when no node is selected - the canvas widens
 * to fill the gap.
 *
 * @module app/(dashboard)/automations/[id]/inspector-panel
 */
'use client'

import { ChevronRight, Repeat2, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { EmailTemplatePicker } from '@/app/(dashboard)/templates/email-template-picker'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { actionRegistry } from '@/lib/automations/actions'
import {
  ANY_SENTINEL,
  CONTACT_CATEGORIES,
  CONTACT_CATEGORY_LABELS,
  COMPARISON_OPS,
  COMPARISON_OP_LABELS,
  DAY_OF_WEEK_BUCKETS,
  DAY_OF_WEEK_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  PEOPLE_CATEGORIES,
  PEOPLE_CATEGORY_LABELS,
  PORTAL_SECTIONS,
  PORTAL_SECTION_LABELS,
  TIME_UNITS,
  TIME_UNIT_LABELS,
  type ComparisonOp,
} from '@/lib/automations/trigger-constants'
import { triggerRegistry } from '@/lib/automations/triggers'
import { VARIABLE_CATALOGUE } from '@/lib/automations/variables'
import { createClient } from '@/lib/supabase/client'
import type {
  ActionType,
  AutomationActionRow,
  TriggerType,
} from '@/types/automations'

import {
  setAutomationTriggerAction,
  upsertAutomationActionRow,
} from '../actions'

import {
  AddNoteExtraFields,
  ApprovalExtraFields,
  BranchExtraFields,
  CalendarEventExtraFields,
  CreateCoupleExtraFields,
  CreateTaskExtraFields,
  ExtendedActionForm,
  ExtendedTriggerFields,
  PauseCoupleExtraFields,
  PaymentReminderExtraFields,
  PostEventExtraFields,
  RequestInformationExtraFields,
  RunSheetExtraFields,
  SendContractExtraFields,
  SendEmailExtraFields,
  SendInvoiceExtraFields,
  SendPortalLinkExtraFields,
  SendQuoteExtraFields,
  SendTimelineExtraFields,
  StopExtraFields,
  SubFlowExtraFields,
  TimelineEventExtraFields,
  UpdateCoupleStageExtraFields,
  UpdateCustomFieldsExtraFields,
  UpdateTaskExtraFields,
  UpdateTimelineEventExtraFields,
  WaitExtraFields,
} from './inspector-extended'

/**
 * Optimistic save payload. The parent page applies these updates
 * to its local state synchronously so the drawer / canvas reflect
 * the change without waiting for the server round-trip.
 */
export type SavedPayload =
  | { kind: 'trigger'; triggerConfig: Record<string, unknown> }
  | { kind: 'action'; actionId: string; config: Record<string, unknown> }

interface Props {
  selection:
    | { kind: 'trigger'; triggerType: TriggerType; triggerConfig: Record<string, unknown> }
    | { kind: 'action'; action: AutomationActionRow }
  automationId: string
  onClose: () => void
  onSaved: (payload: SavedPayload) => void
  /** Only available when `selection.kind === 'trigger'`. Fires the
   *  trigger picker again from the inspector header. */
  onChangeTrigger?: (e: React.MouseEvent) => void
  /** Only available when `selection.kind === 'action'`. */
  onDeleteAction?: (actionId: string) => Promise<void> | void
}

export function InspectorPanel({ selection, automationId, onClose, onSaved, onChangeTrigger, onDeleteAction }: Props) {
  const meta = selection.kind === 'trigger'
    ? {
        kindLabel: 'Trigger',
        title: triggerRegistry[selection.triggerType]?.ui.label ?? selection.triggerType,
        description: triggerRegistry[selection.triggerType]?.ui.description ?? '',
      }
    : {
        kindLabel: actionSubLabel(selection.action),
        title: actionHeaderLabel(selection.action),
        description: actionDescription(selection.action),
      }

  return (
    <aside className="w-[340px] shrink-0 border-l border-border bg-surface flex flex-col h-full animate-slide-in-right">
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-text-subtle">{meta.kindLabel}</div>
          <div className="text-sm font-semibold truncate">{meta.title}</div>
          {meta.description && (
            <div className="text-xs text-text-muted mt-0.5 line-clamp-2">{meta.description}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selection.kind === 'trigger' && onChangeTrigger && (
            <button
              type="button"
              onClick={onChangeTrigger}
              className="text-text-muted hover:text-text cursor-pointer p-1"
              aria-label="Change trigger"
              title="Change trigger"
            >
              <Repeat2 size={16} strokeWidth={1.5} />
            </button>
          )}
          {selection.kind === 'action' && onDeleteAction && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm('Delete this action?')) return
                await onDeleteAction(selection.action.id)
              }}
              className="text-text-muted hover:text-danger cursor-pointer p-1"
              aria-label="Delete action"
              title="Delete action"
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text cursor-pointer p-1"
            aria-label="Close inspector"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ConfigureTab
          selection={selection}
          automationId={automationId}
          onSaved={onSaved}
        />
      </div>
    </aside>
  )
}

function actionDescription(action: AutomationActionRow): string {
  if (action.type === 'wait' || action.type === 'branch' || action.type === 'stop' || action.type === 'approval' || action.type === 'sub_flow') {
    return ''
  }
  const spec = actionRegistry[action.type as ActionType]
  return spec?.ui.description ?? ''
}

/* ─── Configure tab ───────────────────────────────────────────── */

function ConfigureTab({
  selection,
  automationId,
  onSaved,
}: {
  selection: Props['selection']
  automationId: string
  onSaved: (payload: SavedPayload) => void
}) {
  if (selection.kind === 'trigger') {
    return (
      <TriggerConfigForm
        automationId={automationId}
        triggerType={selection.triggerType}
        triggerConfig={selection.triggerConfig}
        onSaved={onSaved}
      />
    )
  }
  return (
    <ActionConfigForm
      action={selection.action}
      automationId={automationId}
      onSaved={onSaved}
    />
  )
}

/* ─── Trigger config form ─────────────────────────────────────── */

function TriggerConfigForm({
  automationId,
  triggerType,
  triggerConfig,
  onSaved,
}: {
  automationId: string
  triggerType: TriggerType
  triggerConfig: Record<string, unknown>
  onSaved: (payload: SavedPayload) => void
}) {
  const [config, setConfig] = useState<Record<string, unknown>>(triggerConfig ?? {})

  // Debounced autosave on every config change. Skip the initial
  // render (we just hydrated the form) and fire 250ms after the
  // user's last keystroke / click.
  useDebouncedAutosave(config, () => {
    onSaved({ kind: 'trigger', triggerConfig: config })
    void setAutomationTriggerAction({ automationId, triggerType, triggerConfig: config })
  })

  const amountQuoteInvoice =
    triggerType === 'quote_created' ||
    triggerType === 'quote_sent' ||
    triggerType === 'quote_accepted' ||
    triggerType === 'quote_declined' ||
    triggerType === 'invoice_created' ||
    triggerType === 'invoice_sent' ||
    triggerType === 'payment_received'

  return (
    <div className="space-y-3">
      {triggerType === 'new_enquiry' && (
        <>
          <SelectInput
            label="Lead source (optional)"
            value={(config['leadSource'] as string) ?? ''}
            onChange={(v) => setConfig({ ...config, leadSource: v || undefined })}
            options={leadSourceOptions()}
          />
          <DaysUntilEventFields
            config={config}
            setConfig={setConfig}
            label="Days until event date"
          />
        </>
      )}

      {triggerType === 'lead_inactive' && (
        <>
          <NumberInput
            label="Days inactive"
            value={Number(config['days'] ?? 14)}
            onChange={(v) => setConfig({ ...config, days: v })}
          />
          <CoupleStatusSelect
            label="Only when couple status is (optional)"
            value={(config['status'] as string) ?? ''}
            onChange={(v) => setConfig({ ...config, status: v || undefined })}
          />
        </>
      )}

      {triggerType === 'custom_field_changed' && (
        <>
          <TextInput
            label="Custom field key (optional)"
            placeholder="e.g. ceremony_style"
            value={(config['key'] as string) ?? ''}
            onChange={(v) => setConfig({ ...config, key: v || undefined })}
          />
          <NumericComparisonFields
            label="Numeric value filter (optional)"
            opField="valueOp"
            valueField="valueNumber"
            config={config}
            setConfig={setConfig}
          />
        </>
      )}

      {triggerType === 'couple_stage_changed' && (
        <>
          <CoupleStageFields config={config} setConfig={setConfig} />
          <DaysUntilEventFields
            config={config}
            setConfig={setConfig}
            label="Days until event date"
          />
        </>
      )}

      {triggerType === 'booking_cancelled' && (
        <DaysUntilEventFields
          config={config}
          setConfig={setConfig}
          label="Days until event date"
        />
      )}

      {amountQuoteInvoice && (
        <NumericComparisonFields
          label="Amount filter (optional)"
          opField="amountOp"
          valueField="amountValue"
          config={config}
          setConfig={setConfig}
        />
      )}

      {triggerType === 'quote_due' && (
        <NumberInput
          label="Days before due date (0 = on the day)"
          value={Number(config['days'] ?? 0)}
          onChange={(v) => setConfig({ ...config, days: v })}
        />
      )}

      {triggerType === 'invoice_due' && (
        <NumberInput
          label="Days before due date (0 = on the day)"
          value={Number(config['days'] ?? 0)}
          onChange={(v) => setConfig({ ...config, days: v })}
        />
      )}

      {triggerType === 'quote_overdue' && (
        <NumberInput
          label="Minimum days overdue (optional)"
          value={Number(config['daysOverdueMin'] ?? 0)}
          onChange={(v) => setConfig({ ...config, daysOverdueMin: v || undefined })}
        />
      )}

      {triggerType === 'invoice_overdue' && (
        <NumberInput
          label="Minimum days overdue (optional)"
          value={Number(config['daysOverdueMin'] ?? 0)}
          onChange={(v) => setConfig({ ...config, daysOverdueMin: v || undefined })}
        />
      )}

      {triggerType === 'quote_viewed_but_not_responded' && (
        <NumberInput
          label="Days since view"
          value={Number(config['days'] ?? 7)}
          onChange={(v) => setConfig({ ...config, days: v })}
        />
      )}

      {(triggerType === 'event_created' ||
        triggerType === 'event_updated' ||
        triggerType === 'event_deleted') && (
        <>
          <SelectInput
            label="Event type (optional)"
            value={(config['eventType'] as string) ?? ''}
            onChange={(v) => setConfig({ ...config, eventType: v || undefined })}
            options={eventTypeOptions()}
          />
          <SelectInput
            label="Day of week (optional)"
            value={(config['dayOfWeek'] as string) ?? 'any'}
            onChange={(v) => setConfig({ ...config, dayOfWeek: v === 'any' ? undefined : v })}
            options={dayOfWeekOptions()}
          />
          {triggerType === 'event_updated' && (
            <SelectInput
              label="Only when this changed (optional)"
              value={(config['changed'] as string) ?? 'any'}
              onChange={(v) => setConfig({ ...config, changed: v === 'any' ? undefined : v })}
              options={[
                { value: 'any', label: 'Anything changed' },
                { value: 'date', label: 'Date changed' },
                { value: 'venue', label: 'Venue changed' },
              ]}
            />
          )}
        </>
      )}

      {(triggerType === 'time_before_event' || triggerType === 'time_after_event') && (
        <>
          {/* Day-grain only — the offset is a number of days (no unit
              picker), so the daily cron can serve it without Vercel Pro.
              `unit: 'days'` is set explicitly so the emitter's
              day-grain guard always matches. */}
          <NumberInput
            label={triggerType === 'time_before_event' ? 'Days before the event' : 'Days after the event'}
            value={Number(config['amount'] ?? 1)}
            onChange={(v) => setConfig({ ...config, amount: v, unit: 'days' })}
          />
          <SelectInput
            label="Anchor to event type (optional)"
            value={(config['eventType'] as string) ?? ''}
            onChange={(v) => setConfig({ ...config, eventType: v || undefined })}
            options={eventTypeOptions()}
          />
        </>
      )}

      {triggerType === 'specific_date_reached' && (
        <>
          <DateInput
            label="Date"
            value={(config['date'] as string) ?? ''}
            onChange={(v) => setConfig({ ...config, date: v })}
          />
          <CheckboxField
            label="Repeat every year on this date"
            checked={config['repeatYearly'] === true}
            onChange={(v) => setConfig({ ...config, repeatYearly: v || undefined })}
          />
        </>
      )}

      {triggerType === 'anniversary_of_event' && (
        <>
          <NumberInput
            label="Years after the event"
            value={Number(config['years'] ?? 1)}
            onChange={(v) => setConfig({ ...config, years: v })}
          />
          <NumberInput
            label="Stop after N years (optional, leave 0 to fire once)"
            value={Number(config['maxYears'] ?? 0)}
            onChange={(v) => setConfig({ ...config, maxYears: v || undefined })}
          />
        </>
      )}

      {(triggerType === 'section_completed' ||
        triggerType === 'portal_section_started_not_finished') && (
        <>
          <SelectInput
            label="Section (optional)"
            value={(config['section'] as string) ?? ''}
            onChange={(v) => setConfig({ ...config, section: v || undefined })}
            options={sectionOptions()}
          />
          {triggerType === 'section_completed' && (config['section'] as string) === 'people' && (
            <SelectInput
              label="People category (optional)"
              value={(config['category'] as string) ?? ''}
              onChange={(v) => setConfig({ ...config, category: v || undefined })}
              options={peopleCategoryOptions()}
            />
          )}
          {triggerType === 'portal_section_started_not_finished' && (
            <NumberInput
              label="Days inactive"
              value={Number(config['days'] ?? 7)}
              onChange={(v) => setConfig({ ...config, days: v })}
            />
          )}
        </>
      )}

      {triggerType === 'task_overdue' && (
        <NumberInput
          label="Minimum days overdue (optional)"
          value={Number(config['daysOverdueMin'] ?? 0)}
          onChange={(v) => setConfig({ ...config, daysOverdueMin: v || undefined })}
        />
      )}

      {(triggerType === 'contact_created' ||
        triggerType === 'contact_updated' ||
        triggerType === 'contact_linked_to_couple') && (
        <>
          <SelectInput
            label="Contact category (optional)"
            value={(config['category'] as string) ?? ''}
            onChange={(v) => setConfig({ ...config, category: v || undefined })}
            options={contactCategoryOptions()}
          />
          <CheckboxField
            label="Only when the contact has an email"
            checked={config['hasEmail'] === true}
            onChange={(v) => setConfig({ ...config, hasEmail: v || undefined })}
          />
        </>
      )}

      {NO_CONFIG_HINT_TRIGGERS.has(triggerType) && (
        <div className="text-caption text-text-muted">
          This trigger fires whenever the event happens. No extra
          parameters needed. Add steps below to define what runs.
        </div>
      )}

      {/* Phase 14a extended trigger fields — appended after the legacy fields so the
          inspector keeps its current shape and new params layer on top. */}
      <ExtendedTriggerFields triggerType={triggerType} config={config} setConfig={setConfig} />
    </div>
  )
}

/* ─── Reusable composite fields ────────────────────────────────── */

function DaysUntilEventFields({
  config,
  setConfig,
  label,
}: {
  config: Record<string, unknown>
  setConfig: (c: Record<string, unknown>) => void
  label: string
}) {
  return (
    <NumericComparisonFields
      label={label}
      opField="daysUntilEventOp"
      valueField="daysUntilEventValue"
      config={config}
      setConfig={setConfig}
    />
  )
}

function NumericComparisonFields({
  label,
  opField,
  valueField,
  config,
  setConfig,
}: {
  label: string
  opField: string
  valueField: string
  config: Record<string, unknown>
  setConfig: (c: Record<string, unknown>) => void
}) {
  const op = (config[opField] as ComparisonOp | undefined) ?? ''
  const value = config[valueField] as number | undefined
  return (
    <div>
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <SelectInput
          label=""
          value={op}
          onChange={(v) => setConfig({ ...config, [opField]: v || undefined })}
          options={[
            { value: '', label: 'Any value' },
            ...COMPARISON_OPS.map((o) => ({ value: o, label: COMPARISON_OP_LABELS[o] })),
          ]}
        />
        <NumberInput
          label=""
          value={value ?? 0}
          onChange={(v) => setConfig({ ...config, [valueField]: v })}
        />
      </div>
    </div>
  )
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return <Checkbox label={label} checked={checked} onChange={onChange} />
}

function CoupleStatusSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [statuses, setStatuses] = useState<CoupleStatus[]>([])
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('couple_statuses' as never)
      .select('slug,name')
      .order('position', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setStatuses(((data as CoupleStatus[] | null) ?? []))
      })
    return () => { cancelled = true }
  }, [])
  const options = [{ value: '', label: 'Any status' }].concat(
    statuses.map((s) => ({ value: s.slug, label: s.name })),
  )
  return <SelectInput label={label} value={value} onChange={onChange} options={options} />
}

/* ─── Option builders (single source of truth via constants) ───── */

function eventTypeOptions() {
  return [
    { value: '', label: 'Any event type' },
    ...EVENT_TYPES.map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t] })),
  ]
}

function sectionOptions() {
  return [
    { value: '', label: 'Any section' },
    ...PORTAL_SECTIONS.map((s) => ({ value: s, label: PORTAL_SECTION_LABELS[s] })),
  ]
}

function peopleCategoryOptions() {
  return [
    { value: '', label: 'Any people category' },
    ...PEOPLE_CATEGORIES.map((c) => ({ value: c, label: PEOPLE_CATEGORY_LABELS[c] })),
  ]
}

function contactCategoryOptions() {
  return [
    { value: '', label: 'Any category' },
    ...CONTACT_CATEGORIES.map((c) => ({ value: c, label: CONTACT_CATEGORY_LABELS[c] })),
  ]
}

function dayOfWeekOptions() {
  return DAY_OF_WEEK_BUCKETS.map((d) => ({ value: d, label: DAY_OF_WEEK_LABELS[d] }))
}

function leadSourceOptions() {
  return [
    { value: '', label: 'Any source' },
    ...LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] })),
  ]
}

const NO_CONFIG_HINT_TRIGGERS = new Set<TriggerType>([
  'contract_created',
  'contract_sent',
  'contract_signed',
  'contract_declined',
  'contract_revoked',
  'contract_expired',
  'document_signed',
  'timeline_edited',
  'task_created',
  'task_completed',
  'payment_failed',
  'manual_fire',
])

/* ─── Couple-stage fields (loads user's status list from DB) ──── */

interface CoupleStatus { slug: string; name: string }

function CoupleStageFields({
  config,
  setConfig,
}: {
  config: Record<string, unknown>
  setConfig: (c: Record<string, unknown>) => void
}) {
  return (
    <>
      <CoupleStatusSelect
        label="From status (optional)"
        value={(config['fromStatus'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, fromStatus: v || undefined })}
      />
      <CoupleStatusSelect
        label="To status (optional)"
        value={(config['toStatus'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, toStatus: v || undefined })}
      />
    </>
  )
}

/* ─── Action config form (action / wait / branch / stop / approval) ─ */

function ActionConfigForm({
  action,
  automationId,
  onSaved,
}: {
  action: AutomationActionRow
  automationId: string
  onSaved: (payload: SavedPayload) => void
}) {
  const [config, setConfig] = useState<Record<string, unknown>>((action.config as Record<string, unknown>) ?? {})

  useDebouncedAutosave(config, () => {
    onSaved({ kind: 'action', actionId: action.id, config })
    void upsertAutomationActionRow({
      actionId: action.id,
      automationId,
      position: action.position,
      type: action.type,
      config: config as never,
      label: (action.label ?? undefined) as string | undefined,
      parentActionId: action.parent_action_id,
      branchPath: action.branch_path,
    })
  })

  return (
    <div className="space-y-3">
      {action.type === 'wait' && (
        <>
          <WaitFields config={config} setConfig={setConfig} />
          <WaitExtraFields config={config} setConfig={setConfig} />
        </>
      )}
      {action.type === 'branch' && (
        <>
          <BranchFields config={config} setConfig={setConfig} />
          <BranchExtraFields config={config} setConfig={setConfig} />
        </>
      )}
      {action.type !== 'wait' && action.type !== 'branch' && action.type !== 'approval' && action.type !== 'sub_flow' && action.type !== 'stop' && <ActionFields actionType={action.type as ActionType} config={config} setConfig={setConfig} />}
      {action.type === 'approval' && (
        <>
          <ApprovalFields config={config} setConfig={setConfig} />
          <ApprovalExtraFields config={config} setConfig={setConfig} />
        </>
      )}
      {action.type === 'sub_flow' && (
        <>
          <SubFlowField config={config} setConfig={setConfig} />
          <SubFlowExtraFields config={config} setConfig={setConfig} />
        </>
      )}
      {action.type === 'stop' && (
        <>
          <TextInput
            label="Reason this run is stopping (optional)"
            placeholder="Shows in the audit log"
            value={(config['reason'] as string) ?? ''}
            onChange={(v) => setConfig({ ...config, reason: v })}
          />
          <StopExtraFields config={config} setConfig={setConfig} />
        </>
      )}
    </div>
  )
}

/**
 * Debounce config changes and call `fire` ~250ms after the user
 * stops editing. Skips the initial mount (no save when the form
 * first hydrates with the existing values).
 *
 * If the form unmounts while a save is pending (e.g. the user
 * closes the drawer 100ms after a keystroke), we flush the pending
 * save immediately so changes aren't lost.
 */
function useDebouncedAutosave(config: Record<string, unknown>, fire: () => void) {
  const mountedRef = useRef(false)
  // Latest `fire` callback, so the timeout always uses the current
  // closure (callers redefine `fire` every render against the latest
  // `config` reference).
  const fireRef = useRef(fire)
  fireRef.current = fire
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (pendingRef.current) clearTimeout(pendingRef.current)
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null
      fireRef.current()
    }, 250)
  }, [config])

  // Flush any pending save when the form unmounts.
  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        clearTimeout(pendingRef.current)
        fireRef.current()
      }
    }
  }, [])
}

/* ─── Wait step ────────────────────────────────────────────────── */

function WaitFields({ config, setConfig }: FieldProps) {
  const mode = (config['mode'] as string) ?? 'duration'
  return (
    <>
      <SelectInput
        label="When to resume"
        value={mode}
        onChange={(v) => setConfig({ ...config, mode: v })}
        options={[
          { value: 'duration', label: 'Wait a fixed amount of time' },
          { value: 'until_date', label: 'Wait until a specific date' },
          { value: 'relative_to_event', label: 'Wait until X before/after the event' },
        ]}
      />
      {mode === 'duration' && <DurationField config={config} setConfig={setConfig} />}
      {mode === 'until_date' && (
        <DateInput
          label="Resume on"
          value={(config['untilDate'] as string) ?? ''}
          onChange={(v) => setConfig({ ...config, untilDate: v })}
        />
      )}
      {mode === 'relative_to_event' && <RelativeFields config={config} setConfig={setConfig} />}
      <CheckboxField
        label="Defer into the next allowed window if it falls inside quiet hours"
        checked={config['respectQuietHours'] !== false}
        onChange={(v) => setConfig({ ...config, respectQuietHours: v })}
      />
    </>
  )
}

/**
 * Duration UX: ask "amount + unit" and persist as `durationMinutes`.
 * "Wait 1440 minutes" never reads naturally; "Wait 1 day" does.
 */
function DurationField({ config, setConfig }: FieldProps) {
  const minutes = Number(config['durationMinutes'] ?? 1440)
  const { amount, unit } = minutesToAmountUnit(minutes)
  function update(nextAmount: number, nextUnit: 'minutes' | 'hours' | 'days' | 'weeks') {
    setConfig({ ...config, durationMinutes: amountUnitToMinutes(nextAmount, nextUnit) })
  }
  return (
    <div>
      <Label>Wait for</Label>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="" value={amount} onChange={(v) => update(v, unit)} />
        <SelectInput
          label=""
          value={unit}
          onChange={(v) => update(amount, v as 'minutes' | 'hours' | 'days' | 'weeks')}
          options={TIME_UNITS.map((u) => ({ value: u, label: TIME_UNIT_LABELS[u] }))}
        />
      </div>
    </div>
  )
}

function minutesToAmountUnit(min: number): { amount: number; unit: 'minutes' | 'hours' | 'days' | 'weeks' } {
  if (min % (60 * 24 * 7) === 0 && min >= 60 * 24 * 7) return { amount: min / (60 * 24 * 7), unit: 'weeks' }
  if (min % (60 * 24) === 0 && min >= 60 * 24) return { amount: min / (60 * 24), unit: 'days' }
  if (min % 60 === 0 && min >= 60) return { amount: min / 60, unit: 'hours' }
  return { amount: min, unit: 'minutes' }
}

function amountUnitToMinutes(amount: number, unit: 'minutes' | 'hours' | 'days' | 'weeks'): number {
  switch (unit) {
    case 'weeks': return amount * 60 * 24 * 7
    case 'days': return amount * 60 * 24
    case 'hours': return amount * 60
    case 'minutes': return amount
  }
}

function RelativeFields({ config, setConfig }: FieldProps) {
  const r = (config['relative'] as { amount?: number; unit?: string; direction?: string }) ?? {}
  function update(patch: Partial<typeof r>) {
    setConfig({ ...config, relative: { amount: 1, unit: 'weeks', direction: 'before', anchor: 'event_date', ...r, ...patch } })
  }
  return (
    <>
      <div>
        <Label>Time offset</Label>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="" value={r.amount ?? 1} onChange={(v) => update({ amount: v })} />
          <SelectInput
            label=""
            value={r.unit ?? 'weeks'}
            onChange={(v) => update({ unit: v })}
            options={TIME_UNITS.map((u) => ({ value: u, label: TIME_UNIT_LABELS[u] }))}
          />
        </div>
      </div>
      <SelectInput
        label="Direction"
        value={r.direction ?? 'before'}
        onChange={(v) => update({ direction: v })}
        options={[
          { value: 'before', label: 'Before the event' },
          { value: 'after', label: 'After the event' },
        ]}
      />
    </>
  )
}

/* ─── Branch step ──────────────────────────────────────────────── */

function BranchFields({ config, setConfig }: FieldProps) {
  const predicate = (config['predicate'] as { kind?: string; days?: number; op?: string; field?: string; key?: string; value?: unknown }) ?? { kind: 'event_in', op: '<', days: 60 }
  function setKind(kind: string) {
    if (kind === 'event_in') setConfig({ ...config, predicate: { kind, op: '<', days: 60 } })
    else if (kind === 'couple_field') setConfig({ ...config, predicate: { kind, field: 'status', op: 'eq', value: '' } })
    else if (kind === 'custom_field') setConfig({ ...config, predicate: { kind, key: '', op: 'eq', value: '' } })
    else setConfig({ ...config, predicate: { kind } })
  }
  return (
    <>
      <SelectInput
        label="Branch on"
        value={predicate.kind ?? 'event_in'}
        onChange={setKind}
        options={[
          { value: 'event_in', label: 'Event is X days away' },
          { value: 'has_signed_contract', label: 'Couple has signed the contract' },
          { value: 'has_paid_deposit', label: 'Couple has paid the deposit' },
          { value: 'couple_field', label: 'A couple field equals…' },
          { value: 'custom_field', label: 'A custom field equals…' },
        ]}
      />
      {predicate.kind === 'event_in' && (
        <div>
          <Label>Event is</Label>
          <div className="grid grid-cols-2 gap-2">
            <SelectInput
              label=""
              value={predicate.op ?? '<'}
              onChange={(v) => setConfig({ ...config, predicate: { ...predicate, op: v } })}
              options={[
                { value: '<', label: 'less than' },
                { value: '<=', label: 'at most' },
                { value: '>', label: 'more than' },
                { value: '>=', label: 'at least' },
              ]}
            />
            <NumberInput
              label=""
              value={predicate.days ?? 60}
              onChange={(v) => setConfig({ ...config, predicate: { ...predicate, days: v } })}
            />
          </div>
          <div className="text-caption text-text-muted mt-1">days away from today.</div>
        </div>
      )}
      {predicate.kind === 'couple_field' && (
        <>
          <TextInput
            label="Couple field name"
            placeholder="e.g. status, lead_source, venue"
            value={(predicate.field as string) ?? ''}
            onChange={(v) => setConfig({ ...config, predicate: { ...predicate, field: v } })}
          />
          <BranchValueOpFields predicate={predicate} config={config} setConfig={setConfig} />
        </>
      )}
      {predicate.kind === 'custom_field' && (
        <>
          <TextInput
            label="Custom field key"
            placeholder="e.g. ceremony_style"
            value={(predicate.key as string) ?? ''}
            onChange={(v) => setConfig({ ...config, predicate: { ...predicate, key: v } })}
          />
          <BranchValueOpFields predicate={predicate} config={config} setConfig={setConfig} />
        </>
      )}
    </>
  )
}

function BranchValueOpFields({
  predicate,
  config,
  setConfig,
}: {
  predicate: Record<string, unknown>
  config: Record<string, unknown>
  setConfig: (c: Record<string, unknown>) => void
}) {
  return (
    <>
      <SelectInput
        label="Comparison"
        value={(predicate['op'] as string) ?? 'eq'}
        onChange={(v) => setConfig({ ...config, predicate: { ...predicate, op: v } })}
        options={[
          { value: 'eq', label: 'equals' },
          { value: 'neq', label: 'does not equal' },
          { value: 'contains', label: 'contains' },
          { value: 'is_set', label: 'is set' },
          { value: 'is_unset', label: 'is not set' },
          { value: 'gt', label: 'greater than (numeric)' },
          { value: 'gte', label: 'at least (numeric)' },
          { value: 'lt', label: 'less than (numeric)' },
          { value: 'lte', label: 'at most (numeric)' },
        ]}
      />
      {predicate['op'] !== 'is_set' && predicate['op'] !== 'is_unset' && (
        <TextInput
          label="Value"
          value={String(predicate['value'] ?? '')}
          onChange={(v) => setConfig({ ...config, predicate: { ...predicate, value: v } })}
        />
      )}
    </>
  )
}

/* ─── Approval step ────────────────────────────────────────────── */

function ApprovalFields({ config, setConfig }: FieldProps) {
  return (
    <>
      <TextInput
        label="Prompt the approver sees"
        value={(config['prompt'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, prompt: v })}
      />
      <TextInput
        label="Send the approval link to"
        placeholder="you@example.com"
        value={(config['approverEmail'] as string) ?? ''}
        onChange={(v) => setConfig({ ...config, approverEmail: v })}
      />
      <NumberInput
        label="Auto-cancel if not approved within (days)"
        value={Number(config['expiresInDays'] ?? 3)}
        onChange={(v) => setConfig({ ...config, expiresInDays: v })}
      />
      <Hint>The approver gets a magic-link email with Approve / Deny buttons. The run pauses until they click one or the link expires.</Hint>
    </>
  )
}

/* ─── Action step dispatch ─────────────────────────────────────── */

function ActionFields({ actionType, config, setConfig }: FieldProps & { actionType: ActionType }) {
  // The action's `type` lives at the row level, not inside `config`.
  // Reading it off `config['type']` (the prior shape) always
  // returned undefined — every registered action's inspector
  // rendered as an empty panel until this prop landed.
  const recipients = (config['recipients'] as RecipientConfig | undefined)
  function updateInner(patch: Record<string, unknown>) {
    setConfig({ ...config, ...patch })
  }
  function updateRecipients(next: RecipientConfig) {
    setConfig({ ...config, recipients: next })
  }

  switch (actionType) {
    case 'send_email':
      return (
        <SendEmailForm
          config={config}
          updateConfig={updateInner}
          recipients={recipients}
          updateRecipients={updateRecipients}
        />
      )
    case 'send_sms':
    case 'send_whatsapp':
      return (
        <SendMessagingForm
          config={config}
          updateConfig={updateInner}
          recipients={recipients}
          updateRecipients={updateRecipients}
          channel={actionType === 'send_sms' ? 'SMS' : 'WhatsApp'}
        />
      )
    case 'create_task':
      return <CreateTaskForm config={config} updateConfig={updateInner} />
    case 'update_task':
      return <UpdateTaskForm config={config} updateConfig={updateInner} />
    case 'update_couple_stage':
      return <UpdateCoupleStageForm config={config} updateConfig={updateInner} />
    case 'add_note':
      return <AddNoteForm config={config} updateConfig={updateInner} />
    case 'update_custom_fields':
      return <UpdateCustomFieldsForm config={config} updateConfig={updateInner} />
    case 'send_portal_link':
      return (
        <>
          <MessageBodyForm config={config} updateConfig={updateInner} label="Message" />
          <SendPortalLinkExtraFields config={config} updateConfig={updateInner} />
        </>
      )
    case 'request_information':
      return <RequestInformationForm config={config} updateConfig={updateInner} />
    case 'create_couple':
      return <CreateCoupleForm config={config} updateConfig={updateInner} />
    case 'pause_couple_automations':
      return (
        <>
          <Hint>Pauses every other running automation on this couple.</Hint>
          <PauseCoupleExtraFields config={config} updateConfig={updateInner} />
        </>
      )
    case 'create_timeline_event':
      return <TimelineEventForm config={config} updateConfig={updateInner} requireExistingItem={false} />
    case 'update_timeline_event':
      return <TimelineEventForm config={config} updateConfig={updateInner} requireExistingItem={true} />
    case 'send_timeline_to_vendors':
    case 'send_final_run_sheet':
      return (
        <>
          <MessageBodyForm
            config={config}
            updateConfig={updateInner}
            label="Message to vendors"
            recipients={recipients}
            updateRecipients={updateRecipients}
          />
          <SendTimelineExtraFields config={config} updateConfig={updateInner} />
        </>
      )
    case 'create_calendar_event':
    case 'create_reminder':
      return <CalendarEntryForm config={config} updateConfig={updateInner} />
    case 'send_quote':
      return (
        <>
          <Hint>
            This action sends the most recent quote for the triggering couple. The picker
            auto-selects based on the trigger payload, or the latest draft if there isn't one.
          </Hint>
          <SendQuoteExtraFields config={config} updateConfig={updateInner} />
        </>
      )
    case 'send_contract':
      return (
        <>
          <Hint>
            This action sends the most recent contract for the triggering couple.
          </Hint>
          <SendContractExtraFields config={config} updateConfig={updateInner} />
        </>
      )
    case 'send_invoice':
      return (
        <>
          <Hint>
            This action sends the most recent invoice for the triggering couple.
          </Hint>
          <SendInvoiceExtraFields config={config} updateConfig={updateInner} />
        </>
      )
    case 'trigger_payment_reminder':
      return (
        <>
          <Hint>
            Re-sends the most recent unpaid invoice. Use the tone / escalation fields below
            to tier the message between first nudge and final notice.
          </Hint>
          <PaymentReminderExtraFields config={config} updateConfig={updateInner} />
        </>
      )
    case 'generate_run_sheet_pdf':
      return (
        <>
          <Hint>Renders a PDF run sheet from the couple's current event timeline.</Hint>
          <RunSheetExtraFields config={config} updateConfig={updateInner} />
        </>
      )
    case 'send_onboarding_pack':
    case 'send_pre_event_checklist':
    case 'send_thank_you_message':
    case 'send_anniversary_message':
      return (
        <>
          <SubjectBodyEmailForm config={config} updateConfig={updateInner} />
          <PostEventExtraFields config={config} updateConfig={updateInner} />
        </>
      )
    case 'request_review':
      return (
        <>
          <SubjectBodyEmailForm config={config} updateConfig={updateInner} />
          <PostEventExtraFields config={config} updateConfig={updateInner} isReview />
        </>
      )
    case 'send_referral_request':
      return (
        <>
          <SubjectBodyEmailForm config={config} updateConfig={updateInner} />
          <PostEventExtraFields config={config} updateConfig={updateInner} isReferral />
        </>
      )
    default:
      return <ExtendedActionForm actionType={actionType} config={config} updateConfig={updateInner} />
  }
}

/* ─── Sub-flow step ────────────────────────────────────────────── */

function SubFlowField({ config, setConfig }: FieldProps) {
  const [list, setList] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('automations' as never)
      .select('id,name')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setList(((data as { id: string; name: string }[] | null) ?? []))
      })
    return () => { cancelled = true }
  }, [])
  return (
    <SelectInput
      label="Automation to run"
      value={(config['automationId'] as string) ?? ''}
      onChange={(v) => setConfig({ ...config, automationId: v })}
      options={[
        { value: '', label: 'Choose an automation' },
        ...list.map((a) => ({ value: a.id, label: a.name })),
      ]}
    />
  )
}

/* ─── Action-specific forms ────────────────────────────────────── */

type ConfigProps = { config: Record<string, unknown>; updateConfig: (patch: Record<string, unknown>) => void }

interface RecipientConfig {
  roles: ('primary' | 'spouse' | 'family' | 'vendor' | 'custom' | 'me')[]
  customTag?: string
  fallback: 'primary_only' | 'skip' | 'error'
}

function SendEmailForm({
  config,
  updateConfig,
  recipients,
  updateRecipients,
}: ConfigProps & { recipients?: RecipientConfig; updateRecipients: (r: RecipientConfig) => void }) {
  const templateId = (config['templateId'] as string) ?? ''
  return (
    <>
      <RecipientsField recipients={recipients} update={updateRecipients} />
      <EmailTemplatePicker
        value={templateId}
        onChange={(id) => updateConfig({ templateId: id || undefined })}
      />
      {templateId ? (
        <p className="text-xs text-text-muted">
          This email uses a saved template — edit its subject and body in Templates. If a variable
          can&apos;t be filled for a couple, the run pauses and you&apos;ll be alerted to fix &amp;
          retry.
        </p>
      ) : (
        <>
          <TextInput
            label="Subject"
            value={(config['subject'] as string) ?? ''}
            onChange={(v) => updateConfig({ subject: v })}
          />
          <TextArea
            label="Body"
            rows={8}
            value={(config['body'] as string) ?? ''}
            onChange={(v) => updateConfig({ body: v })}
          />
          <InlineVariableHint />
        </>
      )}
      <CheckboxField
        label="Wrap with Zebri-branded HTML shell"
        checked={config['wrap'] !== false}
        onChange={(v) => updateConfig({ wrap: v })}
      />
      <SendEmailExtraFields config={config} updateConfig={updateConfig} />
    </>
  )
}

function SendMessagingForm({
  config,
  updateConfig,
  recipients,
  updateRecipients,
  channel,
}: ConfigProps & {
  recipients?: RecipientConfig
  updateRecipients: (r: RecipientConfig) => void
  channel: 'SMS' | 'WhatsApp'
}) {
  return (
    <>
      <Hint>{channel} sending isn't enabled yet. The action will fail at runtime until {channel} is wired (Phase 14b).</Hint>
      <RecipientsField recipients={recipients} update={updateRecipients} />
      <TextArea
        label="Message"
        rows={5}
        value={(config['body'] as string) ?? ''}
        onChange={(v) => updateConfig({ body: v })}
      />
      <InlineVariableHint />
    </>
  )
}

function SubjectBodyEmailForm({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <TextInput
        label="Subject"
        value={(config['subject'] as string) ?? ''}
        onChange={(v) => updateConfig({ subject: v })}
      />
      <TextArea
        label="Body"
        rows={10}
        value={(config['body'] as string) ?? ''}
        onChange={(v) => updateConfig({ body: v })}
      />
      <InlineVariableHint />
    </>
  )
}

function MessageBodyForm({
  config,
  updateConfig,
  label,
  recipients,
  updateRecipients,
}: ConfigProps & {
  label: string
  recipients?: RecipientConfig
  updateRecipients?: (r: RecipientConfig) => void
}) {
  return (
    <>
      {recipients !== undefined && updateRecipients && (
        <RecipientsField recipients={recipients} update={updateRecipients} />
      )}
      <TextArea
        label={label}
        rows={6}
        value={(config['message'] as string) ?? ''}
        onChange={(v) => updateConfig({ message: v })}
      />
      <InlineVariableHint />
    </>
  )
}

function CreateTaskForm({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <TextInput
        label="Task title"
        placeholder="e.g. Confirm ceremony song with couple"
        value={(config['title'] as string) ?? ''}
        onChange={(v) => updateConfig({ title: v })}
      />
      <TextArea
        label="Description (optional)"
        rows={3}
        value={(config['description'] as string) ?? ''}
        onChange={(v) => updateConfig({ description: v })}
      />
      <DueDateMode config={config} updateConfig={updateConfig} />
      <CreateTaskExtraFields config={config} updateConfig={updateConfig} />
    </>
  )
}

function DueDateMode({ config, updateConfig }: ConfigProps) {
  const mode: 'none' | 'date' | 'relative' = config['relativeToEvent']
    ? 'relative'
    : config['dueDate']
      ? 'date'
      : 'none'
  function setMode(next: 'none' | 'date' | 'relative') {
    if (next === 'none') updateConfig({ dueDate: undefined, relativeToEvent: undefined })
    else if (next === 'date') updateConfig({ relativeToEvent: undefined, dueDate: (config['dueDate'] as string) ?? '' })
    else updateConfig({ dueDate: undefined, relativeToEvent: (config['relativeToEvent'] as object) ?? { direction: 'before', amount: 7, unit: 'days' } })
  }
  return (
    <>
      <SelectInput
        label="Due date"
        value={mode}
        onChange={(v) => setMode(v as 'none' | 'date' | 'relative')}
        options={[
          { value: 'none', label: 'No due date' },
          { value: 'date', label: 'A specific date' },
          { value: 'relative', label: 'Relative to the event date' },
        ]}
      />
      {mode === 'date' && (
        <DateInput
          label="Due on"
          value={(config['dueDate'] as string) ?? ''}
          onChange={(v) => updateConfig({ dueDate: v })}
        />
      )}
      {mode === 'relative' && (
        <RelativeToEventField config={config} updateConfig={updateConfig} />
      )}
    </>
  )
}

function RelativeToEventField({ config, updateConfig }: ConfigProps) {
  const r = (config['relativeToEvent'] as { direction?: string; amount?: number; unit?: string }) ?? {}
  function update(patch: Partial<typeof r>) {
    updateConfig({ relativeToEvent: { direction: 'before', amount: 7, unit: 'days', ...r, ...patch } })
  }
  return (
    <>
      <div>
        <Label>Offset from event</Label>
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label="" value={r.amount ?? 7} onChange={(v) => update({ amount: v })} />
          <SelectInput
            label=""
            value={r.unit ?? 'days'}
            onChange={(v) => update({ unit: v })}
            options={[
              { value: 'days', label: 'Days' },
              { value: 'weeks', label: 'Weeks' },
            ]}
          />
        </div>
      </div>
      <SelectInput
        label="Direction"
        value={r.direction ?? 'before'}
        onChange={(v) => update({ direction: v })}
        options={[
          { value: 'before', label: 'Before the event' },
          { value: 'after', label: 'After the event' },
        ]}
      />
    </>
  )
}

function UpdateTaskForm({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <Hint>Updates the most recent task created by an earlier action. To target a specific task, paste its ID below.</Hint>
      <TextInput
        label="Task ID (optional)"
        placeholder="Leave blank to use the latest"
        value={(config['taskId'] as string) ?? ''}
        onChange={(v) => updateConfig({ taskId: v || undefined })}
      />
      <SelectInput
        label="Set status to (optional)"
        value={(config['status'] as string) ?? ''}
        onChange={(v) => updateConfig({ status: v || undefined })}
        options={[
          { value: '', label: 'Leave unchanged' },
          { value: 'todo', label: 'To do' },
          { value: 'in_progress', label: 'In progress' },
          { value: 'done', label: 'Done' },
        ]}
      />
      <TextInput
        label="Set title to (optional)"
        value={(config['title'] as string) ?? ''}
        onChange={(v) => updateConfig({ title: v || undefined })}
      />
      <TextArea
        label="Set description to (optional)"
        rows={3}
        value={(config['description'] as string) ?? ''}
        onChange={(v) => updateConfig({ description: v || undefined })}
      />
      <DateInput
        label="Set due date to (optional)"
        value={(config['dueDate'] as string) ?? ''}
        onChange={(v) => updateConfig({ dueDate: v || undefined })}
      />
      <UpdateTaskExtraFields config={config} updateConfig={updateConfig} />
    </>
  )
}

function UpdateCoupleStageForm({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <CoupleStatusSelect
        label="Move couple to status"
        value={(config['toStatus'] as string) ?? ''}
        onChange={(v) => updateConfig({ toStatus: v })}
      />
      <UpdateCoupleStageExtraFields config={config} updateConfig={updateConfig} />
    </>
  )
}

function AddNoteForm({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <TextArea
        label="Note text"
        rows={5}
        value={(config['text'] as string) ?? ''}
        onChange={(v) => updateConfig({ text: v })}
      />
      <Hint>Appends to the couple's notes with today's date.</Hint>
      <InlineVariableHint />
      <AddNoteExtraFields config={config} updateConfig={updateConfig} />
    </>
  )
}

function UpdateCustomFieldsForm({ config, updateConfig }: ConfigProps) {
  const fields = (config['fields'] as { key: string; value: unknown }[] | undefined) ?? []
  function setFields(next: { key: string; value: unknown }[]) {
    updateConfig({ fields: next })
  }
  return (
    <>
      <Label>Custom fields to set</Label>
      <div className="space-y-2">
        {fields.map((f, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
              <TextInput
                label=""
                placeholder="Key"
                value={f.key}
                onChange={(v) => setFields(fields.map((row, idx) => idx === i ? { ...row, key: v } : row))}
              />
              <TextInput
                label=""
                placeholder="Value"
                value={String(f.value ?? '')}
                onChange={(v) => setFields(fields.map((row, idx) => idx === i ? { ...row, value: v } : row))}
              />
            </div>
            <button
              type="button"
              onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
              className="h-8 px-2 text-caption text-text-muted hover:text-danger cursor-pointer"
              aria-label="Remove field"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFields([...fields, { key: '', value: '' }])}
          className="text-caption text-text-muted hover:text-text cursor-pointer"
        >
          + Add field
        </button>
      </div>
      <UpdateCustomFieldsExtraFields config={config} updateConfig={updateConfig} />
    </>
  )
}

function RequestInformationForm({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <SelectInput
        label="Portal section the couple is being asked to fill in"
        value={(config['section'] as string) ?? 'onboarding'}
        onChange={(v) => updateConfig({ section: v })}
        options={[
          { value: 'onboarding', label: 'Onboarding intro' },
          { value: 'pre_event', label: 'Pre-event details' },
          { value: 'day_of', label: 'Day-of run sheet' },
          { value: 'people', label: 'People (partner, family, bridal party)' },
          { value: 'songs', label: 'Music & songs' },
          { value: 'files', label: 'Files / documents' },
          { value: 'timeline', label: 'Timeline' },
        ]}
      />
      <TextArea
        label="Message"
        rows={5}
        value={(config['message'] as string) ?? ''}
        onChange={(v) => updateConfig({ message: v })}
      />
      <InlineVariableHint />
      <RequestInformationExtraFields config={config} updateConfig={updateConfig} />
    </>
  )
}

function CreateCoupleForm({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <TextInput
        label="Couple name"
        placeholder="e.g. Anna & Jake"
        value={(config['name'] as string) ?? ''}
        onChange={(v) => updateConfig({ name: v })}
      />
      <TextInput
        label="Primary email (optional)"
        value={(config['email'] as string) ?? ''}
        onChange={(v) => updateConfig({ email: v || undefined })}
      />
      <TextInput
        label="Primary phone (optional)"
        value={(config['phone'] as string) ?? ''}
        onChange={(v) => updateConfig({ phone: v || undefined })}
      />
      <DateInput
        label="Event date (optional)"
        value={(config['eventDate'] as string) ?? ''}
        onChange={(v) => updateConfig({ eventDate: v || undefined })}
      />
      <SelectInput
        label="Lead source (optional)"
        value={(config['leadSource'] as string) ?? ''}
        onChange={(v) => updateConfig({ leadSource: v || undefined })}
        options={[
          { value: '', label: 'No source' },
          ...LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] })),
        ]}
      />
      <CreateCoupleExtraFields config={config} updateConfig={updateConfig} />
    </>
  )
}

function TimelineEventForm({
  config,
  updateConfig,
  requireExistingItem,
}: ConfigProps & { requireExistingItem: boolean }) {
  return (
    <>
      {requireExistingItem && (
        <TextInput
          label="Timeline item ID"
          placeholder="Required - paste from the timeline view"
          value={(config['timelineItemId'] as string) ?? ''}
          onChange={(v) => updateConfig({ timelineItemId: v })}
        />
      )}
      <TextInput
        label="Title"
        placeholder="e.g. Ceremony"
        value={(config['title'] as string) ?? ''}
        onChange={(v) => updateConfig({ title: v })}
      />
      <TextArea
        label="Description (optional)"
        rows={3}
        value={(config['description'] as string) ?? ''}
        onChange={(v) => updateConfig({ description: v || undefined })}
      />
      <TextInput
        label="Start time (optional, HH:MM)"
        placeholder="e.g. 15:30"
        value={(config['startTime'] as string) ?? ''}
        onChange={(v) => updateConfig({ startTime: v || undefined })}
      />
      <NumberInput
        label="Duration in minutes (optional)"
        value={Number(config['durationMin'] ?? 0)}
        onChange={(v) => updateConfig({ durationMin: v || undefined })}
      />
      {!requireExistingItem && (
        <TextInput
          label="Event ID (optional)"
          placeholder="Leave blank to use the couple's main event"
          value={(config['eventId'] as string) ?? ''}
          onChange={(v) => updateConfig({ eventId: v || undefined })}
        />
      )}
      {requireExistingItem
        ? <UpdateTimelineEventExtraFields config={config} updateConfig={updateConfig} />
        : <TimelineEventExtraFields config={config} updateConfig={updateConfig} />}
    </>
  )
}

function CalendarEntryForm({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <TextInput
        label="Title"
        value={(config['title'] as string) ?? ''}
        onChange={(v) => updateConfig({ title: v })}
      />
      <DateInput
        label="Date"
        value={(config['date'] as string) ?? ''}
        onChange={(v) => updateConfig({ date: v })}
      />
      <TextArea
        label="Notes (optional)"
        rows={3}
        value={(config['notes'] as string) ?? ''}
        onChange={(v) => updateConfig({ notes: v || undefined })}
      />
      <CalendarEventExtraFields config={config} updateConfig={updateConfig} />
    </>
  )
}

/* ─── Recipients picker (multi-select roles + fallback) ────────── */

const RECIPIENT_ROLES: ('primary' | 'spouse' | 'family' | 'vendor' | 'me')[] = ['primary', 'spouse', 'family', 'vendor', 'me']
const RECIPIENT_ROLE_LABELS: Record<string, string> = {
  primary: 'Primary couple email',
  spouse: 'Spouse',
  family: 'Family contacts',
  vendor: 'Vendor contacts',
  me: 'Myself (your email)',
}

function RecipientsField({
  recipients,
  update,
}: {
  recipients?: RecipientConfig
  update: (r: RecipientConfig) => void
}) {
  const r: RecipientConfig = recipients ?? { roles: ['primary'], fallback: 'primary_only' }
  function toggleRole(role: 'primary' | 'spouse' | 'family' | 'vendor' | 'me') {
    const has = r.roles.includes(role)
    const next = has ? r.roles.filter((x) => x !== role) : [...r.roles, role]
    update({ ...r, roles: next.length > 0 ? next : ['primary'] })
  }
  return (
    <div>
      <Label>Send to</Label>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-2">
        {RECIPIENT_ROLES.map((role) => (
          <CheckboxField
            key={role}
            label={RECIPIENT_ROLE_LABELS[role]!}
            checked={r.roles.includes(role)}
            onChange={() => toggleRole(role)}
          />
        ))}
      </div>
      <SelectInput
        label="If none of those resolve"
        value={r.fallback}
        onChange={(v) => update({ ...r, fallback: v as RecipientConfig['fallback'] })}
        options={[
          { value: 'primary_only', label: 'Fall back to the primary couple email' },
          { value: 'skip', label: 'Skip this step silently' },
          { value: 'error', label: 'Fail the run' },
        ]}
      />
    </div>
  )
}

/* ─── Inline variable hint + generic hint banner ───────────────── */

/**
 * Collapsible variable reference. A controlled disclosure rather
 * than a native `<details>` so the expand/collapse animates — the
 * grid-rows 0fr→1fr transition tweens to the content's natural
 * height, which `max-height` hacks can't do reliably.
 */
function InlineVariableHint() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-control border border-border bg-surface-muted px-3 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 text-caption text-text-muted cursor-pointer select-none transition-colors hover:text-text"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          strokeWidth={1.5}
        />
        Available variables
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {VARIABLE_CATALOGUE.map((group) => (
              <div key={group.group}>
                <div className="text-[10px] uppercase tracking-wide text-text-subtle mt-1">{group.group}</div>
                {group.variables.map((v) => (
                  <div key={v.token} className="text-caption font-mono text-text-muted">{v.token}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-control border border-border bg-surface-muted px-3 py-2 text-caption text-text-muted">
      {children}
    </div>
  )
}

interface FieldProps {
  config: Record<string, unknown>
  setConfig: (c: Record<string, unknown>) => void
}

/* ─── Form primitives ─────────────────────────────────────────── */

/**
 * Standalone form label. Matches the design-system `Input`'s own
 * label rendering (text-caption font-medium text-text) so labels
 * on composite fields like `NumericComparisonFields` line up with
 * labels rendered by the Input / Select primitives.
 */
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-caption font-medium text-text mb-1">{children}</label>
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
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

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <DatePicker value={value} onChange={onChange} />
    </div>
  )
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  // Sync draft when the committed value changes from outside (e.g. a
  // different node is selected and the panel re-renders with new props).
  // Only update if the parsed value actually differs so we don't stomp
  // the user's in-progress edit (e.g. "1" would be overwritten by 1→"1"
  // unnecessarily, but that's a no-op anyway).
  useEffect(() => {
    if (Number(draft) !== value) setDraft(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function commit() {
    const parsed = Number(draft)
    const next = Number.isFinite(parsed) ? parsed : value
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  return (
    <Input
      label={label}
      size="sm"
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

/**
 * Textarea matching the design-system Input look. There's no
 * `Textarea` primitive yet, so this stays inline but uses the same
 * token-driven classes the `Input` primitive applies.
 */
function TextArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
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

/**
 * Thin wrapper around the design-system `Select` that keeps the
 * "empty string = no filter" API the forms use here while honouring
 * Radix's "values cannot be empty strings" rule.
 *
 * Options whose value is `''` are surfaced as a selectable "Any X"
 * entry (using `ANY_SENTINEL` internally) so the user can deselect
 * a filter by picking the sentinel option.
 */
function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const radixOptions = options.map((o) => ({
    value: o.value === '' ? ANY_SENTINEL : o.value,
    label: o.label,
  }))
  const radixValue = value === '' ? ANY_SENTINEL : value
  function handle(v: string) {
    onChange(v === ANY_SENTINEL ? '' : v)
  }
  return (
    <Select
      label={label}
      size="sm"
      value={radixValue}
      onValueChange={handle}
      options={radixOptions}
    />
  )
}

function actionHeaderLabel(action: AutomationActionRow): string {
  if (action.label) return action.label
  if (action.type === 'wait' || action.type === 'branch' || action.type === 'stop' || action.type === 'approval' || action.type === 'sub_flow') {
    return action.type[0]!.toUpperCase() + action.type.slice(1)
  }
  const spec = actionRegistry[action.type as ActionType]
  return spec?.ui.label ?? 'Action'
}

function actionSubLabel(action: AutomationActionRow): string {
  switch (action.type) {
    case 'wait':
      return 'Wait'
    case 'branch':
      return 'Branch'
    case 'stop':
      return 'Stop'
    case 'approval':
      return 'Approval'
    case 'sub_flow':
      return 'Sub-flow'
    default:
      return 'Action'
  }
}
