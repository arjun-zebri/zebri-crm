/**
 * A Supabase client that fails chosen queries, for fail-closed tests.
 *
 * Wraps a real client. Every `from(table)` query is observed, and the
 * first query matching a {@link Fault} resolves to a PostgREST-shaped
 * error instead of reaching the database. Everything else passes
 * through untouched, so the code under test runs against the real schema
 * and real data, with exactly one read or write failing where the test
 * says.
 *
 * The postgrest-js builders return `this` from every filter and
 * transform, so wrapping the builder once (at its first verb) keeps the
 * wrapper on the whole chain, up to the `await`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/** The verb a query started with. */
export type FaultVerb = 'select' | 'insert' | 'update' | 'upsert' | 'delete'

/** Which query to fail. */
export interface Fault {
  table: string
  verb: FaultVerb
  /** Fail only when the verb's first argument passes this, e.g. an update's values. */
  when?: (arg: unknown) => boolean
  /** Let this many matching queries through first. Default 0. */
  skip?: number
  /** How many matching queries to fail after that. Default 1. */
  times?: number
  /**
   * Instead of failing the query, run this first and then let the query
   * through: a concurrent write landing at exactly this point.
   */
  before?: () => Promise<void>
}

/** The error every failed query resolves to. */
export const INJECTED = { message: 'injected failure', code: 'XX000', details: '', hint: '' }

/**
 * Wrap `real` so the queries in `faults` fail.
 *
 * @returns the wrapped client, and `failed()`: how many queries it
 *   failed or ran a `before` hook on
 */
export function faultyClient(
  real: SupabaseClient<Database>,
  faults: Fault[],
): { client: SupabaseClient<Database>; failed: () => number } {
  const seen = faults.map(() => 0)
  let failed = 0

  const wrapBuilder = (
    builder: object,
    shouldFail: boolean,
    before: (() => Promise<void>) | undefined,
  ): object =>
    new Proxy(builder, {
      get(target, prop, receiver) {
        if (prop === 'then' && before) {
          const then = Reflect.get(target, prop, receiver) as (
            a?: (v: unknown) => unknown,
            b?: (e: unknown) => unknown,
          ) => Promise<unknown>
          return (onOk?: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
            before().then(() => then.call(target, onOk, onErr))
        }
        if (prop === 'then' && shouldFail) {
          return (onOk?: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
            Promise.resolve({
              data: null,
              error: INJECTED,
              count: null,
              status: 500,
              statusText: 'injected',
            }).then(onOk, onErr)
        }
        return Reflect.get(target, prop, receiver)
      },
    })

  const wrapFrom = (table: string, query: object): object =>
    new Proxy(query, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)
        if (typeof value !== 'function') return value
        if (!['select', 'insert', 'update', 'upsert', 'delete'].includes(String(prop))) return value
        return (...args: unknown[]) => {
          const builder = (value as (...a: unknown[]) => object).apply(target, args)
          let hit: Fault | undefined
          faults.forEach((f, i) => {
            if (hit || f.table !== table || f.verb !== prop) return
            if (f.when && !f.when(args[0])) return
            seen[i] = (seen[i] ?? 0) + 1
            const skip = f.skip ?? 0
            const times = f.times ?? 1
            if (seen[i]! > skip && seen[i]! <= skip + times) hit = f
          })
          const shouldFail = Boolean(hit) && !hit?.before
          if (hit) failed += 1
          return wrapBuilder(builder, shouldFail, hit?.before)
        }
      },
    })

  const client = new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => wrapFrom(table, target.from(table as never) as object)
      }
      return Reflect.get(target, prop, receiver)
    },
  })
  return { client: client as SupabaseClient<Database>, failed: () => failed }
}
