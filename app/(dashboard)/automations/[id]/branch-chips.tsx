/**
 * The branch step's conditions, as chips.
 *
 * Branch was the last step still on the old stacked form: a "Branch
 * on" select with two or three more controls stacked underneath. It
 * now reads the way a trigger's filters do — **one pill per
 * condition**, saying the whole condition:
 *
 *     if [wedding is at most 60 days away]
 *     if [stage is Booked] and [the deposit is paid] [+ Add condition]
 *
 * One pill, not three: splitting a single condition across a subject
 * pill, an operator pill and a value pill made one thought look like
 * three settings, and wrapped onto two lines inside a 380px node. The
 * pill's popover is two steps instead — the subject list, then that
 * subject's own control — so no popover is longer than a menu.
 *
 * A new branch starts **empty**, on the "Add condition" button: that
 * menu is the list of conditions itself, so picking one creates it.
 *
 * **Conditions chain.** `evaluatePredicate` has always understood
 * `and` / `or` groups; nothing ever offered them, so a branch could
 * only ever test one thing. Adding a second condition rewrites the
 * config into a group, and the join pill between them flips it
 * between "all of these" and "any of these".
 *
 * Only conditions the runner can actually evaluate are offered.
 * `custom_field` is not: it reads `actionResults.custom_field_<key>`,
 * which no action writes and no screen in the app produces, so a
 * branch on it always took the "no" path. Saved branches keep parsing
 * and keep describing themselves (`conditionPhrase`).
 *
 * @module app/(dashboard)/automations/[id]/branch-chips
 */
'use client'

import { Check, ChevronLeft } from 'lucide-react'
import { useState } from 'react'

import { MenuItem, MenuSeparator } from '@/components/ui/menu'

import { ComparisonControl } from './filter-controls'
import { useCoupleStatuses } from './filter-options'
import {
  BRANCH_COUPLE_FIELDS,
  BRANCH_DAY_OPS,
  BRANCH_FIELD_OPS,
  branchConditions,
  branchJoin,
  conditionPhrase,
} from './step-summary'
import {
  TriggerFilterList,
  type FilterConfig,
  type TriggerFilterDef,
} from './trigger-filter-list'

type Predicate = Record<string, unknown>
type StatusOption = { value: string; label: string }

/**
 * Every condition on offer, as one flat list.
 *
 * A couple field is a *subject*, not a kind of condition, so "Stage"
 * sits here beside "The contract is signed" rather than behind a
 * generic "A couple field" row.
 *
 * Each seed is a complete predicate: `branchPredicateSchema` is a
 * union of complete members, so a half-seeded one is a branch that
 * throws a config error at run time instead of splitting. The
 * `value: ''` on a couple field is load-bearing for that reason.
 */
const SUBJECTS: { value: string; label: string; seed: () => Predicate }[] = [
  {
    value: 'event_in',
    label: 'How far away the wedding is',
    seed: () => ({ kind: 'event_in', op: '<=', days: 60 }),
  },
  ...BRANCH_COUPLE_FIELDS.map((field) => ({
    value: `couple_field:${field.value}`,
    label: field.label,
    seed: () => ({ kind: 'couple_field', field: field.value, op: 'eq', value: '' }),
  })),
  {
    value: 'has_signed_contract',
    label: 'The contract is signed',
    seed: () => ({ kind: 'has_signed_contract' }),
  },
  {
    value: 'has_paid_deposit',
    label: 'The deposit is paid',
    seed: () => ({ kind: 'has_paid_deposit' }),
  },
  {
    value: 'has_paid_invoice',
    label: 'The invoice is paid in full',
    seed: () => ({ kind: 'has_paid_invoice' }),
  },
]

/** The first condition a fresh branch tests. */
const DEFAULT_PREDICATE = (): Predicate => SUBJECTS[0]!.seed()

/** The `SUBJECTS` entry a predicate corresponds to. */
function subjectOf(predicate: Predicate): string {
  const kind = String(predicate['kind'] ?? 'event_in')
  return kind === 'couple_field'
    ? `couple_field:${String(predicate['field'] ?? 'status')}`
    : kind
}

/** True when the subject needs an operator or a value chosen. */
function hasControls(predicate: Predicate): boolean {
  const kind = String(predicate['kind'] ?? '')
  return kind === 'event_in' || kind === 'couple_field'
}

/**
 * Write the conditions back, collapsing a single one to a bare
 * predicate.
 *
 * A one-condition branch keeps the shape it has always had, so
 * nothing saved before chaining existed changes on disk just because
 * it was opened.
 */
function writeConditions(
  config: FilterConfig,
  conditions: Predicate[],
  join: 'and' | 'or',
): FilterConfig {
  if (conditions.length <= 1) {
    return { ...config, predicate: conditions[0] ?? DEFAULT_PREDICATE() }
  }
  return { ...config, predicate: { kind: join, predicates: conditions } }
}

/** Replace one condition, leaving the rest of the group alone. */
function replaceAt(config: FilterConfig, index: number, predicate: Predicate): FilterConfig {
  const next = branchConditions(config).map((c, i) => (i === index ? predicate : c))
  return writeConditions(config, next, branchJoin(config))
}

/**
 * One condition's popover: the subject list, then that subject's own
 * control.
 *
 * Two steps rather than one long panel — subjects, operators and a
 * number stacked together ran past the node's width and clipped their
 * own rows. A subject with nothing to configure ("the deposit is
 * paid") opens straight onto the list, since there would be nothing
 * else to show.
 */
function ConditionControl({
  predicate,
  onChange,
  statusOptions,
}: {
  predicate: Predicate
  onChange: (predicate: Predicate) => void
  statusOptions: StatusOption[]
}) {
  const [picking, setPicking] = useState(!hasControls(predicate))

  if (picking) {
    return (
      <div className="max-h-72 overflow-y-auto">
        {SUBJECTS.map((subject) => (
          <MenuItem
            key={subject.value}
            selected={subject.value === subjectOf(predicate)}
            trailing={
              subject.value === subjectOf(predicate) ? <Check size={14} strokeWidth={1.5} /> : null
            }
            onClick={() => {
              // Reseed rather than merge: leaving the previous
              // subject's keys behind fails the union parse.
              const next = subject.seed()
              onChange(next)
              setPicking(!hasControls(next))
            }}
          >
            {subject.label}
          </MenuItem>
        ))}
      </div>
    )
  }

  return (
    <>
      {/* The subject, and the way back to the list. */}
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="flex w-full cursor-pointer items-center gap-1.5 border-b border-border px-3 py-2 text-left text-body text-text-muted transition-colors hover:text-text"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        {SUBJECTS.find((s) => s.value === subjectOf(predicate))?.label ?? 'Condition'}
      </button>

      {String(predicate['kind']) === 'event_in' ? (
        // The trigger filters' own control, not a lookalike: field in
        // the bordered header, operators as rows under it, and the
        // draft/commit handling that stops the caret jumping mid-edit.
        <ComparisonControl
          op={String(predicate['op'] ?? '<=')}
          value={Number(predicate['days'] ?? 60)}
          ops={BRANCH_DAY_OPS}
          unit="days away"
          onChange={(op, days) => onChange({ ...predicate, op, days })}
        />
      ) : (
        <FieldTest predicate={predicate} onChange={onChange} statusOptions={statusOptions} />
      )}
    </>
  )
}

/** How a couple field is compared, and to what. */
function FieldTest({
  predicate,
  onChange,
  statusOptions,
}: {
  predicate: Predicate
  onChange: (predicate: Predicate) => void
  statusOptions: StatusOption[]
}) {
  const op = String(predicate['op'] ?? 'eq')
  const value = String(predicate['value'] ?? '')
  // "is set" / "is empty" take no operand.
  const needsValue = op !== 'is_set' && op !== 'is_unset'
  const onStatus = predicate['field'] === 'status' && statusOptions.length > 0

  return (
    <div className="max-h-72 overflow-y-auto">
      {needsValue && !onStatus && (
        <div className="border-b border-border px-3 py-2">
          <input
            type="text"
            placeholder="Value to match"
            value={value}
            onChange={(e) => onChange({ ...predicate, value: e.target.value })}
            aria-label="Value to match"
            className="w-full bg-transparent text-body text-text placeholder:text-text-subtle focus:outline-none"
          />
        </div>
      )}

      {BRANCH_FIELD_OPS.map((option) => (
        <MenuItem
          key={option.value}
          selected={op === option.value}
          trailing={op === option.value ? <Check size={14} strokeWidth={1.5} /> : null}
          onClick={() => onChange({ ...predicate, op: option.value })}
        >
          {option.label}
        </MenuItem>
      ))}

      {needsValue && onStatus && (
        <>
          <MenuSeparator />
          {statusOptions.map((option) => (
            <MenuItem
              key={option.value}
              selected={value === option.value}
              trailing={value === option.value ? <Check size={14} strokeWidth={1.5} /> : null}
              onClick={() => onChange({ ...predicate, value: option.value })}
            >
              {option.label}
            </MenuItem>
          ))}
        </>
      )}
    </div>
  )
}

/**
 * The chips a branch shows: one per condition, the join between them,
 * and the slot that adds another.
 */
export function branchChips(config: FilterConfig, statusOptions: StatusOption[]): TriggerFilterDef[] {
  const conditions = branchConditions(config)
  const join = branchJoin(config)
  const chips: TriggerFilterDef[] = []

  conditions.forEach((predicate, index) => {
    chips.push({
      key: `condition-${index}`,
      label: 'Condition',
      // "if" leads the row; the join pill introduces the rest.
      chipLabel: index === 0 ? 'if' : '',
      // The last condition is the branch: a step with nothing to test
      // cannot split, so its ✕ only appears once there are two.
      ...(conditions.length > 1 ? {} : { required: true }),
      isActive: () => true,
      add: (c) => c,
      remove: (c) =>
        writeConditions(
          c,
          branchConditions(c).filter((_, i) => i !== index),
          join,
        ),
      valueLabel: () => conditionPhrase(predicate),
      summary: () => '',
      // The subject rows are phrases ("How far away the wedding is"),
      // which the default panel truncates.
      panelWidth: 'lg',
      render: (c, setConfig) => (
        <ConditionControl
          predicate={predicate}
          statusOptions={statusOptions}
          onChange={(next) => setConfig(replaceAt(c, index, next))}
        />
      ),
    })

    // The join sits after the first condition and speaks for the whole
    // group — one "all of these" / "any of these", not a operator per
    // pair, which is the only shape the runner's `and` / `or` has.
    if (index === 0 && conditions.length > 1) {
      chips.push({
        key: 'join',
        label: 'Join',
        chipLabel: '',
        required: true,
        isActive: () => true,
        add: (c) => c,
        remove: (c) => c,
        current: () => join,
        valueLabel: () => join,
        summary: () => '',
        panelWidth: 'lg',
        options: [
          { value: 'and', label: 'and — every condition must match' },
          { value: 'or', label: 'or — any condition can match' },
        ],
        apply: (c, value) =>
          writeConditions(c, branchConditions(c), value === 'or' ? 'or' : 'and'),
      })
    }
  })

  // One entry per condition, never active, so "Add condition" opens
  // the full list and picking one creates that condition outright —
  // rather than adding a placeholder you then have to open and
  // choose inside.
  for (const subject of SUBJECTS) {
    chips.push({
      key: `add:${subject.value}`,
      label: subject.label,
      chipLabel: '',
      isActive: () => false,
      add: (c) => writeConditions(c, [...branchConditions(c), subject.seed()], join),
      // Land in the new condition's own control, but only when it has
      // one: a subject with nothing to configure would just reopen
      // the list you picked it from.
      openAfterAdd: (c) =>
        hasControls(subject.seed()) ? `condition-${branchConditions(c).length - 1}` : '',
      remove: (c) => c,
      valueLabel: () => '',
      summary: () => '',
    })
  }

  return chips
}

/** The branch step's chip row. */
export function BranchChips({
  config,
  setConfig,
}: {
  config: FilterConfig
  setConfig: (c: FilterConfig) => void
}) {
  // `couple_statuses` holds the MC's own pipeline names; the runner
  // compares against `couples.status`, which stores the slug.
  const statuses = useCoupleStatuses().map((s) => ({ value: s.slug, label: s.name }))
  return (
    <TriggerFilterList
      filters={branchChips(config, statuses)}
      config={config}
      setConfig={setConfig}
      addLabel="Add condition"
      addWidth="lg"
    />
  )
}
