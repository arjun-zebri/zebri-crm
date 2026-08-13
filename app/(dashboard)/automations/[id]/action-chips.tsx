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

import { Check } from 'lucide-react'

import { MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu'

import { useCoupleStatuses, useQuestionnaireTemplateOptions } from './filter-options'
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

/** Popover for the due chip: date field + relative editor + mode rows. */
function DueControl(config: FilterConfig, setConfig: (c: FilterConfig) => void) {
  const relative = config['relativeToEvent'] as Record<string, unknown> | undefined
  const mode = relative ? 'relative' : 'date'

  return (
    <>
      {mode === 'date' ? (
        <div className="border-b border-border px-3 py-2">
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
      ) : (
        <>
          {[1, 3, 7, 14, 30].map((n) => {
            const amount = typeof relative?.['amount'] === 'number' ? relative['amount'] : 7
            const selected = amount === n && relative?.['unit'] !== 'weeks'
            return (
              <MenuItem
                key={n}
                selected={selected}
                trailing={selected ? <Check size={14} strokeWidth={1.5} /> : null}
                onClick={() =>
                  setConfig({
                    ...config,
                    dueDate: undefined,
                    relativeToEvent: { ...relative, amount: n, unit: 'days' },
                  })
                }
              >
                {n} day{n === 1 ? '' : 's'}
              </MenuItem>
            )
          })}
          <MenuSeparator />
          {(['before', 'after'] as const).map((d) => {
            const direction = relative?.['direction'] === 'after' ? 'after' : 'before'
            return (
              <MenuItem
                key={d}
                selected={d === direction}
                trailing={d === direction ? <Check size={14} strokeWidth={1.5} /> : null}
                onClick={() =>
                  setConfig({
                    ...config,
                    dueDate: undefined,
                    relativeToEvent: { amount: 7, unit: 'days', ...relative, direction: d },
                  })
                }
              >
                {d === 'before' ? 'Before the event' : 'After the event'}
              </MenuItem>
            )
          })}
        </>
      )}
      <MenuSeparator />
      <MenuLabel>Due…</MenuLabel>
      {[
        { key: 'date', label: 'On a specific date' },
        { key: 'relative', label: 'Relative to the event date' },
      ].map((row) => (
        <MenuItem
          key={row.key}
          selected={row.key === mode}
          trailing={row.key === mode ? <Check size={14} strokeWidth={1.5} /> : null}
          onClick={() => {
            if (row.key === mode) return
            if (row.key === 'date') {
              setConfig({ ...config, relativeToEvent: undefined, dueDate: '' })
            } else {
              setConfig({
                ...config,
                dueDate: undefined,
                relativeToEvent: { direction: 'before', amount: 7, unit: 'days' },
              })
            }
          }}
        >
          {row.label}
        </MenuItem>
      ))}
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
      ? DueControl
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
    key: 'ccVendors',
    label: 'CC vendors',
    chipLabel: 'cc',
    ...fieldFilter({ ccVendors: true }),
    current: (c) => (c['ccVendors'] === true ? 'yes' : 'no'),
    valueLabel: (c) => (c['ccVendors'] === true ? 'every vendor contact' : 'off'),
    summary: (c) => (c['ccVendors'] === true ? 'CCs every vendor contact' : ''),
    options: [
      { value: 'yes', label: 'CC every vendor contact' },
      { value: 'no', label: 'Off' },
    ],
    apply: (c, value) => ({ ...c, ccVendors: value === 'yes' }),
  },
  {
    key: 'bccSelf',
    label: 'BCC yourself',
    chipLabel: 'bcc',
    ...fieldFilter({ bccSelf: true }),
    current: (c) => (c['bccSelf'] === true ? 'yes' : 'no'),
    valueLabel: (c) => (c['bccSelf'] === true ? 'you' : 'off'),
    summary: (c) => (c['bccSelf'] === true ? 'BCCs you for the paper trail' : ''),
    options: [
      { value: 'yes', label: 'BCC yourself' },
      { value: 'no', label: 'Off' },
    ],
    apply: (c, value) => ({ ...c, bccSelf: value === 'yes' }),
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
