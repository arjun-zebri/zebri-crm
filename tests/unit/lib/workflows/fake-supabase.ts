/**
 * A scriptable stand-in for the Supabase client, for the engine's
 * failed-read tests.
 *
 * Every query builder method records itself and returns the same chain;
 * awaiting the chain (or calling `maybeSingle` / `single`) asks the
 * test's responder what that query answers. The responder sees the table
 * and every call made on the chain, so one function can answer "the
 * update on workflow_steps fails, every read succeeds".
 *
 * @module tests/unit/lib/workflows/fake-supabase
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/** One builder method call. */
export interface Call {
  method: string;
  args: unknown[];
}

/** What one query resolves to. */
export interface Reply {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

/** Answers one query from its table and its calls. */
export type Responder = (table: string, calls: Call[]) => Reply;

/** A recorded query: its table and the calls made on it. */
export interface Recorded {
  table: string;
  calls: Call[];
}

/** True when `calls` include `method`, optionally with this first argument. */
export function called(calls: Call[], method: string, firstArg?: unknown): boolean {
  return calls.some(
    (c) => c.method === method && (firstArg === undefined || c.args[0] === firstArg),
  );
}

/** A database error reply, as PostgREST reports one. */
export function failed(message = 'connection reset'): Reply {
  return { data: null, error: { message, code: '08006' } };
}

/**
 * Build the fake. `rpc` answers `supabase.rpc(fn, args)`; unset, every
 * RPC succeeds with no data.
 */
export function fakeSupabase(
  respond: Responder,
  rpc: (fn: string, args: unknown) => Reply = () => ({ data: null, error: null }),
): { client: SupabaseClient<Database>; log: Recorded[] } {
  const log: Recorded[] = [];
  const answer = (table: string, calls: Call[]) =>
    Promise.resolve({ data: null, error: null, count: null, ...respond(table, calls) });

  const from = (table: string) => {
    const calls: Call[] = [];
    log.push({ table, calls });
    const chain: unknown = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              answer(table, calls).then(resolve, reject);
          }
          if (prop === 'maybeSingle' || prop === 'single') {
            return () => {
              calls.push({ method: String(prop), args: [] });
              return answer(table, calls);
            };
          }
          return (...args: unknown[]) => {
            calls.push({ method: String(prop), args });
            return chain;
          };
        },
      },
    );
    return chain;
  };

  const client = {
    from,
    rpc: async (fn: string, args: unknown) => ({ data: null, error: null, ...rpc(fn, args) }),
  } as unknown as SupabaseClient<Database>;
  return { client, log };
}
