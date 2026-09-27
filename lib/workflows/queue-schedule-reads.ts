/**
 * The reads behind the Upcoming list: the MC's running workflows, every
 * step on them, their couples' wedding dates and their quiet hours.
 *
 * Every read is paged to exhaustion (`./read-pages`): a list that is
 * silently short dates steps wrongly, so a read that cannot finish
 * throws and the page shows its error state instead. Split out of
 * `./queue-schedule` to keep both to their size budget.
 *
 * @module lib/workflows/queue-schedule-reads
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import type { QueueFilter } from './queue';
import { readAllPages } from './read-pages';
import type { ProjectionStep } from './schedule-projection';

/** A running workflow, as the list reads it. */
export interface ScheduleInstance {
  id: string;
  name: string;
  couple_id: string | null;
  template_id: string | null;
  applied_at: string;
  is_default: boolean;
  is_personal: boolean;
  couples: { name: string; event_date: string | null } | null;
}

/** One step, with what its row shows. */
export type ScheduleStep = ProjectionStep & { instance_id: string; description?: string | null };

/** Everything the list is built from. */
export interface ScheduleReads {
  instances: ScheduleInstance[];
  steps: ScheduleStep[];
  /** Earliest event date per couple, the date `loadWeddingDate` reads. */
  firstEvent: Map<string, string>;
  quietHours: Map<string, { quiet_hours_start: string | null; quiet_hours_end: string | null }>;
}

/** `in` lists per request; keeps the URL well under PostgREST's limit. */
const CHUNK = 60;
/** Far past any real MC; reaching it is an error, never a short list. */
const MAX_INSTANCES = 5_000;
const MAX_STEPS = 100_000;
const TOO_MANY = 'There are too many running workflows to list at once. Filter by couple.';

const STEP_FIELDS =
  'id, instance_id, position, type, status, timing, due_at, due_held_at, parent_step_id, ' +
  'branch_path, completed_at, requires_approval, title, config, description';

function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

const cap = (maxRows: number) => ({ maxRows, tooMany: TOO_MANY });

/**
 * Read everything the list needs for one MC.
 *
 * @throws Error on any failed read, `TooManyRowsError` past the caps
 */
export async function readSchedule(
  supabase: SupabaseClient<Database>,
  userId: string,
  filter: QueueFilter,
): Promise<ScheduleReads> {
  const instances = await readAllPages<ScheduleInstance>((from, to) => {
    let q = supabase
      .from('workflow_instances')
      .select(
        'id, name, couple_id, template_id, applied_at, is_default, is_personal, couples(name, event_date)',
      )
      .eq('user_id', userId)
      .eq('status', 'active');
    if (filter.coupleIds && filter.coupleIds.length > 0) q = q.in('couple_id', filter.coupleIds);
    return q.order('id').range(from, to) as never;
  }, cap(MAX_INSTANCES));
  if (instances.length === 0) {
    return { instances, steps: [], firstEvent: new Map(), quietHours: new Map() };
  }

  const ids = instances.map((i) => i.id);
  const coupleIds = [...new Set(instances.flatMap((i) => (i.couple_id ? [i.couple_id] : [])))];
  const templateIds = [
    ...new Set(instances.flatMap((i) => (i.template_id ? [i.template_id] : []))),
  ];

  const [stepChunks, eventChunks, templateChunks] = await Promise.all([
    // Finished steps too: they are what the next step is dated from.
    Promise.all(
      chunks(ids).map((part) =>
        readAllPages<ScheduleStep>(
          (from, to) =>
            supabase
              .from('workflow_steps')
              .select(STEP_FIELDS)
              .in('instance_id', part)
              .order('id')
              .range(from, to) as never,
          cap(MAX_STEPS),
        ),
      ),
    ),
    Promise.all(
      chunks(coupleIds).map((part) =>
        readAllPages<{ couple_id: string; date: string | null }>(
          (from, to) =>
            supabase
              .from('events')
              .select('couple_id, date')
              .in('couple_id', part)
              .order('date', { ascending: true })
              .order('id')
              .range(from, to) as never,
          cap(MAX_STEPS),
        ),
      ),
    ),
    Promise.all(
      chunks(templateIds).map((part) =>
        readAllPages<{
          id: string;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
        }>(
          (from, to) =>
            supabase
              .from('workflow_templates')
              .select('id, quiet_hours_start, quiet_hours_end')
              .in('id', part)
              .order('id')
              .range(from, to) as never,
          cap(MAX_INSTANCES),
        ),
      ),
    ),
  ]);

  const firstEvent = new Map<string, string>();
  for (const e of eventChunks.flat()) {
    if (e.date && !firstEvent.has(e.couple_id)) firstEvent.set(e.couple_id, e.date);
  }
  return {
    instances,
    steps: stepChunks.flat().map((row) => ({ ...row, config: row.config ?? {} })),
    firstEvent,
    quietHours: new Map(templateChunks.flat().map((t) => [t.id, t])),
  };
}
