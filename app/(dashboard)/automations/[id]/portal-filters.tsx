/**
 * Filter sets for the client-portal triggers: `section_completed`,
 * `timeline_edited`, `couple_uploaded_file`,
 * `couple_added_song_to_playlist`, `couple_completed_vows` and
 * `questionnaire_completed`.
 *
 * Each offers exactly what its emit payload carries — a section name,
 * an op, a file size, a song slot, a partner, a template id — and
 * nothing else. The Phase 14a extras (completion timing, edit actors,
 * item counts, file types) had no data behind them and are gone.
 *
 * @module app/(dashboard)/automations/[id]/portal-filters
 */
'use client'

import {
  COMPARISON_OP_LABELS,
  OFFERED_COMPARISON_OPS,
} from '@/lib/automations/trigger-constants'

import { ComparisonControl } from './filter-controls'
import { SONG_CATEGORY_OPTIONS, type FilterOptionRow } from './filter-options'
import {
  configString as str,
  fieldFilter,
  type FilterConfig,
  type TriggerFilterDef,
} from './trigger-filter-list'

const SECTION_LABELS: Record<string, string> = {
  people: 'People',
  songs: 'Songs',
  files: 'Files',
}

const PERSON_TYPE_LABELS: Record<string, string> = {
  partner: 'Partner',
  bridal_party: 'Bridal party',
  family: 'Family',
}

const BYTES_PER_MB = 1024 * 1024

/** Which portal list the item landed in. Always offered. */
const sectionFilter: TriggerFilterDef = {
  key: 'section',
  label: 'Which section',
  chipLabel: 'section',
  ...fieldFilter({ section: '' }),
  current: (config) => str(config, 'section'),
  valueLabel: (config) => SECTION_LABELS[str(config, 'section')] ?? 'any',
  summary: (config) => {
    const section = str(config, 'section')
    return section ? `Added to ${SECTION_LABELS[section] ?? section}` : 'Any section'
  },
  options: [
    { value: '', label: 'Any section' },
    { value: 'people', label: 'People' },
    { value: 'songs', label: 'Songs' },
    { value: 'files', label: 'Files' },
  ],
  // Changing section drops the previous section's sub-filter values.
  // The matcher ignores leftovers anyway, but leaving them in the
  // config means re-picking that section silently restores a filter
  // the MC can no longer see they set.
  apply: (config, value) => ({
    ...config,
    section: value,
    personType: undefined,
    songCategory: undefined,
    sizeBytesOp: undefined,
    sizeBytesValue: undefined,
  }),
}

/** People only: which list on the Contacts section they were added to. */
const personTypeFilter: TriggerFilterDef = {
  key: 'personType',
  label: 'Who they added',
  chipLabel: 'who',
  ...fieldFilter({ personType: '' }),
  current: (config) => str(config, 'personType'),
  valueLabel: (config) => PERSON_TYPE_LABELS[str(config, 'personType')] ?? 'anyone',
  summary: (config) => {
    const value = str(config, 'personType')
    return value ? `${PERSON_TYPE_LABELS[value] ?? value} added` : 'Anyone'
  },
  options: [
    { value: '', label: 'Anyone' },
    { value: 'partner', label: 'Partner' },
    { value: 'bridal_party', label: 'Bridal party' },
    { value: 'family', label: 'Family' },
  ],
  apply: (config, value) => ({ ...config, personType: value }),
}

/** Songs only: which portal slot the song landed in. */
const songCategoryFilter: TriggerFilterDef = {
  key: 'songCategory',
  label: 'Playlist slot',
  chipLabel: 'slot',
  ...fieldFilter({ songCategory: '' }),
  current: (config) => str(config, 'songCategory'),
  valueLabel: (config) => {
    const value = str(config, 'songCategory')
    return value ? (SONG_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value) : 'any'
  },
  summary: (config) => {
    const value = str(config, 'songCategory')
    const label = SONG_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value
    return value ? `Added to ${label}` : 'Any slot'
  },
  options: [{ value: '', label: 'Any slot' }, ...SONG_CATEGORY_OPTIONS],
  apply: (config, value) => ({ ...config, songCategory: value }),
}

/** Label for the file-size pair, e.g. "at least 25 MB". */
function fileSizeLabel(config: FilterConfig): string {
  const op = str(config, 'sizeBytesOp')
  const bytes = config['sizeBytesValue']
  if (!op || typeof bytes !== 'number') return 'any size'
  return `${COMPARISON_OP_LABELS[op as never] ?? op} ${Math.round(bytes / BYTES_PER_MB)} MB`
}

/** Files only: size, taken in megabytes and stored in bytes. */
const fileSizeFilter: TriggerFilterDef = {
  key: 'size',
  label: 'File size',
  chipLabel: 'size',
  ...fieldFilter({ sizeBytesOp: 'gte', sizeBytesValue: 25 * BYTES_PER_MB }),
  valueLabel: fileSizeLabel,
  summary: (config) => `File ${fileSizeLabel(config)}`,
  render: (config, setConfig) => (
    <ComparisonControl
      op={str(config, 'sizeBytesOp') || 'gte'}
      value={Math.round(
        ((config['sizeBytesValue'] as number | undefined) ?? 25 * BYTES_PER_MB) / BYTES_PER_MB,
      )}
      ops={OFFERED_COMPARISON_OPS.map((o) => ({ value: o, label: COMPARISON_OP_LABELS[o] }))}
      unit="MB"
      onChange={(op, value) =>
        setConfig({ ...config, sizeBytesOp: op, sizeBytesValue: value * BYTES_PER_MB })
      }
    />
  ),
}

/** Sub-filters that only make sense once a section is chosen. */
const SECTION_EXTRAS: Record<string, TriggerFilterDef[]> = {
  people: [personTypeFilter],
  songs: [songCategoryFilter],
  files: [fileSizeFilter],
}

/**
 * Filters for Portal item added, built against the section currently
 * chosen.
 *
 * Only the three sections with emitters are offered; the rest of the
 * portal has its own triggers (timeline → `timeline_edited`, vows →
 * `couple_completed_vows`, questionnaires → `questionnaire_completed`).
 *
 * The per-section extras are why `couple_uploaded_file` and
 * `couple_added_song_to_playlist` existed at all — a whole trigger
 * each to carry one filter. Offering them here, and only under their
 * own section, retires both: no more two picker entries and two
 * emitted events for one uploaded file.
 */
export function sectionCompletedFilters(config: FilterConfig): TriggerFilterDef[] {
  return [sectionFilter, ...(SECTION_EXTRAS[str(config, 'section')] ?? [])]
}

const CHANGE_LABELS: Record<string, string> = {
  any: 'any edit',
  added: 'items added',
  changed: 'items changed',
}

/** Filters for Timeline edited: added rows vs changed rows. */
export const TIMELINE_EDITED_FILTERS: TriggerFilterDef[] = [
  {
    key: 'change',
    label: 'Kind of edit',
    chipLabel: 'edit',
    ...fieldFilter({ change: 'any' }),
    current: (config) => str(config, 'change') || 'any',
    valueLabel: (config) => CHANGE_LABELS[str(config, 'change') || 'any'] ?? 'any edit',
    summary: (config) => {
      const value = str(config, 'change') || 'any'
      return value === 'any' ? 'Any timeline edit' : `Timeline ${CHANGE_LABELS[value]}`
    },
    options: [
      { value: 'any', label: 'Any edit' },
      { value: 'added', label: 'Items added' },
      { value: 'changed', label: 'Items changed' },
    ],
    apply: (config, value) => ({ ...config, change: value }),
  },
]

const WHO_LABELS: Record<string, string> = {
  both: 'either partner',
  primary: 'the primary partner',
  spouse: 'their partner',
}

/** Filters for Couple completed vows: which partner submitted. */
export const VOWS_FILTERS: TriggerFilterDef[] = [
  {
    key: 'who',
    label: 'Submitted by',
    chipLabel: 'by',
    ...fieldFilter({ who: 'both' }),
    current: (config) => str(config, 'who') || 'both',
    valueLabel: (config) => WHO_LABELS[str(config, 'who') || 'both'] ?? 'either partner',
    summary: (config) => `Vows from ${WHO_LABELS[str(config, 'who') || 'both'] ?? 'either partner'}`,
    options: [
      { value: 'both', label: 'Either partner' },
      { value: 'primary', label: 'The primary partner' },
      { value: 'spouse', label: 'Their partner' },
    ],
    apply: (config, value) => ({ ...config, who: value }),
  },
]

/**
 * Filter for Questionnaire completed, offering the MC's own
 * templates. Built at render time because the options are
 * `questionnaire_templates` rows.
 */
export function questionnaireFilters(templates: FilterOptionRow[]): TriggerFilterDef[] {
  const nameFor = (id: string) => templates.find((t) => t.value === id)?.label ?? 'a deleted questionnaire'
  return [
    {
      key: 'questionnaireTemplateId',
      label: 'Which questionnaire',
      chipLabel: 'questionnaire',
      ...fieldFilter({ questionnaireTemplateId: '' }),
      current: (config) => str(config, 'questionnaireTemplateId'),
      valueLabel: (config) => {
        const value = str(config, 'questionnaireTemplateId')
        return value ? nameFor(value) : 'any'
      },
      summary: (config) => {
        const value = str(config, 'questionnaireTemplateId')
        return value ? nameFor(value) : 'Any questionnaire'
      },
      options: [
        { value: '', label: 'Any questionnaire' },
        ...templates,
      ],
      apply: (config, value) => ({ ...config, questionnaireTemplateId: value }),
    },
  ]
}
