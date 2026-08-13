/**
 * Filter sets for the contact triggers: `contact_created` and
 * `contact_linked_to_couple`.
 *
 * Category options are the fixed vendor list from `types/contact`
 * (the contact modal writes exactly these twelve). The created
 * payload also carries email / phone, so those become has/hasn't
 * filters; the linked payload carries only category + name, so the
 * linked trigger offers category alone. The old
 * `isPrimaryVendorForCouple` and `region` fields had no columns
 * behind them and are gone.
 *
 * @module app/(dashboard)/automations/[id]/contact-filters
 */
'use client'

import {
  CONTACT_CATEGORIES,
  CONTACT_CATEGORY_LABELS,
} from '@/lib/automations/trigger-constants'

import {
  configString as str,
  fieldFilter,
  type TriggerFilterDef,
} from './trigger-filter-list'

const categoryFilter: TriggerFilterDef = {
  key: 'category',
  label: 'Category',
  chipLabel: 'category',
  ...fieldFilter({ category: '' }),
  current: (config) => str(config, 'category'),
  valueLabel: (config) => {
    const value = str(config, 'category')
    return value ? (CONTACT_CATEGORY_LABELS[value as never] ?? value) : 'any'
  },
  summary: (config) => {
    const value = str(config, 'category')
    return value ? (CONTACT_CATEGORY_LABELS[value as never] ?? value) : 'Any category'
  },
  options: [
    { value: '', label: 'Any category' },
    ...CONTACT_CATEGORIES.map((c) => ({ value: c, label: CONTACT_CATEGORY_LABELS[c] })),
  ],
  apply: (config, value) => ({ ...config, category: value }),
}

/** Yes/no filter over a contact detail field being present. */
function hasDetailFilter(
  configKey: 'hasEmail' | 'hasPhone',
  noun: string,
): TriggerFilterDef {
  return {
    key: configKey,
    label: noun[0]!.toUpperCase() + noun.slice(1),
    chipLabel: noun,
    ...fieldFilter({ [configKey]: true }),
    current: (config) => (config[configKey] === false ? 'no' : 'yes'),
    valueLabel: (config) => (config[configKey] === false ? 'missing' : 'on file'),
    summary: (config) =>
      config[configKey] === false ? `No ${noun}` : `Has ${noun === 'email' ? 'an' : 'a'} ${noun}`,
    options: [
      { value: 'yes', label: `Has ${noun === 'email' ? 'an' : 'a'} ${noun}` },
      { value: 'no', label: `No ${noun}` },
    ],
    apply: (config, value) => ({ ...config, [configKey]: value === 'yes' }),
  }
}

/** Filters offered on Contact added. */
export const contactCreatedFilters: TriggerFilterDef[] = [
  categoryFilter,
  hasDetailFilter('hasEmail', 'email'),
  hasDetailFilter('hasPhone', 'phone'),
]

/** Filters offered on Contact linked to a couple. */
export const contactLinkedFilters: TriggerFilterDef[] = [categoryFilter]
