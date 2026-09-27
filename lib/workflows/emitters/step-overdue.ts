/**
 * `step_overdue` time-based emitter.
 *
 * Replaces the retired `task_overdue` emitter. Fires when a manual
 * workflow step (`todo` or `appointment`) has sat past its `due_at`
 * without being ticked. Automated steps are excluded: those are the
 * engine's problem, and one sitting past its due date means the executor
 * is behind, not that the MC is.
 *
 * # Emit semantics
 *
 * One event per (step, calendar day). A step fires once a day while it
 * stays overdue, not once per tick, and the payload carries
 * `days_overdue` so a workflow's `on_event` rule can narrow to its own
 * threshold. Idempotency is the same day-bucket dedupe against
 * `automation_events` the other emitters use.
 *
 * # Paging, not a single capped read
 *
 * A one-shot `.limit(500)` with no `order by` lets Postgres hand back an
 * arbitrary 500 of however many rows match, once the whole instance's
 * overdue count passes that cap. Every row outside that arbitrary slice
 * is then silently skipped, run after run, and any workflow gated on
 * `step_overdue` just never fires for those steps. The read below pages
 * through every matching row instead, keyset-ordered by `id` so paging
 * is deterministic even when many rows share the same `due_at` (as a
 * whole day's overdue steps typically do).
 *
 * @module lib/workflows/emitters/step-overdue
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendAlert } from '@/lib/alerts/send-alert';
import type { TimeEmitter } from '@/lib/automations/time-emitters';
import type { Database } from '@/types/database';

/**
 * Rows read per page of the scan below. Not just a read-size tuning
 * knob: the paging test in the sibling spec file inserts this many rows
 * plus a handful, so changing it changes what that test proves against.
 */
const PAGE_SIZE = 500;

/**
 * Max ids per batch of the dedupe lookup against
 * `automation_events.source_id`. Deliberately not {@link PAGE_SIZE}:
 * that constant is about how much scan work we pull per round trip,
 * this one is about what fits in a URL, and tying them together is what
 * let a full page's dedupe read (500 ids in one `.in(...)` filter, a
 * ~19.6KB query string) come back as an HTTP 414 that the old code
 * silently swallowed. A uuid plus its separator is about 37 bytes, so
 * 100 ids is a ~3.7KB filter, confirmed against the running local
 * Supabase (200 at 100 ids, 414 at 500) before picking this number.
 */
const DEDUPE_BATCH_SIZE = 100;

/**
 * Row cap on a single dedupe-batch query. Deliberately not
 * {@link DEDUPE_BATCH_SIZE}: the `.in('source_id', ids)` filter bounds
 * which ids can match, but nothing in the schema stops a source_id from
 * having more than one `step_overdue` row on the same UTC day (a stray
 * duplicate from elsewhere, or historical drift from before this fix).
 * A limit sized to "exactly one row per id" comes back partial the
 * moment that assumption breaks, which is the same silent-truncation
 * shape this whole fix removes, just moved down to the row count
 * instead of the URL length. Five times the batch size is headroom no
 * healthy day-bucket should ever need, while staying under PostgREST's
 * own configured row ceiling (`max_rows = 1000` in
 * `supabase/config.toml`).
 */
const DEDUPE_READ_LIMIT = DEDUPE_BATCH_SIZE * 5;

/**
 * Hard ceiling on total overdue steps processed in one run, across every
 * page. Ten pages at {@link PAGE_SIZE} is already far beyond anything
 * seen in production; a run that reaches it is a runaway (a stuck
 * workflow duplicating steps, say), not an ordinary busy day. Hitting it
 * stops the scan and reports through `sendAlert` rather than either
 * looping forever or quietly truncating like the bug this replaces.
 */
const MAX_ROWS_PER_RUN = PAGE_SIZE * 10;

/** One overdue manual step, with its owning instance embedded via `!inner`. */
interface OverdueStepRow {
  id: string;
  instance_id: string;
  type: string;
  title: string;
  due_at: string;
  status: string;
  workflow_instances: unknown;
}

/**
 * The pass's deadline, as handed down the call chain.
 *
 * Asking and recording are the same act here, deliberately. When they
 * were separate, every place that could stop early also had to remember
 * to report that it had, and the one that forgot was the per-row emit
 * loop: a deadline landing inside the final batch returned a partial
 * count and alerted on nothing, which is the silent stop this whole
 * mechanism exists to remove. Now the only way to observe the deadline
 * is through {@link DeadlineWatch.passed}, and observing it is what
 * records it.
 */
interface DeadlineWatch {
  /** Is the pass out of time? Remembers the answer when it is yes. */
  passed(): boolean;
  /** Has anything stopped on the deadline during this run? */
  stopped(): boolean;
}

/**
 * A watch over one pass.
 *
 * With no deadline it never passes, so a direct call (a test, a one-off
 * script) walks the whole backlog exactly as before.
 */
function watchDeadline(deadline: number | undefined): DeadlineWatch {
  let stopped = false;
  return {
    passed() {
      // Read at the moment of the check, not once at the start: the
      // point of the whole thing is elapsed time.
      if (deadline === undefined || Date.now() < deadline) return false;
      stopped = true;
      return true;
    },
    stopped: () => stopped,
  };
}

/** Lower bound for "today" in UTC, for the per-day dedupe window. */
function startOfUtcDay(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

/** Whole days between `dueAt` and now, floored at 0. */
function daysOverdue(dueAt: string): number {
  const diff = Date.now() - new Date(dueAt).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

/** Base filters shared by the page scan and the {@link hasMoreRowsAfter} probe. */
function overdueStepsQuery(supabase: SupabaseClient<Database>, nowIso: string) {
  return supabase
    .from('workflow_steps')
    .select(
      'id, instance_id, type, title, due_at, status, workflow_instances!inner(id, user_id, couple_id, status)',
    )
    .eq('status', 'pending')
    .in('type', ['todo', 'appointment'])
    .not('due_at', 'is', null)
    .lt('due_at', nowIso)
    .order('id', { ascending: true });
}

/**
 * Whether at least one more matching row sits past `cursor`.
 *
 * Reaching {@link MAX_ROWS_PER_RUN} only means the run stopped there,
 * not that it truncated anything: when the true total lands exactly on
 * the ceiling, the last page read is a full page and there is nothing
 * left. This one-row probe is the difference between those two cases,
 * so the cap alert fires only when work was genuinely left behind.
 */
async function hasMoreRowsAfter(
  supabase: SupabaseClient<Database>,
  nowIso: string,
  cursor: string,
): Promise<{ more: boolean; error?: string }> {
  const { data, error } = await overdueStepsQuery(supabase, nowIso).gt('id', cursor).limit(1);
  // A probe that could not read reports the error, which the caller
  // raises as a failed read. Answering "none" would call a truncated run
  // done; answering "more" fired the cap alert and blamed truncation for
  // a read failure (review M4).
  if (error) return { more: false, error: error.message };
  return { more: (data ?? []).length > 0 };
}

/**
 * Read every overdue manual step, a page at a time.
 *
 * Ordered by `id` rather than `due_at`: the fixed `due_at` values a
 * template or a bulk import stamps on a whole cohort of steps are not
 * unique, so ordering on it alone would leave Postgres free to place
 * ties in a different order between reads and corrupt the keyset cursor
 * below. `id` is unique, so `.gt('id', cursor)` never re-reads or skips
 * a row across pages.
 *
 * Stops at a short page (fewer than {@link PAGE_SIZE} rows), at
 * {@link MAX_ROWS_PER_RUN}, on the pass's deadline, or on a read error,
 * whichever comes first. The caller is responsible for alerting on
 * `capped` and `readFailed`; this function only reports them, plus
 * `readError` for the message.
 */
async function fetchOverdueSteps(
  supabase: SupabaseClient<Database>,
  nowIso: string,
  watch: DeadlineWatch,
): Promise<{
  rows: OverdueStepRow[];
  capped: boolean;
  readFailed: boolean;
  readError?: string;
}> {
  const rows: OverdueStepRow[] = [];
  let cursor: string | null = null;
  let capped = false;

  for (;;) {
    // Checked before each page rather than only at the ceiling: the
    // ceiling is ten pages, and on a slow database ten pages plus the
    // emitting behind them is more than the pass has.
    if (watch.passed()) return { rows, capped, readFailed: false };

    let query = overdueStepsQuery(supabase, nowIso).limit(PAGE_SIZE);
    if (cursor !== null) query = query.gt('id', cursor);

    const { data, error } = await query;
    if (error) {
      // A transient read failure used to yield an empty page here, which
      // the loop below read as "no more rows" and returned as a clean
      // finish. That is the same silent truncation this whole fix
      // removes, one query up. Stop and say so instead of pretending the
      // run is done.
      return { rows, capped, readFailed: true, readError: error.message };
    }

    const page = (data ?? []) as unknown as OverdueStepRow[];
    if (page.length === 0) break;

    rows.push(...page);
    const lastOfPage = page[page.length - 1];
    if (lastOfPage) cursor = lastOfPage.id;

    if (rows.length >= MAX_ROWS_PER_RUN) {
      if (lastOfPage) {
        const probe = await hasMoreRowsAfter(supabase, nowIso, lastOfPage.id);
        if (probe.error) return { rows, capped, readFailed: true, readError: probe.error };
        capped = probe.more;
      }
      break;
    }
    if (page.length < PAGE_SIZE) break;
  }

  return { rows, capped, readFailed: false };
}

/**
 * Dedupe one batch of overdue steps against today's `automation_events`
 * and emit `step_overdue` for whichever ones have not already fired
 * today, narrowing on a truncated read instead of abandoning the whole
 * batch.
 *
 * A capped read (see {@link DEDUPE_READ_LIMIT}) means too many rows
 * matched these ids, not that the ids themselves are invalid, so asking
 * about fewer of them is a strictly smaller version of the same
 * question and usually resolves it. On truncation this splits the batch
 * in half and recurses on each half: whichever half does not hold the
 * noisy id resolves cleanly, so its steps stop paying for a neighbour's
 * history.
 *
 * Halving from {@link DEDUPE_BATCH_SIZE} bottoms out at a single id in
 * about seven levels (100, 50, 25, 13, 7, 4, 2, 1), which is this
 * recursion's floor: a batch of one cannot be split any further, so a
 * single id that still truncates there is genuinely pathological rather
 * than a batching artifact, and it is skipped and alerted for itself
 * alone. Every call either returns directly or recurses on a strictly
 * smaller page, so the recursion always reaches that floor and returns.
 */
async function processDedupeBatch(
  supabase: SupabaseClient<Database>,
  page: OverdueStepRow[],
  watch: DeadlineWatch,
): Promise<number> {
  const ids = page.map((row) => row.id);

  const { data: alreadyEmitted, error: dedupeError } = await supabase
    .from('automation_events')
    .select('source_id')
    .eq('event_type', 'step_overdue')
    .gte('created_at', startOfUtcDay())
    .in('source_id', ids)
    .limit(DEDUPE_READ_LIMIT);

  if (dedupeError) {
    // Fail safe: without a working dedupe read we cannot tell which of
    // these steps already fired today, so emitting anyway risks
    // spamming a couple with the same nag many times over. Skipping the
    // batch costs one run's delay. The next tick picks it back up, so
    // that delay is recoverable; a duplicate nag is not. A read that
    // errors is not telling us the batch is too big, so retrying it
    // smaller is not obviously right, unlike the truncation case below;
    // this path stays a flat skip.
    await sendAlert({
      type: 'automation_overdue_read_failed',
      severity: 'error',
      stage: 'dedupe',
      count: ids.length,
      errorMessage: dedupeError.message,
    });
    return 0;
  }

  const rowsRead = alreadyEmitted ?? [];
  // A read that comes back holding exactly DEDUPE_READ_LIMIT rows looks
  // fine: no error, a full page of results. But PostgREST truncates a
  // `.limit(...)` silently, and DEDUPE_READ_LIMIT is only headroom, not
  // a proof that every id's row fit. Some steps carry many
  // `automation_events` rows for one day (a stray historical duplicate,
  // or one step's own runaway history), so a batch that leans on such an
  // id can genuinely have more matching rows than the cap. Treating a
  // capped read as untrustworthy, rather than a clean seen-set, is the
  // only way to avoid nagging those ids a second time.
  if (rowsRead.length >= DEDUPE_READ_LIMIT) {
    if (page.length === 1) {
      // Floor: nothing smaller than one id left to retry, so this id's
      // own day-bucket genuinely holds DEDUPE_READ_LIMIT or more rows on
      // its own. That is pathological on its own terms, not a side
      // effect of who else shared its batch, and no neighbour shares in
      // the skip.
      await sendAlert({
        type: 'automation_overdue_read_failed',
        severity: 'error',
        stage: 'dedupe_truncated',
        count: 1,
        errorMessage: `dedupe read returned ${rowsRead.length} rows, its cap of ${DEDUPE_READ_LIMIT}; treating as an incomplete read`,
      });
      return 0;
    }
    // Narrow instead of abandon: split the batch and retry each half.
    const mid = Math.ceil(page.length / 2);
    const first = await processDedupeBatch(supabase, page.slice(0, mid), watch);
    const second = await processDedupeBatch(supabase, page.slice(mid), watch);
    return first + second;
  }

  const seen = new Set(rowsRead.map((e) => e.source_id));
  let emitted = 0;

  for (const row of page) {
    // One RPC per row, so this loop is where a big backlog actually
    // spends the pass. Stopping mid-batch is safe: the day-bucket dedupe
    // means the rows already emitted are skipped next time round.
    if (watch.passed()) break;
    const instance = row.workflow_instances as unknown as {
      user_id: string;
      couple_id: string | null;
      status: string;
    } | null;
    // A cancelled or completed instance keeps its steps but must not
    // nag: the MC has already decided that work is not happening.
    if (!instance || instance.status !== 'active') continue;
    if (seen.has(row.id)) continue;
    if (!row.due_at) continue;

    const { error } = await supabase.rpc('emit_automation_event', {
      p_user_id: instance.user_id,
      p_source_table: 'workflow_steps',
      p_source_id: row.id,
      p_event_type: 'step_overdue',
      p_payload: {
        step_id: row.id,
        instance_id: row.instance_id,
        couple_id: instance.couple_id,
        step_type: row.type,
        title: row.title,
        due_at: row.due_at,
        days_overdue: daysOverdue(row.due_at),
      },
      ...(instance.couple_id ? { p_couple_id: instance.couple_id } : {}),
    });
    if (!error) emitted += 1;
  }

  return emitted;
}

async function run(
  supabase: SupabaseClient<Database>,
  opts: { deadline?: number } = {},
): Promise<number> {
  const nowIso = new Date().toISOString();
  const watch = watchDeadline(opts.deadline);
  const { rows, capped, readFailed, readError } = await fetchOverdueSteps(
    supabase,
    nowIso,
    watch,
  );

  if (readFailed) {
    await sendAlert({
      type: 'automation_overdue_read_failed',
      severity: 'error',
      stage: 'scan',
      count: rows.length,
      errorMessage: readError ?? 'unknown error',
    });
  }

  if (capped) {
    // A silent cap is the bug this whole fix is for, so hitting the next
    // ceiling up says so too, rather than returning quietly.
    await sendAlert({
      type: 'automation_overdue_scan_capped',
      severity: 'warn',
      reason: 'row_ceiling',
      scanned: rows.length,
      ceiling: MAX_ROWS_PER_RUN,
    });
  }

  // No early return on an empty scan: a run that stopped on the deadline
  // before reading its first page has nothing to show for itself either,
  // and that is the case most worth alerting on.
  let emitted = 0;

  // The dedupe read is batched well below PAGE_SIZE (see
  // DEDUPE_BATCH_SIZE) and scoped to each batch's own step ids, so the
  // `.in(...)` filter's URL always fits. Each batch is independent, so
  // one bad batch does not stop the rest of the page from being checked.
  for (let i = 0; i < rows.length; i += DEDUPE_BATCH_SIZE) {
    if (watch.passed()) break;
    emitted += await processDedupeBatch(supabase, rows.slice(i, i + DEDUPE_BATCH_SIZE), watch);
  }

  // Asked of the watch, not of a flag this loop maintains. The deadline
  // can land anywhere: before the first page, between two batches, or
  // partway through the rows of the last batch, where there is no next
  // iteration left to notice it.
  if (watch.stopped()) {
    // Same reasoning as the row ceiling above: stopping quietly is how a
    // workflow gated on `step_overdue` never fires and nobody finds out.
    // A tick or two of this is ordinary; every quarter hour is a
    // capacity signal.
    await sendAlert({
      type: 'automation_overdue_scan_capped',
      severity: 'warn',
      reason: 'deadline',
      scanned: rows.length,
      ceiling: MAX_ROWS_PER_RUN,
    });
  }

  return emitted;
}

export const stepOverdueEmitter: TimeEmitter = {
  type: 'step_overdue',
  run,
};
