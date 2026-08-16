/**
 * Chip rows for action step cards.
 *
 * The step redesign rule: parameters and options render as chips, the
 * same vocabulary the trigger cards use; genuine content — a subject,
 * a body, a task title — stays a field, because prose is not a chip.
 * Every chip here writes values the action's runner-side Zod schema
 * accepts and its handler actually reads; the dead inputs the old
 * stacked forms carried are deleted, not restyled.
 *
 * @module app/(dashboard)/automations/[id]/action-chips
 */
'use client'

import { Check, ChevronLeft } from 'lucide-react'
import { useState } from 'react'

import { MenuItem } from '@/components/ui/menu'
import { LEAD_SOURCE_LABELS, LEAD_SOURCES, type LeadSource } from '@/types/couple'

import { ComparisonControl } from './filter-controls'
import { useCoupleStatuses, useQuestionnaireTemplateOptions } from './filter-options'
import { runSheetAudience } from './step-summary'
import { formatTimeLabel, timeOptions } from './time-options'
import {
  TriggerFilterList,
  configString as str,
  fieldFilter,
  type FilterConfig,
  type TriggerFilterDef,
} from './trigger-filter-list'

interface ChipRowProps {
  config: FilterConfig
  setConfig: (c: FilterConfig) => void
}

/* ─── update_couple_stage ──────────────────────────────────────── */

/** One required chip: which stage the couple moves to. */
export function StageChips({ config, setConfig }: ChipRowProps) {
  const statuses = useCoupleStatuses()
  const chip: TriggerFilterDef = {
    key: 'toStatus',
    label: 'Move to',
    chipLabel: 'move to',
    required: true,
    ...fieldFilter({ toStatus: '' }),
    current: (c) => str(c, 'toStatus'),
    valueLabel: (c) => {
      const value = str(c, 'toStatus')
      return value ? (statuses.find((s) => s.slug === value)?.name ?? value) : 'choose a stage'
    },
    summary: (c) => {
      const value = str(c, 'toStatus')
      return value
        ? `Move to ${statuses.find((s) => s.slug === value)?.name ?? value}`
        : 'No stage chosen'
    },
    options: statuses.map((s) => ({ value: s.slug, label: s.name })),
    apply: (c, value) => ({ ...c, toStatus: value }),
  }
  return <TriggerFilterList filters={[chip]} config={config} setConfig={setConfig} />
}

/* ─── request_information ──────────────────────────────────────── */

const PORTAL_SECTION_OPTIONS = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'pre_event', label: 'Pre-event details' },
  { value: 'day_of', label: 'Day-of details' },
  { value: 'people', label: 'People' },
  { value: 'songs', label: 'Songs' },
  { value: 'files', label: 'Files' },
  { value: 'timeline', label: 'Timeline' },
]

/** One required chip: which portal section the couple is asked to fill. */
export function RequestSectionChips({ config, setConfig }: ChipRowProps) {
  const chip: TriggerFilterDef = {
    key: 'section',
    label: 'Section',
    chipLabel: 'section',
    required: true,
    ...fieldFilter({ section: '' }),
    current: (c) => str(c, 'section'),
    valueLabel: (c) => {
      const value = str(c, 'section')
      return PORTAL_SECTION_OPTIONS.find((o) => o.value === value)?.label ?? 'choose a section'
    },
    summary: (c) => {
      const value = str(c, 'section')
      const label = PORTAL_SECTION_OPTIONS.find((o) => o.value === value)?.label
      return label ? `Asks for ${label}` : 'No section chosen'
    },
    options: PORTAL_SECTION_OPTIONS,
    apply: (c, value) => ({ ...c, section: value }),
  }
  return <TriggerFilterList filters={[chip]} config={config} setConfig={setConfig} />
}

/* ─── send_couple_questionnaire ────────────────────────────────── */

/** One required chip: which questionnaire template to send. */
export function QuestionnaireChips({ config, setConfig }: ChipRowProps) {
  const templates = useQuestionnaireTemplateOptions()
  const chip: TriggerFilterDef = {
    key: 'questionnaireTemplateId',
    label: 'Questionnaire',
    chipLabel: 'questionnaire',
    required: true,
    ...fieldFilter({ questionnaireTemplateId: '' }),
    current: (c) => str(c, 'questionnaireTemplateId'),
    valueLabel: (c) => {
      const value = str(c, 'questionnaireTemplateId')
      return templates.find((t) => t.value === value)?.label ?? 'choose one'
    },
    summary: (c) => {
      const value = str(c, 'questionnaireTemplateId')
      const label = templates.find((t) => t.value === value)?.label
      return label ? `Sends ${label}` : 'No questionnaire chosen'
    },
    options: templates,
    apply: (c, value) => ({ ...c, questionnaireTemplateId: value }),
  }
  return <TriggerFilterList filters={[chip]} config={config} setConfig={setConfig} />
}

/* ─── create_task / update_task due dates ──────────────────────── */

/** "7 days before the event" / "on 2027-01-01" / fallback. */
function dueLabel(config: FilterConfig): string {
  const relative = config['relativeToEvent'] as Record<string, unknown> | undefined
  if (relative) {
    const amount = typeof relative['amount'] === 'number' ? relative['amount'] : 7
    const unit = relative['unit'] === 'weeks' ? 'week' : 'day'
    const direction = relative['direction'] === 'after' ? 'after' : 'before'
    return `${amount} ${unit}${amount === 1 ? '' : 's'} ${direction} the event`
  }
  const date = str(config, 'dueDate')
  return date ? `on ${date}` : 'not set'
}

/** The four ways a relative due date can read, as one list. */
const DUE_OFFSETS: { unit: 'days' | 'weeks'; direction: 'before' | 'after'; label: string }[] = [
  { unit: 'days', direction: 'before', label: 'days before the event' },
  { unit: 'days', direction: 'after', label: 'days after the event' },
  { unit: 'weeks', direction: 'before', label: 'weeks before the event' },
  { unit: 'weeks', direction: 'after', label: 'weeks after the event' },
]

/** The two shapes a due date can take. */
const DUE_MODES: { value: 'relative' | 'date'; label: string }[] = [
  { value: 'relative', label: 'Relative to the event date' },
  { value: 'date', label: 'On a specific date' },
]

/**
 * Popover for the due chip, built like the branch's condition
 * popover: pick the shape, then fill that shape in.
 *
 * Unit and direction are one list rather than two — "7" plus "days
 * before the event" is a single thought, and splitting it into a
 * Days/Weeks list over a Before/After list made two decisions out of
 * it. The mode sits in the header row, which steps back to the list
 * of modes.
 */
function DuePopover({ config, setConfig }: ChipRowProps) {
  const relative = config['relativeToEvent'] as Record<string, unknown> | undefined
  const mode: 'relative' | 'date' = relative ? 'relative' : 'date'
  const [picking, setPicking] = useState(false)

  if (picking) {
    return (
      <>
        {DUE_MODES.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === mode}
            trailing={option.value === mode ? <Check size={14} strokeWidth={1.5} /> : null}
            onClick={() => {
              setConfig(
                option.value === 'relative'
                  ? {
                      ...config,
                      dueDate: undefined,
                      relativeToEvent: { direction: 'before', amount: 7, unit: 'days' },
                    }
                  : { ...config, relativeToEvent: undefined, dueDate: '' },
              )
              setPicking(false)
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </>
    )
  }

  const header = (
    <button
      type="button"
      onClick={() => setPicking(true)}
      className="flex w-full cursor-pointer items-center gap-1.5 border-b border-border px-3 py-2 text-left text-body text-text-muted transition-colors hover:text-text"
    >
      <ChevronLeft size={14} strokeWidth={1.5} />
      {DUE_MODES.find((m) => m.value === mode)?.label}
    </button>
  )

  if (!relative) {
    return (
      <>
        {header}
        <div className="px-3 py-2">
          <input
            type="date"
            value={str(config, 'dueDate')}
            onChange={(e) =>
              setConfig({ ...config, dueDate: e.target.value, relativeToEvent: undefined })
            }
            aria-label="Due on"
            className="w-full bg-transparent text-body text-text focus:outline-none"
          />
        </div>
      </>
    )
  }

  const amount = typeof relative['amount'] === 'number' ? relative['amount'] : 7
  const unit = relative['unit'] === 'weeks' ? 'weeks' : 'days'
  const direction = relative['direction'] === 'after' ? 'after' : 'before'
  const patch = (fields: Record<string, unknown>) =>
    setConfig({
      ...config,
      dueDate: undefined,
      relativeToEvent: { amount, unit, direction, ...fields },
    })

  return (
    <>
      {header}
      {/* The trigger filters' own number control. It only draws its
          own rule when it owns the operator rows too, so the wrapper
          supplies one here. */}
      <div className="border-b border-border">
        <ComparisonControl value={amount} onChange={(_op, next) => patch({ amount: next })} />
      </div>
      {DUE_OFFSETS.map((offset) => {
        const selected = offset.unit === unit && offset.direction === direction
        return (
          <MenuItem
            key={offset.label}
            selected={selected}
            trailing={selected ? <Check size={14} strokeWidth={1.5} /> : null}
            onClick={() => patch({ unit: offset.unit, direction: offset.direction })}
          >
            {offset.label}
          </MenuItem>
        )
      })}
    </>
  )
}

/**
 * Optional due-date chip for create_task. `withRelative` is off for
 * update_task, whose schema takes only a plain date.
 */
export function taskDueChip(withRelative: boolean): TriggerFilterDef {
  return {
    key: 'due',
    label: 'Due date',
    chipLabel: 'due',
    isActive: (c) => Boolean(c['dueDate'] !== undefined || c['relativeToEvent']),
    add: (c) =>
      withRelative
        ? { ...c, relativeToEvent: { direction: 'before', amount: 7, unit: 'days' } }
        : { ...c, dueDate: '' },
    remove: (c) => ({ ...c, dueDate: undefined, relativeToEvent: undefined }),
    valueLabel: dueLabel,
    summary: (c) => `Due ${dueLabel(c)}`,
    render: withRelative
      ? (config, setConfig) => <DuePopover config={config} setConfig={setConfig} />
      : (config, setConfig) => (
          <div className="px-3 py-2">
            <input
              type="date"
              value={str(config, 'dueDate')}
              onChange={(e) => setConfig({ ...config, dueDate: e.target.value })}
              aria-label="Due on"
              className="w-full bg-transparent text-body text-text focus:outline-none"
            />
          </div>
        ),
  }
}

/** Optional status chip for update_task ("leave unchanged" = removed). */
export const TASK_STATUS_CHIP: TriggerFilterDef = {
  key: 'status',
  label: 'Set status',
  chipLabel: 'status',
  ...fieldFilter({ status: 'done' }),
  current: (c) => str(c, 'status'),
  valueLabel: (c) =>
    ({ todo: 'to do', in_progress: 'in progress', done: 'done' })[str(c, 'status')] ?? 'done',
  summary: (c) =>
    `Marks the task ${({ todo: 'to do', in_progress: 'in progress', done: 'done' })[str(c, 'status')] ?? 'done'}`,
  options: [
    { value: 'todo', label: 'To do' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'done', label: 'Done' },
  ],
  apply: (c, value) => ({ ...c, status: value }),
}

/* ─── create_couple ────────────────────────────────────────────── */

/** A chip holding one free-typed value, e.g. the new couple's phone. */
function textChip(
  key: string,
  label: string,
  placeholder: string,
  phrase: (value: string) => string,
  type: 'text' | 'email' | 'date' = 'text',
): TriggerFilterDef {
  return {
    key,
    label,
    chipLabel: label.toLowerCase(),
    ...fieldFilter({ [key]: '' }),
    valueLabel: (c) => str(c, key) || 'not set',
    summary: (c) => (str(c, key) ? phrase(str(c, key)) : ''),
    render: (config, setConfig) => (
      <div className="px-3 py-2">
        <input
          type={type}
          placeholder={placeholder}
          value={str(config, key)}
          onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
          aria-label={label}
          className="w-full bg-transparent text-body text-text placeholder:text-text-subtle focus:outline-none"
        />
      </div>
    ),
  }
}

/**
 * Everything optional on `create_couple`. The name stays a field —
 * it is the one thing the action cannot run without, and a name is
 * prose, not a parameter.
 */
export const CREATE_COUPLE_CHIPS: TriggerFilterDef[] = [
  textChip('email', 'Email', 'anna@example.com', (v) => `Email ${v}`, 'email'),
  textChip('phone', 'Phone', '0400 000 000', (v) => `Phone ${v}`),
  textChip('eventDate', 'Event date', '', (v) => `Wedding on ${v}`, 'date'),
  {
    key: 'leadSource',
    label: 'Lead source',
    chipLabel: 'source',
    ...fieldFilter({ leadSource: LEAD_SOURCES[0] }),
    current: (c) => str(c, 'leadSource'),
    valueLabel: (c) => LEAD_SOURCE_LABELS[str(c, 'leadSource') as LeadSource] ?? 'not set',
    summary: (c) => {
      const source = LEAD_SOURCE_LABELS[str(c, 'leadSource') as LeadSource]
      return source ? `From ${source}` : ''
    },
    options: LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] })),
    apply: (c, value) => ({ ...c, leadSource: value }),
  },
]

/* ─── send_timeline_to_vendors ─────────────────────────────────── */

/** The three run-sheet audiences, in the order the popover lists them. */
const RUN_SHEET_AUDIENCES: { key: string; label: string; on: (c: FilterConfig) => boolean }[] = [
  {
    key: 'sendToVendors',
    label: 'Vendor contacts',
    // Default on: a config saved before the recipient flags existed
    // has none of these keys and went to vendors.
    on: (c) => c['sendToVendors'] !== false,
  },
  { key: 'sendToCouple', label: 'The couple', on: (c) => c['sendToCouple'] === true },
  { key: 'sendToMe', label: 'Me', on: (c) => c['sendToMe'] === true },
]

/**
 * Required "send to" chip for the run sheet. A required chip rather
 * than an option: a run sheet nobody receives is not a step, it is a
 * no-op, so the parameter is always on the card.
 *
 * Multi-select: the three audiences are independent flags on the
 * handler, so picking one must not clear the others. Rows toggle and
 * the popover stays open, which is what separates this from the
 * single-choice chips.
 */
export const RUN_SHEET_CHIP: TriggerFilterDef = {
  key: 'runSheetAudience',
  label: 'Send to',
  chipLabel: 'send to',
  required: true,
  ...fieldFilter({ sendToVendors: true }),
  valueLabel: runSheetAudience,
  summary: (c) => `Sends the run sheet to ${runSheetAudience(c)}`,
  // The labels are phrases, and the default panel truncates.
  panelWidth: 'lg',
  render: (config, setConfig) => (
    <>
      {RUN_SHEET_AUDIENCES.map((audience) => {
        const on = audience.on(config)
        return (
          <MenuItem
            key={audience.key}
            checked={on}
            selected={on}
            // Trailing, not leading: a leading tick that is merely
            // invisible when off indents every unticked label.
            trailing={on ? <Check size={14} strokeWidth={1.5} /> : null}
            onClick={() => setConfig({ ...config, [audience.key]: !on })}
          >
            {audience.label}
          </MenuItem>
        )
      })}
    </>
  ),
}

/* ─── create_timeline_event ────────────────────────────────────── */

/**
 * When the item starts, and how long it runs.
 *
 * Both optional on the runner's side, so both are removable chips
 * behind "Add option" rather than fields that sit empty on every
 * card. The title and description stay fields: prose is not a chip.
 */
export const TIMELINE_ITEM_CHIPS: TriggerFilterDef[] = [
  {
    key: 'startTime',
    label: 'Start time',
    chipLabel: 'starts',
    ...fieldFilter({ startTime: '' }),
    current: (c) => str(c, 'startTime'),
    valueLabel: (c) => (str(c, 'startTime') ? formatTimeLabel(str(c, 'startTime')) : 'not set'),
    summary: (c) =>
      str(c, 'startTime') ? `Starts at ${formatTimeLabel(str(c, 'startTime'))}` : '',
    // Rows rather than the design-system Select: nothing inside a chip
    // popover may portal, and a Radix portal counts as an outside
    // interaction that dismisses the popover on the first click. The
    // options are the shared list, so this and `TimeField` cannot
    // drift.
    render: (config, setConfig) => (
      <div className="max-h-72 overflow-y-auto">
        {timeOptions(str(config, 'startTime')).map((option) => {
          const selected = option.value === str(config, 'startTime')
          return (
            <MenuItem
              key={option.value}
              selected={selected}
              trailing={selected ? <Check size={14} strokeWidth={1.5} /> : null}
              onClick={() => setConfig({ ...config, startTime: option.value })}
            >
              {option.label}
            </MenuItem>
          )
        })}
      </div>
    ),
  },
  {
    key: 'durationMin',
    label: 'Duration',
    chipLabel: 'runs for',
    ...fieldFilter({ durationMin: 30 }),
    valueLabel: (c) => {
      const minutes = Number(c['durationMin'] ?? 0)
      return minutes > 0 ? `${minutes} min` : 'not set'
    },
    summary: (c) => {
      const minutes = Number(c['durationMin'] ?? 0)
      return minutes > 0 ? `Runs for ${minutes} min` : ''
    },
    // The trigger filters' own number control, so this reads like
    // every other quantity in the builder.
    render: (config, setConfig) => (
      <ComparisonControl
        value={Number(config['durationMin'] ?? 30)}
        unit="minutes"
        onChange={(_op, value) => setConfig({ ...config, durationMin: value })}
      />
    ),
  },
]

/* ─── send_email options ───────────────────────────────────────── */

/**
 * The optional extras on send_email, behind "Add option". Branded
 * wrap defaults on, so its chip exists to turn it off; the rest are
 * off until added.
 */
export const EMAIL_OPTION_CHIPS: TriggerFilterDef[] = [
  {
    key: 'wrap',
    label: 'Branded shell',
    chipLabel: 'shell',
    ...fieldFilter({ wrap: true }),
    current: (c) => (c['wrap'] === false ? 'plain' : 'branded'),
    valueLabel: (c) => (c['wrap'] === false ? 'plain email' : 'branded'),
    summary: (c) => (c['wrap'] === false ? 'Sent as plain email' : 'Branded shell'),
    options: [
      { value: 'branded', label: 'Zebri-branded shell' },
      { value: 'plain', label: 'Plain email' },
    ],
    apply: (c, value) => ({ ...c, wrap: value === 'branded' }),
  },
  {
    key: 'replyToOverride',
    label: 'Reply-to address',
    chipLabel: 'reply-to',
    ...fieldFilter({ replyToOverride: '' }),
    valueLabel: (c) => str(c, 'replyToOverride') || 'your email',
    summary: (c) => {
      const value = str(c, 'replyToOverride')
      return value ? `Replies go to ${value}` : ''
    },
    render: (config, setConfig) => (
      <div className="px-3 py-2">
        <input
          type="email"
          placeholder="you@your-business.com"
          value={str(config, 'replyToOverride')}
          onChange={(e) => setConfig({ ...config, replyToOverride: e.target.value })}
          aria-label="Reply-to address"
          className="w-full bg-transparent text-body text-text placeholder:text-text-subtle focus:outline-none"
        />
      </div>
    ),
  },
]
