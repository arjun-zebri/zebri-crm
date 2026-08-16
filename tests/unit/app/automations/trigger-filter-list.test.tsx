/**
 * Trigger filter chips: add / edit / remove round-trip.
 *
 * The pattern only works if a freshly-added filter survives the next
 * render: `add` has to write a value `isActive` recognises, and that
 * value has to be one the trigger's Zod schema accepts (the dispatcher
 * re-validates the saved config on every event).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import {
  TriggerFilterList,
  activeFilterSummary,
  fieldFilter,
  type FilterConfig,
  type TriggerFilterDef,
} from '@/app/(dashboard)/automations/[id]/trigger-filter-list'

const FILTERS: TriggerFilterDef[] = [
  {
    key: 'leadSource',
    label: 'Lead source',
    chipLabel: 'source',
    ...fieldFilter({ leadSource: '' }),
    current: (config) => (config['leadSource'] as string) ?? '',
    valueLabel: (config) => (config['leadSource'] as string) || 'any',
    summary: (config) =>
      config['leadSource'] ? `From ${config['leadSource'] as string}` : 'Any source',
    options: [
      { value: '', label: 'Any source' },
      { value: 'referral', label: 'Referral' },
    ],
    apply: (config, value) => ({ ...config, leadSource: value }),
  },
  {
    key: 'season',
    label: 'Season',
    chipLabel: 'season',
    ...fieldFilter({ season: 'any' }),
    current: (config) => (config['season'] as string) ?? 'any',
    valueLabel: (config) => (config['season'] as string) || 'any',
    summary: (config) => `Season ${(config['season'] as string) ?? 'any'}`,
    options: [
      { value: 'any', label: 'Any season' },
      { value: 'peak', label: 'Peak' },
    ],
    apply: (config, value) => ({ ...config, season: value }),
  },
]

/** A third filter, for the cases that need the add *menu* to appear. */
const THIRD_FILTER: TriggerFilterDef = {
  key: 'venue',
  label: 'Venue',
  chipLabel: 'venue',
  ...fieldFilter({ venue: '' }),
  valueLabel: (config) => (config['venue'] as string) || 'any',
  summary: () => 'Any venue',
  options: [{ value: '', label: 'Any venue' }],
  apply: (config, value) => ({ ...config, venue: value }),
}

/** Harness holding config state the way the step card does. */
function Harness({
  initial = {},
  filters = FILTERS,
}: {
  initial?: FilterConfig
  filters?: TriggerFilterDef[]
}) {
  const [config, setConfig] = useState<FilterConfig>(initial)
  return (
    <>
      <TriggerFilterList filters={filters} config={config} setConfig={setConfig} />
      <output data-testid="config">{JSON.stringify(config)}</output>
    </>
  )
}

function savedConfig(): unknown {
  return JSON.parse(screen.getByTestId('config').textContent!)
}

async function addFilter(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('button', { name: 'Add filter' }))
  await user.click(await screen.findByRole('menuitem', { name: label }))
}

describe('TriggerFilterList', () => {
  it('shows only the add affordance until a filter is added', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Add filter' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('adds a chip, seeds a schema-valid default, and opens its picker', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await addFilter(user, 'Season')

    // 'any' rather than null/undefined: the dispatcher parses this
    // config on every event and would reject a placeholder.
    expect(savedConfig()).toEqual({ season: 'any' })
    expect(screen.getByRole('button', { name: 'Remove Season filter' })).toBeInTheDocument()
    // The picker opens straight away; adding is never the goal.
    expect(await screen.findByRole('menuitem', { name: 'Peak' })).toBeInTheDocument()
  })

  it('names what it is about to add, even for a single choice', async () => {
    // Adding a filter seeds a default value, so the menu comes first
    // however short it is: a default nobody picked is a setting
    // nobody knows they have.
    const user = userEvent.setup()
    render(<Harness initial={{ leadSource: '' }} />)

    await user.click(screen.getByRole('button', { name: 'Add filter' }))
    expect(await screen.findByRole('menuitem', { name: 'Season' })).toBeInTheDocument()
    expect(savedConfig()).toEqual({ leadSource: '' })

    await user.click(screen.getByRole('menuitem', { name: 'Season' }))
    expect(savedConfig()).toEqual({ leadSource: '', season: 'any' })
  })

  it('centres a chip that has neither a label nor a remove button', () => {
    // The branch's condition pills are parts of one phrase, so they
    // carry no chip label. Reserving room for a ✕ they do not have,
    // and a gap for a label span that renders blank, both pushed the
    // text off-centre.
    const bare: TriggerFilterDef = {
      key: 'bare',
      label: 'Bare',
      chipLabel: '',
      required: true,
      isActive: () => true,
      add: (c) => c,
      remove: (c) => c,
      valueLabel: () => 'is Booked',
      summary: () => '',
      options: [{ value: 'a', label: 'A' }],
      apply: (c) => c,
    }
    render(<Harness filters={[bare]} />)

    const trigger = screen.getByRole('button', { name: 'is Booked' })
    expect(trigger.className).toContain('pr-3')
    expect(trigger.className).not.toContain('pr-2')
    // One child, the value: no blank label span with a gap in front.
    expect(trigger.children).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('drops an added filter from the add menu', async () => {
    const user = userEvent.setup()
    render(<Harness filters={[...FILTERS, THIRD_FILTER]} initial={{ leadSource: '' }} />)

    await user.click(screen.getByRole('button', { name: 'Add filter' }))
    expect(await screen.findByRole('menuitem', { name: 'Season' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Lead source' })).not.toBeInTheDocument()
  })

  it('writes the chosen option through to the config', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ leadSource: '' }} />)

    await user.click(screen.getByRole('button', { name: /source any/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Referral' }))

    expect(savedConfig()).toEqual({ leadSource: 'referral' })
    expect(screen.getByRole('button', { name: /source referral/ })).toBeInTheDocument()
  })

  it('clears every key the filter owns when removed', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ leadSource: 'referral', season: 'peak' }} />)

    await user.click(screen.getByRole('button', { name: 'Remove Lead source filter' }))

    expect(savedConfig()).toEqual({ season: 'peak' })
  })

  it('hides the add affordance when every filter is set', () => {
    render(<Harness initial={{ leadSource: 'referral', season: 'peak' }} />)
    expect(screen.queryByRole('button', { name: 'Add filter' })).not.toBeInTheDocument()
  })
})

describe('activeFilterSummary', () => {
  it('falls back to the empty label when nothing is set', () => {
    expect(activeFilterSummary(FILTERS, {}, 'Every couple')).toBe('Every couple')
  })

  it('joins the active filters, ignoring the unset ones', () => {
    expect(activeFilterSummary(FILTERS, { leadSource: 'referral' }, 'Every couple')).toBe(
      'From referral',
    )
    expect(
      activeFilterSummary(FILTERS, { leadSource: 'referral', season: 'peak' }, 'Every couple'),
    ).toBe('From referral · Season peak')
  })
})
