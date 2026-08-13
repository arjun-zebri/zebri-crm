/**
 * Chip config for the Wait step, replacing the old stacked form.
 *
 * The runner reads exactly four things from a wait config: `mode`, the
 * value for that mode (`durationMinutes` / `untilDate` / `relative`),
 * and `respectQuietHours`. The old form also offered skip-weekends,
 * public holidays, resume windows and a safety cap — five inputs whose
 * keys appear nowhere in `lib/automations`, deleted rather than
 * restyled, per the sweep rule.
 *
 * One required chip carries the whole wait ("1 day later", "2 weeks
 * before the event"); its popover edits the current mode's value at
 * the top and offers the other modes as rows beneath. Quiet hours is
 * the one optional chip: the default (defer into allowed hours) needs
 * no chip at all, so adding it exists to switch it off.
 *
 * @module app/(dashboard)/automations/[id]/wait-chips
 */
'use client'

import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'

import { MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu'
import { TIME_UNIT_LABELS } from '@/lib/automations/trigger-constants'

import { waitConfigLabel } from './step-summary'
import {
  fieldFilter,
  type FilterConfig,
  type TriggerFilterDef,
} from './trigger-filter-list'

type WaitUnit = 'minutes' | 'hours' | 'days' | 'weeks'
const WAIT_UNITS: WaitUnit[] = ['minutes', 'hours', 'days', 'weeks']

const MINUTES_PER: Record<WaitUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
  weeks: 60 * 24 * 7,
}

/** Largest whole unit that divides the stored minutes, for display. */
function minutesToParts(minutes: number): { amount: number; unit: WaitUnit } {
  for (const unit of ['weeks', 'days', 'hours'] as WaitUnit[]) {
    if (minutes >= MINUTES_PER[unit] && minutes % MINUTES_PER[unit] === 0) {
      return { amount: minutes / MINUTES_PER[unit], unit }
    }
  }
  return { amount: minutes, unit: 'minutes' }
}

/** Commit-on-blur number field, matching ComparisonControl's header. */
function AmountField({
  value,
  min,
  unitLabel,
  onCommit,
}: {
  value: number
  min: number
  unitLabel: string
  onCommit: (next: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    if (Number(draft) !== value) setDraft(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  function commit() {
    const next = draft === '' ? value : Math.max(min, Number(draft))
    setDraft(String(next))
    if (next !== value) onCommit(next)
  }
  return (
    <div className="flex items-baseline gap-1.5 border-b border-border px-3 py-2">
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        aria-label="Amount"
        className="w-full min-w-0 flex-1 bg-transparent text-body tabular-nums text-text focus:outline-none"
      />
      <span className="shrink-0 text-text-subtle">{unitLabel}</span>
    </div>
  )
}

/** Rows for switching the wait to a different mode. */
function ModeSwitchRows({
  config,
  setConfig,
  current,
}: {
  config: FilterConfig
  setConfig: (c: FilterConfig) => void
  current: string
}) {
  const rows = [
    {
      mode: 'duration',
      label: 'A fixed amount of time',
      // Mode switches seed the schema's happy path so the config
      // stays valid mid-edit; the dispatcher-side lesson applies to
      // the runner identically.
      patch: { mode: 'duration', durationMinutes: 1440 },
    },
    {
      mode: 'until_date',
      label: 'Until a specific date',
      patch: { mode: 'until_date', untilDate: '' },
    },
    {
      mode: 'relative_to_event',
      label: 'Before or after the event',
      patch: {
        mode: 'relative_to_event',
        relative: { amount: 2, unit: 'weeks', direction: 'before', anchor: 'event_date' },
      },
    },
  ]
  return (
    <>
      <MenuSeparator />
      <MenuLabel>Wait…</MenuLabel>
      {rows.map((row) => (
        <MenuItem
          key={row.mode}
          selected={row.mode === current}
          trailing={row.mode === current ? <Check size={14} strokeWidth={1.5} /> : null}
          onClick={() => {
            if (row.mode !== current) setConfig({ ...config, ...row.patch })
          }}
        >
          {row.label}
        </MenuItem>
      ))}
    </>
  )
}

/** The wait chip's popover: current mode's editor + the mode rows. */
function WaitControl(config: FilterConfig, setConfig: (c: FilterConfig) => void) {
  const mode = typeof config['mode'] === 'string' ? config['mode'] : 'duration'

  if (mode === 'until_date') {
    return (
      <>
        <div className="border-b border-border px-3 py-2">
          <input
            type="date"
            value={typeof config['untilDate'] === 'string' ? config['untilDate'] : ''}
            onChange={(e) => setConfig({ ...config, untilDate: e.target.value })}
            aria-label="Resume on"
            className="w-full bg-transparent text-body text-text focus:outline-none"
          />
        </div>
        <ModeSwitchRows config={config} setConfig={setConfig} current={mode} />
      </>
    )
  }

  if (mode === 'relative_to_event') {
    const relative = (config['relative'] as Record<string, unknown> | undefined) ?? {}
    const amount = typeof relative['amount'] === 'number' ? relative['amount'] : 2
    const unit = (typeof relative['unit'] === 'string' ? relative['unit'] : 'weeks') as WaitUnit
    const direction = relative['direction'] === 'after' ? 'after' : 'before'
    const update = (patch: Record<string, unknown>) =>
      setConfig({
        ...config,
        relative: { amount, unit, direction, anchor: 'event_date', ...patch },
      })
    return (
      <>
        <AmountField
          value={amount}
          min={0}
          unitLabel={`${TIME_UNIT_LABELS[unit] ?? unit} ${direction} the event`}
          onCommit={(next) => update({ amount: next })}
        />
        {WAIT_UNITS.map((u) => (
          <MenuItem
            key={u}
            selected={u === unit}
            trailing={u === unit ? <Check size={14} strokeWidth={1.5} /> : null}
            onClick={() => update({ unit: u })}
          >
            {TIME_UNIT_LABELS[u] ?? u}
          </MenuItem>
        ))}
        <MenuSeparator />
        {(['before', 'after'] as const).map((d) => (
          <MenuItem
            key={d}
            selected={d === direction}
            trailing={d === direction ? <Check size={14} strokeWidth={1.5} /> : null}
            onClick={() => update({ direction: d })}
          >
            {d === 'before' ? 'Before the event' : 'After the event'}
          </MenuItem>
        ))}
        <ModeSwitchRows config={config} setConfig={setConfig} current={mode} />
      </>
    )
  }

  const minutes = typeof config['durationMinutes'] === 'number' ? config['durationMinutes'] : 1440
  const { amount, unit } = minutesToParts(minutes)
  return (
    <>
      <AmountField
        value={amount}
        min={1}
        unitLabel={TIME_UNIT_LABELS[unit] ?? unit}
        onCommit={(next) => setConfig({ ...config, durationMinutes: next * MINUTES_PER[unit] })}
      />
      {WAIT_UNITS.map((u) => (
        <MenuItem
          key={u}
          selected={u === unit}
          trailing={u === unit ? <Check size={14} strokeWidth={1.5} /> : null}
          onClick={() => setConfig({ ...config, durationMinutes: amount * MINUTES_PER[u] })}
        >
          {TIME_UNIT_LABELS[u] ?? u}
        </MenuItem>
      ))}
      <ModeSwitchRows config={config} setConfig={setConfig} current={mode} />
    </>
  )
}

/** Chips for the Wait step: the wait itself, plus quiet hours. */
export const WAIT_CHIPS: TriggerFilterDef[] = [
  {
    key: 'wait',
    label: 'How long to wait',
    chipLabel: 'wait',
    required: true,
    ...fieldFilter({ mode: 'duration', durationMinutes: 1440 }),
    valueLabel: waitConfigLabel,
    summary: (config) => waitConfigLabel(config),
    render: WaitControl,
  },
  {
    key: 'respectQuietHours',
    label: 'Quiet hours',
    chipLabel: 'quiet hours',
    ...fieldFilter({ respectQuietHours: true }),
    current: (config) => (config['respectQuietHours'] === false ? 'ignore' : 'defer'),
    valueLabel: (config) =>
      config['respectQuietHours'] === false ? 'ignored' : 'deferred around',
    summary: (config) =>
      config['respectQuietHours'] === false
        ? 'Ignores quiet hours'
        : 'Defers around quiet hours',
    options: [
      { value: 'defer', label: 'Defer until allowed hours' },
      { value: 'ignore', label: 'Send regardless' },
    ],
    apply: (config, value) => ({ ...config, respectQuietHours: value === 'defer' }),
  },
]
