/**
 * Option sources for trigger filter chips.
 *
 * Several filters offer the MC's own data as choices: pipeline stages,
 * task priorities and types, portal song categories, questionnaire
 * templates. Each hook here does one small RLS-scoped read and returns
 * a referentially-stable array (state, not a fresh literal), because
 * everything downstream feeds the React Flow node memo and an unstable
 * reference recomputes it forever.
 *
 * @module app/(dashboard)/workflows/[id]/filter-options
 */
'use client'

import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

/** A value/label pair, the shape every chip option list wants. */
export interface FilterOptionRow {
  value: string
  label: string
}

const EMPTY: FilterOptionRow[] = []

/**
 * Generic "load two columns, map to options" hook shared by every
 * source below. `table` is cast internally because some option tables
 * postdate the generated types in this branch.
 */
function useOptionRows(
  table: string,
  valueColumn: string,
  labelColumn: string,
  orderBy: string,
): FilterOptionRow[] {
  const [rows, setRows] = useState<FilterOptionRow[]>(EMPTY)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from(table as never)
      .select(`${valueColumn},${labelColumn}`)
      .order(orderBy, { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        const mapped = ((data as Record<string, string>[] | null) ?? []).map((row) => ({
          value: row[valueColumn] ?? '',
          label: row[labelColumn] ?? '',
        }))
        setRows(mapped)
      })
    return () => {
      cancelled = true
    }
  }, [table, valueColumn, labelColumn, orderBy])

  return rows
}

export interface CoupleStatus {
  slug: string
  name: string
}

/**
 * The MC's own pipeline statuses, ordered as they appear on the board.
 *
 * Statuses are user-defined rows in `couple_statuses`, not a fixed
 * enum, so any filter over them has to load the list.
 */
export function useCoupleStatuses(): CoupleStatus[] {
  const rows = useOptionRows('couple_statuses', 'slug', 'name', 'position')
  // Derived, not state: a stable reference per fetch is all the node
  // memo needs, and useMemo gives it without a second render.
  return useMemo(() => rows.map((r) => ({ slug: r.value, name: r.label })), [rows])
}

/**
 * The three built-in priorities, highest first. Inlined here when
 * `types/task.ts` retired with the Tasks page: this is the only thing
 * left that reads them.
 */
const PRIORITY_ORDER: string[] = ['high', 'medium', 'low']

/**
 * Task priorities, by display name.
 *
 * Only the built-in list survives the workflows cutover: steps are
 * checklist-simple, so the `task_priorities` table retired with the
 * Tasks page. These options are still rendered for the three retired
 * `task_*` triggers, whose saved configs must keep parsing, so the base
 * list stays rather than the chips disappearing from an old card.
 */
export function useTaskPriorityOptions(): FilterOptionRow[] {
  return useMemo(() => PRIORITY_ORDER.map((p) => ({ value: p, label: p })), [])
}

/**
 * Task types. Empty since the cutover: types were custom rows in
 * `task_types`, which retired with the Tasks page. See
 * {@link useTaskPriorityOptions} for why the hook still exists.
 */
export function useTaskTypeOptions(): FilterOptionRow[] {
  return useMemo(() => [], [])
}

/**
 * The MC's bookable meeting types, for an appointment step that hands
 * off to the Scheduler.
 *
 * Archived types are still returned: a step already pointing at one has
 * to keep showing which, rather than silently reading as unset.
 */
export function useMeetingTypeOptions(): FilterOptionRow[] {
  return useOptionRows('meeting_types', 'id', 'name', 'name')
}

/**
 * The portal's built-in song slots (see songs-section.tsx).
 *
 * Only the fixed seven are offered: an MC can add custom categories,
 * but those live in `portal_song_categories` **per couple**, and a
 * per-couple key makes no sense as a filter on an account-wide
 * automation. A song filed under a custom category simply matches no
 * narrowed config (the "any" state still matches everything).
 */
export const SONG_CATEGORY_OPTIONS: FilterOptionRow[] = [
  { value: 'entry_partner1', label: 'Partner 1 Entry' },
  { value: 'entry_partner2', label: 'Partner 2 Entry' },
  { value: 'first_dance', label: 'First Dance' },
  { value: 'bridal_party_entry', label: 'Bridal Party Entry' },
  { value: 'ceremony', label: 'Ceremony' },
  { value: 'reception', label: 'Reception' },
  { value: 'avoid', label: 'Do Not Play' },
]

/** The MC's questionnaire templates (id + name), in board order. */
export function useQuestionnaireTemplateOptions(): FilterOptionRow[] {
  return useOptionRows('questionnaire_templates', 'id', 'name', 'position')
}
