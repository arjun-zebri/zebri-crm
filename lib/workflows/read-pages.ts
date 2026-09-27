/**
 * Read every row of a query, a page at a time.
 *
 * PostgREST caps a single response at `max_rows` (1000, in
 * `supabase/config.toml` and on the hosted projects) and says nothing
 * when it does: the rows past the cap simply are not there. For the
 * Upcoming list that was the worst failure there is, because a missing
 * finished step reads as the head of its lane and a missing to-do lets
 * the send behind it look released, so the list showed wrong times
 * rather than an error (review I2). Pages are read until one comes back
 * short, and a hard cap turns "too much to read" into a thrown error the
 * page shows, never a silently partial list.
 *
 * @module lib/workflows/read-pages
 */

/** One page of a read, as supabase-js returns it. */
export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Rows per request. Must not exceed PostgREST's `max_rows` (1000). */
export const PAGE_SIZE = 1000;

/** Thrown when a read would need more than {@link ReadAllOptions.maxRows}. */
export class TooManyRowsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TooManyRowsError';
  }
}

/** Options for {@link readAllPages}. */
export interface ReadAllOptions {
  /** Safety cap on the total; reaching it throws rather than truncating. */
  maxRows: number;
  /** Message for the thrown error, in the MC's words. */
  tooMany: string;
}

/**
 * Read pages from `page(from, to)` (inclusive bounds, as `.range()`
 * takes them) until one comes back short.
 *
 * The query must carry a stable total order (a unique column last), or
 * rows can shift between pages and be read twice or not at all.
 *
 * @throws Error on a failed read, {@link TooManyRowsError} past the cap
 */
export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  opts: ReadAllOptions,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    if (from >= opts.maxRows) throw new TooManyRowsError(opts.tooMany);
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const got = data ?? [];
    rows.push(...got);
    if (got.length < PAGE_SIZE) return rows;
  }
}
