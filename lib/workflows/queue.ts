/**
 * The work queue: every step due across every couple.
 *
 * This is the MC's daily view and the surface that replaces the Tasks
 * board. It carries manual steps (the ones only a person can tick) plus
 * any step that errored, because an errored automated step is work the
 * MC has to deal with and would otherwise be visible only by opening the
 * couple it belongs to.
 *
 * Grouping is a local-date calculation, so it takes the MC's timezone
 * rather than assuming UTC. A step due at 23:00 on a Sydney evening is
 * due *today* even when "now" is already the next UTC day.
 *
 * @module lib/workflows/queue
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { zonedDateParts } from '@/lib/scheduling/timezone';
import type { Database } from '@/types/database';
import type { StepStatus, StepType } from '@/types/workflows';

import { loadScheduledItems, type McQuietHours } from './queue-schedule';
import { stepDisplayTitle } from './step-label';
import { isAutomated } from './steps';

/** Fallback when the MC has never saved a timezone. */
const DEFAULT_TIMEZONE = 'Australia/Sydney';

/** One row in the queue. */
export interface QueueItem {
  stepId: string;
  instanceId: string;
  instanceName: string;
  /** Null for the user's personal workflow, which belongs to no couple. */
  coupleId: string | null;
  coupleName: string | null;
  weddingDate: string | null;
  /** The whole name, e.g. "Send email · Sam & Priya check in". */
  title: string;
  /**
   * What the step does ("Send email"), set only when {@link name} is a
   * detail read out of its config. Lists print it quietly beside the
   * name. See `stepLabelParts` in `./step-label`.
   */
  kind?: string | null;
  /** The name without its kind, e.g. "Sam & Priya check in". */
  name?: string;
  type: StepType;
  status: StepStatus;
  dueAt: string | null;
  /** When it was ticked or skipped. Only set on the done list. */
  completedAt?: string | null;
  /** True when this send waits for the MC's OK. See `lib/workflows/review`. */
  requiresApproval?: boolean;
  /** The step's own note, shown under the title in the Today view. */
  description?: string | null;
  /**
   * Why an unfinished step has no time yet, in plain words ("After you
   * finish “Call the venue”"). Set only when `dueAt` is null because a
   * person decides when it runs. See `./schedule-projection`.
   */
  gate?: string | null;
  /**
   * An automated step still behind an earlier step, or with only a
   * projected time: the MC can see it but not snooze or send it, since
   * either would send it out of order. See `./release`.
   */
  blocked?: boolean;
}

/** The three groups the queue renders. */
export interface QueueResult {
  /**
   * Automated sends holding for the MC's OK, and the reason the old
   * approval-by-email gate is gone. These come first: they are the only
   * group where doing nothing means something does not happen.
   */
  review: QueueItem[];
  overdue: QueueItem[];
  today: QueueItem[];
  upcoming: QueueItem[];
  /**
   * Automated steps that will run by themselves today, listed so nothing
   * ever surprises the MC. Read-only; there is nothing to tick.
   */
  sendingToday: QueueItem[];
  /**
   * Automated steps that run after today, or once a person acts: every
   * send the MC has coming, at the time the engine will send it. Kept
   * apart from `upcoming` so the digest, which reads only today's
   * groups, is unchanged.
   */
  scheduled: QueueItem[];
}

/** Narrowing options for the queue. */
export interface QueueFilter {
  coupleIds?: string[];
  types?: StepType[];
}

/**
 * How far back the done list reaches.
 *
 * Long enough to cover the run-up to a wedding that has just happened,
 * short enough that the query stays a single cheap read.
 */
export const DONE_WINDOW_DAYS = 90;

/** Statuses the done list shows: both terminal states the MC chose. */
const DONE_STATUSES = ['done', 'skipped'] as const;

/**
 * Sort key for a group: earliest first, undated last.
 *
 * An undated ad-hoc to-do is still real work, so it stays in the list
 * rather than being dropped; it just sorts to the bottom.
 */
function byDueDate(a: QueueItem, b: QueueItem): number {
  if (a.dueAt === null && b.dueAt === null) return 0;
  if (a.dueAt === null) return 1;
  if (b.dueAt === null) return -1;
  return a.dueAt.localeCompare(b.dueAt);
}

/**
 * Split queue items into overdue, due today and upcoming.
 *
 * Pure, and exported separately from {@link loadQueue} so the date
 * boundary logic can be tested without a database.
 *
 * @param items - every candidate step
 * @param now - the instant to compare against
 * @param timezone - the MC's IANA zone; local dates are resolved in it
 */
export function groupQueueItems(items: QueueItem[], now: Date, timezone: string): QueueResult {
  const todayLocal = zonedDateParts(now, timezone).date;

  const review: QueueItem[] = [];
  const overdue: QueueItem[] = [];
  const today: QueueItem[] = [];
  const upcoming: QueueItem[] = [];
  const sendingToday: QueueItem[] = [];
  const scheduled: QueueItem[] = [];

  for (const item of items) {
    // An errored step is always the MC's most urgent problem, whatever
    // date it carries and whoever was meant to run it.
    if (item.status === 'errored') {
      overdue.push(item);
      continue;
    }

    if (isAutomated(item.type)) {
      // An automated step is never a to-do: it is waiting for the MC's
      // OK, running today, or scheduled for later (or behind something
      // only a person can finish). The MC sees every one of them, so
      // nothing the engine sends is a surprise.
      const due = item.dueAt === null ? null : new Date(item.dueAt);
      if (item.requiresApproval && due !== null && due.getTime() <= now.getTime()) {
        review.push(item);
      } else if (due !== null && zonedDateParts(due, timezone).date <= todayLocal) {
        sendingToday.push(item);
      } else {
        scheduled.push(item);
      }
      continue;
    }

    if (item.dueAt === null) {
      upcoming.push(item);
      continue;
    }
    const dueLocal = zonedDateParts(new Date(item.dueAt), timezone).date;
    if (dueLocal < todayLocal) overdue.push(item);
    else if (dueLocal === todayLocal) today.push(item);
    else upcoming.push(item);
  }

  return {
    review: review.sort(byDueDate),
    overdue: overdue.sort(byDueDate),
    today: today.sort(byDueDate),
    upcoming: upcoming.sort(byDueDate),
    sendingToday: sendingToday.sort(byDueDate),
    scheduled: scheduled.sort(byDueDate),
  };
}

/** Shape of the joined row PostgREST returns for the done-list read. */
interface QueueRow {
  id: string;
  instance_id: string;
  title: string;
  /** Needed to name a step the MC never named. See `./step-label`. */
  config: unknown;
  description: string | null;
  type: string;
  status: string;
  due_at: string | null;
  requires_approval: boolean;
  workflow_instances: {
    id: string;
    name: string;
    couple_id: string | null;
    status: string;
    couples: { name: string; event_date: string | null } | null;
  } | null;
}

/** Options for {@link loadQueue}. */
export interface LoadQueueOptions {
  /**
   * The MC's quiet hours, which move a Wait's end and so every send
   * behind it. The server action passes them from the session; left out,
   * a Wait is projected as if there were none.
   */
  mcQuietHours?: McQuietHours | null;
  /** Injectable for tests. */
  now?: Date;
}

/**
 * Load and group the queue for one user.
 *
 * Every unfinished step on every running workflow, each dated the way
 * the engine will run it (`./queue-schedule`), so a send behind a Wait
 * shows at the time it will go rather than as "no date". Grouped in
 * memory, then capped at `limit` rows, soonest first.
 */
export async function loadQueue(
  supabase: SupabaseClient<Database>,
  userId: string,
  filter: QueueFilter = {},
  limit = 500,
  opts: LoadQueueOptions = {},
): Promise<QueueResult> {
  const { data: settings } = await supabase
    .from('user_public_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;
  const now = opts.now ?? new Date();

  const items = await loadScheduledItems(
    supabase,
    userId,
    timezone,
    opts.mcQuietHours ?? null,
    filter,
    now,
  );
  // Soonest first, reasons last, before the cap: the cap should drop
  // what is furthest away, never something due today.
  const capped = [...items].sort(byDueDate).slice(0, limit);
  return groupQueueItems(capped, now, timezone);
}

/**
 * Everything the MC has ticked or skipped recently.
 *
 * Deliberately not filtered to active instances, unlike {@link
 * loadQueue}. Ticking the last step of a workflow flips its instance to
 * `completed`, so an `instances.status = 'active'` filter here would
 * hide exactly the steps that finished something: the last step of
 * every workflow the MC ever completed.
 *
 * @param supabase - the caller's own RLS-scoped client
 * @param userId - read from the session by the caller, never a parameter
 *   the browser supplies
 * @param limit - row cap, matching the queue's
 * @param now - injectable for tests
 */
export async function loadDoneSteps(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 200,
  now: Date = new Date(),
): Promise<QueueItem[]> {
  const since = new Date(now.getTime() - DONE_WINDOW_DAYS * 86_400_000).toISOString();

  const { data } = await supabase
    .from('workflow_steps')
    .select(
      'id, instance_id, title, config, description, type, status, due_at, completed_at, ' +
        'requires_approval, ' +
        'workflow_instances!inner(id, name, couple_id, status, couples(name, event_date))',
    )
    .eq('workflow_instances.user_id', userId)
    .in('status', DONE_STATUSES)
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as unknown as (QueueRow & { completed_at: string | null })[];

  return rows
    .filter((row) => row.workflow_instances !== null)
    .map((row) => {
      const instance = row.workflow_instances!;
      return {
        stepId: row.id,
        instanceId: row.instance_id,
        instanceName: instance.name,
        coupleId: instance.couple_id,
        coupleName: instance.couples?.name ?? null,
        weddingDate: instance.couples?.event_date ?? null,
        title: stepDisplayTitle(row),
        description: row.description,
        type: row.type as StepType,
        status: row.status as StepStatus,
        dueAt: row.due_at,
        completedAt: row.completed_at,
        requiresApproval: row.requires_approval,
      };
    });
}

/**
 * How many rows {@link loadDoneSteps} would return.
 *
 * Runs beside the queue so the collapsed "Done" strip can show its
 * number, and hide itself entirely at zero, without pulling the rows.
 *
 * @param supabase - the caller's own RLS-scoped client
 * @param userId - read from the session by the caller
 * @param now - injectable for tests
 */
export async function countDoneSteps(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - DONE_WINDOW_DAYS * 86_400_000).toISOString();

  const { count } = await supabase
    .from('workflow_steps')
    .select('id, workflow_instances!inner(user_id)', { count: 'exact', head: true })
    .eq('workflow_instances.user_id', userId)
    .in('status', DONE_STATUSES)
    .gte('completed_at', since);

  return count ?? 0;
}
