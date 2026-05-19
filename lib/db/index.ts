/**
 * Typed data-access foundation.
 *
 * Ergonomic helpers over the generated {@link Database} type (the raw
 * `supabase gen types` output deliberately omits these). Use these aliases
 * instead of hand-written row interfaces so DB shapes stay in lockstep with
 * migrations:
 *
 * ```ts
 * import type { Tables, TablesInsert } from '@/lib/db'
 * function render(c: Tables<'couples'>) { … }
 * const draft: TablesInsert<'invoices'> = { … }
 * ```
 *
 * Query at the call site with the typed client (`@/lib/supabase/{client,server}`);
 * because it is `SupabaseClient<Database>`, `.from('couples').select()` is
 * already fully typed. Per-page hardening replaces remaining hand-written
 * row/`any` shapes with these. See CONTRIBUTING.md and roadmap §0.2.
 *
 * @module lib/db
 */

import type { Database } from '@/types/database'

/** All public table names. */
export type TableName = keyof Database['public']['Tables']

/** Row shape of a public table, e.g. `Tables<'couples'>`. */
export type Tables<T extends TableName> =
  Database['public']['Tables'][T]['Row']

/** Insert shape of a public table, e.g. `TablesInsert<'invoices'>`. */
export type TablesInsert<T extends TableName> =
  Database['public']['Tables'][T]['Insert']

/** Update shape of a public table, e.g. `TablesUpdate<'tasks'>`. */
export type TablesUpdate<T extends TableName> =
  Database['public']['Tables'][T]['Update']

/** A public enum's union type, e.g. `Enums<'…'>` (none defined yet). */
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]

export type { Database, Json } from '@/types/database'
