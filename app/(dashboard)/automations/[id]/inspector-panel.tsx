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

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { configWithDefaults } from '@/lib/automations/action-defaults'
import { actionUi } from '@/lib/automations/actions/ui'
import {
  ANY_SENTINEL,
  CONTACT_CATEGORIES,
  CONTACT_CATEGORY_LABELS,
  OFFERED_COMPARISON_OPS,
  COMPARISON_OP_LABELS,
  DAY_OF_WEEK_BUCKETS,
  DAY_OF_WEEK_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  PORTAL_SECTIONS,
  PORTAL_SECTION_LABELS,
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
  CREATE_COUPLE_CHIPS,
  RequestSectionChips,
  RUN_SHEET_CHIP,
  StageChips,
  TASK_STATUS_CHIP,
  taskDueChip,
} from './action-chips'
import { BranchChips } from './branch-chips'
import { DocumentComposerModal } from './document-composer-modal'
import { EmailComposerModal } from './email-composer-modal'
import {
  ApprovalExtraFields,
  CalendarEventExtraFields,
  ExtendedActionForm,
  ExtendedTriggerFields,
  RunSheetExtraFields,
  SubFlowExtraFields,
  UpdateCustomFieldsExtraFields,
  UpdateTimelineEventExtraFields,
} from './inspector-extended'
import { NoteComposerModal } from './note-composer-modal'
import { QuestionnaireComposerModal } from './questionnaire-composer-modal'
import { RunSheetComposerModal } from './run-sheet-composer-modal'
import { TaskComposerModal } from './task-composer-modal'
import { TimelineComposerModal } from './timeline-composer-modal'
import { TriggerFilterList } from './trigger-filter-list'
import { WAIT_CHIPS } from './wait-chips'

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
  // Confirm-before-delete is routed through the shared ConfirmDialog
  // modal rather than the browser's native confirm() (banned by the
  // design system).
  const [confirmOpen, setConfirmOpen] = useState(false)

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
          <div className="text-body font-semibold truncate">{meta.title}</div>
          {meta.description && (
            <div className="text-body text-text-muted mt-0.5 line-clamp-2">{meta.description}</div>
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
              onClick={() => setConfirmOpen(true)}
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

      {selection.kind === 'action' && onDeleteAction && (
        <ConfirmDialog
          open={confirmOpen}
          title="Delete action"
          description="Delete this action? This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirmOpen(false)
            void onDeleteAction(selection.action.id)
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </aside>
  )
}

function actionDescription(action: AutomationActionRow): string {
  if (action.type === 'wait' || action.type === 'branch' || action.type === 'stop' || action.type === 'approval' || action.type === 'sub_flow') {
    return ''
  }
  const ui = actionUi[action.type as ActionType]
  return ui?.description ?? ''
}

/* ─── Configure tab ───────────────────────────────────────────── */

/**
 * The per-step config form, without the drawer chrome around it.
 *
 * The builder renders step config inline inside the flow card, so it
 * needs the form on its own. This is the same component the inspector
 * drawer uses, exported rather than duplicated: the ~3,000 lines of
 * per-action forms below have exactly one home.
 */
/**
 * Actions whose whole config is a modal, so their node opens it
 * instead of expanding onto a card.
 *
 * The pre-composed sends qualify because their only other control —
 * `PostEventExtraFields` — was deleted once its inputs turned out to
 * be fields no handler read.
 */
export const MODAL_ACTIONS: ReadonlySet<string> = new Set([
  'send_email',
  'send_onboarding_pack',
  'send_pre_event_checklist',
  'send_thank_you_message',
  'send_anniversary_message',
  'request_review',
  'send_referral_request',
  // Not emails, same reasoning: a form (or a paragraph of prose) in a
  // 380px node is a cramped form.
  'create_task',
  'add_note',
  // Its email is canned, so the modal is a preview of what the couple
  // receives rather than a form.
  'send_couple_questionnaire',
  'create_timeline_event',
  'send_timeline_to_vendors',
  // Zero-config sends: the modal is purely a preview of what the
  // couple receives.
  'send_contract',
  'send_invoice',
])


export function StepConfigForm(props: {
  selection: Props['selection']
  automationId: string
  onSaved: (payload: SavedPayload) => void
  /**
   * Present for steps whose whole config is a modal (`send_email`).
   * The card then renders nothing inline: opening the node opens the
   * modal, and closing it collapses the node.
   */
  modal?: { open: boolean; onClose: () => void }
}) {
  return <ConfigureTab {...props} />
}

function ConfigureTab({
  selection,
  automationId,
  onSaved,
  modal,
}: {
  selection: Props['selection']
  automationId: string
  onSaved: (payload: SavedPayload) => void
  modal?: { open: boolean; onClose: () => void }
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
      {...(modal ? { modal } : {})}
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


  return (
    <div className="space-y-3">
      {/* `new_enquiry` is not handled here: its filters render as chips
          inside the step card itself (trigger-card-body.tsx). Triggers
          still on this legacy form migrate one at a time. */}

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

      {/* `couple_stage_changed` is chip-driven; see couple-stage-filters.tsx. */}

      {/* The invoice / payment triggers are chip-driven; see invoice-filters.tsx. */}

      {/* event_created / event_updated are chip-driven; see event-row-filters.tsx.
          event_deleted is hidden but old automations may still hold it. */}
      {triggerType === 'event_deleted' && (
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
        </>
      )}

      {/* time_before/after_event + anniversary_of_event are chip-driven;
          see event-row-filters.tsx. */}

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


      {/* section_completed is chip-driven; see portal-filters.tsx. */}
      {triggerType === 'portal_section_started_not_finished' && (
        <>
          <SelectInput
            label="Section (optional)"
            value={(config['section'] as string) ?? ''}
            onChange={(v) => setConfig({ ...config, section: v || undefined })}
            options={sectionOptions()}
          />
          <NumberInput
            label="Days inactive"
            value={Number(config['days'] ?? 7)}
            onChange={(v) => setConfig({ ...config, days: v })}
          />
        </>
      )}

      {/* The task triggers are chip-driven; see task-filters.tsx. */}

      {/* contact_created / contact_linked_to_couple are chip-driven; see
          contact-filters.tsx. contact_updated is hidden but may exist. */}
      {triggerType === 'contact_updated' && (
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
        <div className="text-body text-text-muted">
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
            ...OFFERED_COMPARISON_OPS.map((o) => ({ value: o, label: COMPARISON_OP_LABELS[o] })),
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

function contactCategoryOptions() {
  return [
    { value: '', label: 'Any category' },
    ...CONTACT_CATEGORIES.map((c) => ({ value: c, label: CONTACT_CATEGORY_LABELS[c] })),
  ]
}

function dayOfWeekOptions() {
  return DAY_OF_WEEK_BUCKETS.map((d) => ({ value: d, label: DAY_OF_WEEK_LABELS[d] }))
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

interface CoupleStatus { slug: string; name: string }

/* ─── Action config form (action / wait / branch / stop / approval) ─ */

function ActionConfigForm({
  action,
  automationId,
  onSaved,
  modal,
}: {
  action: AutomationActionRow
  automationId: string
  onSaved: (payload: SavedPayload) => void
  modal?: { open: boolean; onClose: () => void }
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
        <TriggerFilterList
          filters={WAIT_CHIPS}
          config={config}
          setConfig={setConfig}
          addLabel="Add option"
        />
      )}
      {action.type === 'branch' && <BranchChips config={config} setConfig={setConfig} />}
      {action.type !== 'wait' && action.type !== 'branch' && action.type !== 'approval' && action.type !== 'sub_flow' && action.type !== 'stop' && <ActionFields actionType={action.type as ActionType} config={config} setConfig={setConfig} {...(modal ? { modal } : {})} />}
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
      {/* `stop` has no config at all: its card does not expand. The
          reason field is gone — an audit-log note nobody asked for was
          the only thing keeping the card open. Saved reasons still
          parse and still narrate. */}
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

/* ─── Branch step ──────────────────────────────────────────────── */

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

function ActionFields({
  actionType,
  config,
  setConfig,
  modal,
}: FieldProps & {
  actionType: ActionType
  modal?: { open: boolean; onClose: () => void }
}) {
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
          {...(modal ? { modal } : {})}
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
      return modal ? (
        <TaskComposerModal
          isOpen={modal.open}
          onClose={modal.onClose}
          config={config}
          onSave={(draft) => setConfig(draft)}
        />
      ) : (
        <CreateTaskForm config={config} updateConfig={updateInner} replaceConfig={setConfig} />
      )
    case 'update_task':
      return <UpdateTaskForm config={config} updateConfig={updateInner} replaceConfig={setConfig} />
    case 'update_couple_stage':
      return <UpdateCoupleStageForm config={config} updateConfig={updateInner} replaceConfig={setConfig} />
    case 'send_couple_questionnaire':
      return modal ? (
        <QuestionnaireComposerModal
          isOpen={modal.open}
          onClose={modal.onClose}
          config={config}
          onSave={(draft) => setConfig(draft)}
        />
      ) : (
        <ExtendedActionForm actionType={actionType} config={config} updateConfig={updateInner} />
      )
    case 'add_note':
      return modal ? (
        <NoteComposerModal
          isOpen={modal.open}
          onClose={modal.onClose}
          config={config}
          onSave={(draft) => setConfig(draft)}
        />
      ) : (
        <AddNoteForm config={config} updateConfig={updateInner} />
      )
    case 'update_custom_fields':
      return <UpdateCustomFieldsForm config={config} updateConfig={updateInner} />
    case 'send_portal_link':
      // Retired from the picker (2026-08-16). Still rendered for
      // automations saved with it, and it still runs.
      return (
        <>
          <Hint>
            Legacy step: emails the couple their portal link with the message below. New
            automations should use “Send email” with the {'{{portal.link}}'} variable, which
            can say more than one line.
          </Hint>
          <MessageBodyForm config={config} updateConfig={updateInner} label="Message" />
        </>
      )
    case 'request_information':
      // Retired from the picker (2026-08-16). Still rendered for
      // automations saved with it, and it still runs.
      return (
        <>
          <Hint>
            Legacy step: emails the couple a link to one portal section with the message
            below. New automations should use “Send email”.
          </Hint>
          <RequestSectionChips config={config} setConfig={(c) => setConfig(c)} />
          <MessageBodyForm config={config} updateConfig={updateInner} label="Message" />
        </>
      )
    case 'create_couple':
      return <CreateCoupleForm config={config} updateConfig={updateInner} replaceConfig={setConfig} />
    case 'pause_couple_automations':
      // Retired from the picker (2026-08-15). Still rendered for
      // automations saved with it, and it still runs.
      return (
        <Hint>
          Legacy step: pauses every other running automation on this couple. No longer offered
          for new automations.
        </Hint>
      )
    case 'create_timeline_event':
      return modal ? (
        <TimelineComposerModal
          isOpen={modal.open}
          onClose={modal.onClose}
          config={config}
          onSave={(draft) => setConfig(draft)}
        />
      ) : (
        <TimelineEventForm config={config} updateConfig={updateInner} requireExistingItem={false} />
      )
    case 'update_timeline_event':
      return <TimelineEventForm config={config} updateConfig={updateInner} requireExistingItem={true} />
    case 'send_timeline_to_vendors':
      // "Send run sheet". Most of this email is the handler's — the
      // subject, the shell, the link — so the modal is a preview with
      // the two things the MC controls above it.
      return modal ? (
        <RunSheetComposerModal
          isOpen={modal.open}
          onClose={modal.onClose}
          config={config}
          onSave={(draft) => setConfig(draft)}
        />
      ) : (
        <TriggerFilterList
          filters={[RUN_SHEET_CHIP]}
          config={config}
          setConfig={(c) => setConfig(c as Record<string, unknown>)}
        />
      )
    case 'send_final_run_sheet':
      // Hidden from the picker (folded into "Send run sheet"); still
      // rendered for automations saved before the merge. Its handler
      // sends canned copy to vendors regardless of any message typed
      // here, so say that instead of offering a field it ignores.
      return (
        <Hint>
          Legacy step: emails the run sheet link to every vendor contact with a fixed
          message. New automations should use “Send run sheet”, which also reaches the
          couple or you.
        </Hint>
      )
    case 'create_calendar_event':
    case 'create_reminder':
      return <CalendarEntryForm config={config} updateConfig={updateInner} />
    case 'send_contract':
    case 'send_invoice': {
      const kind = actionType === 'send_contract' ? 'contract' : 'invoice'
      return modal ? (
        <DocumentComposerModal isOpen={modal.open} onClose={modal.onClose} kind={kind} />
      ) : (
        <Hint>This action sends the most recent {kind} for the triggering couple.</Hint>
      )
    }
    case 'trigger_payment_reminder':
      return (
        <>
          <Hint>
            Legacy step: identical to “Send invoice” — re-sends the couple’s most
            recent invoice.
          </Hint>
        </>
      )
    case 'generate_run_sheet_pdf':
      return (
        <>
          <Hint>
            Legacy step: emails you (and optionally the couple) the run sheet link. New
            automations should use “Send run sheet”.
          </Hint>
          <RunSheetExtraFields config={config} updateConfig={updateInner} />
        </>
      )
    // The pre-composed sends are emails too, so they get the same
    // composer. Their handlers address the couple directly and read
    // none of the delivery options, so neither is offered.
    case 'send_onboarding_pack':
    case 'send_pre_event_checklist':
    case 'send_thank_you_message':
    case 'send_anniversary_message':
    case 'request_review':
    case 'send_referral_request':
      // Their copy lives in the schema as `.default()`, applied when
      // the runner parses rather than when the step is created — so
      // the stored config is `{}` and the modal would open blank on
      // an email that is fully written.
      return (
        <EmailContentSummary
          config={configWithDefaults(actionType, config)}
          updateConfig={updateInner}
          title={actionUi[actionType]?.label ?? 'Compose email'}
          showRecipients={false}
          showOptions={false}
          {...(modal ? { modal } : {})}
        />
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

/**
 * A form that hosts chips needs the replacing setter as well as the
 * merging one.
 *
 * `updateConfig` merges a patch, which is right for a field writing
 * one key. A chip's `remove` returns the whole config with its keys
 * *deleted*, and merging that over the old object resurrects them —
 * the chip disappears from the card while the runner keeps acting on
 * the value it claims was removed.
 */
type ChipHostProps = ConfigProps & { replaceConfig: (config: Record<string, unknown>) => void }

interface RecipientConfig {
  roles: ('primary' | 'spouse' | 'family' | 'vendor' | 'custom' | 'me')[]
  customTag?: string
  fallback: 'primary_only' | 'skip' | 'error'
}

/**
 * The card's stand-in for the email body: a one-line précis of what is
 * written, and the button that opens the composer.
 */
function EmailContentSummary({
  config,
  updateConfig,
  title,
  showRecipients = true,
  showOptions = true,
  modal,
}: ConfigProps & {
  title?: string
  showRecipients?: boolean
  showOptions?: boolean
  /** Card-less mode: the node itself opens and closes the composer. */
  modal?: { open: boolean; onClose: () => void }
}) {
  const [open, setOpen] = useState(false)
  const subject = (config['subject'] as string) ?? ''
  const attachments = Array.isArray(config['attachFiles'])
    ? (config['attachFiles'] as string[]).length
    : 0
  const hasBody = Boolean(config['content']) || Boolean(config['body'])

  const composer = (
    <EmailComposerModal
      isOpen={modal ? modal.open : open}
      onClose={modal ? modal.onClose : () => setOpen(false)}
      config={config}
      {...(title ? { title } : {})}
      showRecipients={showRecipients}
      showOptions={showOptions}
      // The composer owns the whole step config, so its draft is
      // written back wholesale.
      onSave={(draft) => updateConfig(draft)}
    />
  )

  // Nothing to show on the card: the summary the box would repeat is
  // already on the node's own title line.
  if (modal) return composer

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-control border border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-body text-text">
            {subject || <span className="text-text-subtle">No subject yet</span>}
          </p>
          <p className="text-body text-text-subtle">
            {hasBody ? 'Body written' : 'No body yet'}
            {attachments > 0
              ? ` · ${attachments} attachment${attachments === 1 ? '' : 's'}`
              : ''}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {hasBody || subject ? 'Edit email' : 'Write email'}
        </Button>
      </div>

      {composer}
    </>
  )
}

function SendEmailForm({
  config,
  updateConfig,
  modal,
}: ConfigProps & { modal?: { open: boolean; onClose: () => void } }) {
  // Every field lives in the composer; the card is its summary, or
  // nothing at all when the node opens the composer directly.
  return (
    <EmailContentSummary
      config={config}
      updateConfig={updateConfig}
      {...(modal ? { modal } : {})}
    />
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
      <Textarea
        label="Message"
        rows={5}
        value={(config['body'] as string) ?? ''}
        onChange={(e) => updateConfig({ body: e.target.value })}
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
      <Textarea
        label={label}
        rows={6}
        value={(config['message'] as string) ?? ''}
        onChange={(e) => updateConfig({ message: e.target.value })}
      />
      <InlineVariableHint />
    </>
  )
}

function CreateTaskForm({ config, updateConfig, replaceConfig }: ChipHostProps) {
  return (
    <>
      <TextInput
        label="Task title"
        placeholder="e.g. Confirm ceremony song with couple"
        value={(config['title'] as string) ?? ''}
        onChange={(v) => updateConfig({ title: v })}
      />
      <Textarea
        label="Description (optional)"
        rows={3}
        value={(config['description'] as string) ?? ''}
        onChange={(e) => updateConfig({ description: e.target.value })}
      />
      <TriggerFilterList
        filters={[taskDueChip(true)]}
        config={config}
        setConfig={(c) => replaceConfig(c)}
        addLabel="Add option"
      />
    </>
  )
}

function UpdateTaskForm({ config, updateConfig, replaceConfig }: ChipHostProps) {
  return (
    <>
      <Hint>
        Legacy step: updates the most recent task created by an earlier action, or the one
        whose ID is pasted below. No longer offered for new automations.
      </Hint>
      <TextInput
        label="Task ID (optional)"
        placeholder="Leave blank to use the latest"
        value={(config['taskId'] as string) ?? ''}
        onChange={(v) => updateConfig({ taskId: v || undefined })}
      />
      <TextInput
        label="Set title to (optional)"
        value={(config['title'] as string) ?? ''}
        onChange={(v) => updateConfig({ title: v || undefined })}
      />
      <Textarea
        label="Set description to (optional)"
        rows={3}
        value={(config['description'] as string) ?? ''}
        onChange={(e) => updateConfig({ description: e.target.value || undefined })}
      />
      <TriggerFilterList
        filters={[TASK_STATUS_CHIP, taskDueChip(false)]}
        config={config}
        setConfig={(c) => replaceConfig(c)}
        addLabel="Add option"
      />
    </>
  )
}

function UpdateCoupleStageForm({ config, replaceConfig }: ChipHostProps) {
  return <StageChips config={config} setConfig={(c) => replaceConfig(c)} />
}

function AddNoteForm({ config, updateConfig }: ConfigProps) {
  return (
    <>
      <Textarea
        label="Note text"
        rows={5}
        value={(config['text'] as string) ?? ''}
        onChange={(e) => updateConfig({ text: e.target.value })}
      />
      <Hint>Appends to the couple's notes with today's date.</Hint>
      <InlineVariableHint />
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
              className="h-8 px-2 text-body text-text-muted hover:text-danger cursor-pointer"
              aria-label="Remove field"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFields([...fields, { key: '', value: '' }])}
          className="text-body text-text-muted hover:text-text cursor-pointer"
        >
          + Add field
        </button>
      </div>
      <UpdateCustomFieldsExtraFields config={config} updateConfig={updateConfig} />
    </>
  )
}

function CreateCoupleForm({ config, updateConfig, replaceConfig }: ChipHostProps) {
  return (
    <>
      <TextInput
        label="Couple name"
        placeholder="e.g. Anna & Jake"
        value={(config['name'] as string) ?? ''}
        onChange={(v) => updateConfig({ name: v })}
      />
      {/* Everything else is optional, so it goes behind "Add option"
          rather than stacking five mostly-empty controls in a 380px
          node. */}
      <TriggerFilterList
        filters={CREATE_COUPLE_CHIPS}
        config={config}
        setConfig={(c) => replaceConfig(c as Record<string, unknown>)}
        addLabel="Add option"
      />
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
      <Textarea
        label="Description (optional)"
        rows={3}
        value={(config['description'] as string) ?? ''}
        onChange={(e) => updateConfig({ description: e.target.value || undefined })}
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
      {/* No "Event ID" field: it asked the MC to paste a UUID that no
          screen in the app shows, and the handler already falls back
          to the couple's own event when it is absent. */}
      {requireExistingItem && (
        <UpdateTimelineEventExtraFields config={config} updateConfig={updateConfig} />
      )}
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
      <Textarea
        label="Notes (optional)"
        rows={3}
        value={(config['notes'] as string) ?? ''}
        onChange={(e) => updateConfig({ notes: e.target.value || undefined })}
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
        className="flex w-full items-center gap-1.5 text-body text-text-muted cursor-pointer select-none transition-colors hover:text-text"
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
                  <div key={v.token} className="text-body font-mono text-text-muted">{v.token}</div>
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
    <div className="rounded-control border border-border bg-surface-muted px-3 py-2 text-body text-text-muted">
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
 * label rendering (text-body font-medium text-text) so labels
 * on composite fields like `NumericComparisonFields` line up with
 * labels rendered by the Input / Select primitives.
 */
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-body font-medium text-text mb-1">{children}</label>
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
  const ui = actionUi[action.type as ActionType]
  return ui?.label ?? 'Action'
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
