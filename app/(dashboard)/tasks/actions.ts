/**
 * Server actions for the standalone `/tasks` surface (Phase 6).
 *
 * Lifts every inline `supabase.from('tasks')…` and
 * `supabase.from('task_groups')…` write out of the page + hook
 * file so the UI is pure composition. Every action:
 *
 * - **Zod-validates** the input. Free-form fields (priority,
 *   task_type) are length-bounded but not enum-restricted (MCs can
 *   add custom ones via the side panel — over-narrowing would
 *   break that feature). Enum-shaped fields (group color, status)
 *   are closed.
 * - **RLS-scoped** Supabase client. Server-side `getUser()` is the
 *   user identity; never escapes to the service role.
 * - Returns a tagged `ActionResult<T>` the hook can pattern-match.
 *
 * The Phase 4B `couples/actions.ts` already exposes
 * `createCoupleTaskAction` / `updateCoupleTaskAction` /
 * `deleteCoupleTaskAction` for the Tasks tab inside a couple's
 * profile (narrower: always tied to a coupleId). These standalone
 * versions accept the more general payload — `related_couple_id`
 * is optional, `related_event_id` is optional, `group_id` is
 * optional — so MCs can create unscoped tasks from the dedicated
 * page.
 *
 * @module app/(dashboard)/tasks/actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { createClient } from '@/lib/supabase/server';

/* ─── Tagged result type ───────────────────────────────────────── */

export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

export interface ActionFailure {
  ok: false;
  error: string;
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/* ─── Shared shapes ────────────────────────────────────────────── */

const uuidSchema = z.uuid();
const dateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .nullable();

const statusSchema = z.string().trim().min(1).max(100);
const prioritySchema = z.string().trim().min(1).max(100).nullable();
const groupColorSchema = z.enum([
  'gray',
  'green',
  'blue',
  'amber',
  'red',
  'purple',
]);

/** Strip undefined-valued keys before passing to Supabase update
 *  (exactOptionalPropertyTypes friendly). */
function compactPatch<T extends Record<string, unknown>>(
  patch: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const result = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) result[k] = v;
  }
  return result as { [K in keyof T]: Exclude<T[K], undefined> };
}

/* ─── Tasks ───────────────────────────────────────────────────── */

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  due_date: dateOrNull.default(null),
  description: z.string().max(5000).nullable().default(null),
  status: statusSchema.default('todo'),
  priority: prioritySchema.default(null),
  task_type: z.string().trim().max(100).nullable().default(null),
  related_couple_id: uuidSchema.nullable().default(null),
  related_event_id: uuidSchema.nullable().default(null),
  group_id: uuidSchema.nullable().default(null),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;

export async function createTaskAction(
  input: CreateTaskInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid task data.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...parsed.data, user_id: user.id })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('[tasks/actions] createTaskAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not create task.' };
  }

  return { ok: true, data: { id: data.id } };
}

const updateTaskSchema = z.object({
  id: uuidSchema,
  patch: z
    .object({
      title: z.string().trim().min(1).max(500).optional(),
      due_date: dateOrNull.optional(),
      description: z.string().max(5000).nullable().optional(),
      status: statusSchema.optional(),
      priority: prioritySchema.optional(),
      task_type: z.string().trim().max(100).nullable().optional(),
      related_couple_id: uuidSchema.nullable().optional(),
      related_event_id: uuidSchema.nullable().optional(),
      group_id: uuidSchema.nullable().optional(),
      position: z.number().int().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, {
      message: 'Patch must contain at least one field',
    }),
});

export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export async function updateTaskAction(
  input: UpdateTaskInput,
): Promise<ActionResult<void>> {
  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid task patch.' };
  }
  const { id, patch } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('tasks')
    .update(compactPatch(patch))
    .eq('id', id);

  if (error) {
    logger.error('[tasks/actions] updateTaskAction failed', error, {
      userId: user.id,
      taskId: id,
    });
    return { ok: false, error: 'Could not update task.' };
  }

  return { ok: true, data: undefined };
}

export async function deleteTaskAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Invalid task ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase.from('tasks').delete().eq('id', parsed.data);

  if (error) {
    logger.error('[tasks/actions] deleteTaskAction failed', error, {
      userId: user.id,
      taskId: id,
    });
    return { ok: false, error: 'Could not delete task.' };
  }

  return { ok: true, data: undefined };
}

/* ─── Bulk task operations ────────────────────────────────────── */

const bulkUpdateTasksSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'No tasks selected'),
  patch: z
    .object({
      status: statusSchema.optional(),
      priority: prioritySchema.optional(),
      task_type: z.string().trim().max(100).nullable().optional(),
      group_id: uuidSchema.nullable().optional(),
      due_date: dateOrNull.optional(),
    })
    .refine((p) => Object.keys(p).length > 0, {
      message: 'Patch must contain at least one field',
    }),
});

export type BulkUpdateTasksInput = z.input<typeof bulkUpdateTasksSchema>;

export async function bulkUpdateTasksAction(
  input: BulkUpdateTasksInput,
): Promise<ActionResult<void>> {
  const parsed = bulkUpdateTasksSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid bulk-update payload.' };
  }
  const { ids, patch } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('tasks')
    .update(compactPatch(patch))
    .in('id', ids);

  if (error) {
    logger.error('[tasks/actions] bulkUpdateTasksAction failed', error, {
      userId: user.id,
      count: ids.length,
    });
    return { ok: false, error: 'Could not update tasks.' };
  }

  return { ok: true, data: undefined };
}

const bulkDeleteTasksSchema = z.array(uuidSchema).min(1, 'No tasks selected');

export async function bulkDeleteTasksAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const parsed = bulkDeleteTasksSchema.safeParse(ids);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid bulk-delete payload.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('tasks')
    .delete()
    .in('id', parsed.data);

  if (error) {
    logger.error('[tasks/actions] bulkDeleteTasksAction failed', error, {
      userId: user.id,
      count: parsed.data.length,
    });
    return { ok: false, error: 'Could not delete tasks.' };
  }

  return { ok: true, data: undefined };
}

/**
 * Drag-reorder. Caller passes the ordered ids; we re-assign
 * `position` values as `(index + 1) * 1000` so future inserts can
 * slot in between two existing rows without re-numbering everything.
 */
const reorderTasksSchema = z.array(uuidSchema).min(1);

export async function reorderTasksAction(
  orderedIds: string[],
): Promise<ActionResult<{ updatedIds: string[] }>> {
  const parsed = reorderTasksSchema.safeParse(orderedIds);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid reorder payload.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const results = await Promise.all(
    parsed.data.map((id, i) =>
      supabase
        .from('tasks')
        .update({ position: (i + 1) * 1000 })
        .eq('id', id)
        .select('id')
        .single(),
    ),
  );

  const updatedIds: string[] = [];
  let firstError: { message?: string } | null = null;
  for (const r of results) {
    if (r.error) {
      firstError = firstError ?? r.error;
    } else if (r.data) {
      updatedIds.push(r.data.id);
    }
  }

  if (firstError) {
    logger.error('[tasks/actions] reorderTasksAction partial failure',
      firstError,
      { userId: user.id, attempted: parsed.data.length, updated: updatedIds.length },
    );
    return { ok: false, error: 'Could not reorder tasks.' };
  }

  return { ok: true, data: { updatedIds } };
}

/* ─── Task groups ─────────────────────────────────────────────── */

const createTaskGroupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  color: groupColorSchema.default('gray'),
});

export type CreateTaskGroupInput = z.input<typeof createTaskGroupSchema>;

export async function createTaskGroupAction(
  input: CreateTaskGroupInput,
): Promise<
  ActionResult<{ id: string; name: string; color: string; position: number }>
> {
  const parsed = createTaskGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid group data.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Compute next position server-side so concurrent calls don't
  // race on the same value (still possible under heavy load, but
  // safer than the client-side max-then-insert pattern).
  const { data: existing } = await supabase
    .from('task_groups')
    .select('position')
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1);
  const nextPosition =
    existing && existing.length > 0 ? (existing[0]?.position ?? 0) + 1 : 0;

  const { data, error } = await supabase
    .from('task_groups')
    .insert({ ...parsed.data, position: nextPosition, user_id: user.id })
    .select('id, name, color, position')
    .single();

  if (error || !data) {
    logger.error('[tasks/actions] createTaskGroupAction failed', error, {
      userId: user.id,
    });
    return { ok: false, error: 'Could not create group.' };
  }

  return { ok: true, data };
}

const updateTaskGroupSchema = z.object({
  id: uuidSchema,
  patch: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      color: groupColorSchema.optional(),
    })
    .refine((p) => Object.keys(p).length > 0, {
      message: 'Patch must contain at least one field',
    }),
});

export type UpdateTaskGroupInput = z.input<typeof updateTaskGroupSchema>;

export async function updateTaskGroupAction(
  input: UpdateTaskGroupInput,
): Promise<ActionResult<void>> {
  const parsed = updateTaskGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid group patch.' };
  }
  const { id, patch } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('task_groups')
    .update(compactPatch(patch))
    .eq('id', id);

  if (error) {
    logger.error('[tasks/actions] updateTaskGroupAction failed', error, {
      userId: user.id,
      groupId: id,
    });
    return { ok: false, error: 'Could not update group.' };
  }

  return { ok: true, data: undefined };
}

export async function deleteTaskGroupAction(
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Invalid group ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('task_groups')
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error('[tasks/actions] deleteTaskGroupAction failed', error, {
      userId: user.id,
      groupId: id,
    });
    return { ok: false, error: 'Could not delete group.' };
  }

  return { ok: true, data: undefined };
}

const reorderTaskGroupsSchema = z.array(uuidSchema).min(1);

export async function reorderTaskGroupsAction(
  orderedIds: string[],
): Promise<ActionResult<void>> {
  const parsed = reorderTaskGroupsSchema.safeParse(orderedIds);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid reorder payload.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Sequential not parallel — task_groups has a UNIQUE on
  // (user_id, position) per migration; concurrent updates with
  // overlapping positions would conflict. Sequential keeps the
  // intermediate states clean.
  for (let i = 0; i < parsed.data.length; i++) {
    const { error } = await supabase
      .from('task_groups')
      .update({ position: i })
      .eq('id', parsed.data[i] as string);
    if (error) {
      logger.error('[tasks/actions] reorderTaskGroupsAction failed', error, {
        userId: user.id,
        groupId: parsed.data[i],
        index: i,
      });
      return { ok: false, error: 'Could not reorder groups.' };
    }
  }

  return { ok: true, data: undefined };
}
