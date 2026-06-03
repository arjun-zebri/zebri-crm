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
  // Optional client-generated UUID so the optimistic UI row uses the
  // same id the server-side row ends up with — see the matching
  // comment in `app/(dashboard)/couples/actions.ts` for the full
  // rationale (lets cell edits fire against a real id immediately
  // after `+ New task`).
  id: uuidSchema.optional(),
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

/* ─── Task option lookups (priority + task_type) ───────────────── */
//
// Custom priorities and task types persist in their own lookup tables
// (`task_priorities`, `task_types`) so a user-created option keeps
// showing up in the cell dropdown even when no task currently
// references it, and so each option carries a stable colour.
//
// The lookup tables are *additive* to whatever value lives in
// `tasks.priority` / `tasks.task_type` — the tasks table still stores
// the option name as free-form text, the lookup just decides which
// names appear in the dropdown and what colour to render them in.
//
// The two tables are structurally identical, so the actions are
// parameterised over a `'priority' | 'type'` discriminator to avoid
// two near-identical copies.

const optionColorSchema = z.enum([
  'gray',
  'green',
  'blue',
  'amber',
  'red',
  'purple',
]);

const createOptionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  color: optionColorSchema.default('gray'),
});

const updateOptionSchema = z.object({
  id: uuidSchema,
  patch: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      color: optionColorSchema.optional(),
    })
    .refine((p) => Object.keys(p).length > 0, {
      message: 'Patch must contain at least one field',
    }),
});

export type CreateTaskOptionInput = z.input<typeof createOptionSchema>;
export type UpdateTaskOptionInput = z.input<typeof updateOptionSchema>;

type OptionKind = 'priority' | 'type' | 'status';

const optionTable = (kind: OptionKind) => {
  if (kind === 'priority') return 'task_priorities';
  if (kind === 'status') return 'task_statuses';
  return 'task_types';
};

const optionTaskColumn = (kind: OptionKind) => {
  if (kind === 'priority') return 'priority';
  if (kind === 'status') return 'status';
  return 'task_type';
};

async function createTaskOptionAction(
  kind: OptionKind,
  input: CreateTaskOptionInput,
): Promise<
  ActionResult<{ id: string; name: string; color: string; position: number }>
> {
  const parsed = createOptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid option data.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Position is computed server-side so concurrent creates don't
  // collide on a stale client-side max.
  const { data: existing } = await supabase
    .from(optionTable(kind))
    .select('position')
    .eq('user_id', user.id)
    .order('position', { ascending: false })
    .limit(1);
  const nextPosition =
    existing && existing.length > 0 ? (existing[0]?.position ?? 0) + 1 : 0;

  const { data, error } = await supabase
    .from(optionTable(kind))
    .insert({ ...parsed.data, position: nextPosition, user_id: user.id })
    .select('id, name, color, position')
    .single();

  if (error || !data) {
    logger.error(`[tasks/actions] createTaskOptionAction(${kind}) failed`,
      error,
      { userId: user.id },
    );
    return { ok: false, error: 'Could not create option.' };
  }

  return { ok: true, data };
}

async function updateTaskOptionAction(
  kind: OptionKind,
  input: UpdateTaskOptionInput,
): Promise<ActionResult<void>> {
  const parsed = updateOptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid option patch.' };
  }
  const { id, patch } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // If the name is changing, cascade the rename to every task that
  // references the old name so the assignments stay in sync.
  if (patch.name) {
    const { data: row } = await supabase
      .from(optionTable(kind))
      .select('name')
      .eq('id', id)
      .single();
    const previousName = row?.name;
    if (previousName && previousName !== patch.name) {
      await supabase
        .from('tasks')
        .update({ [optionTaskColumn(kind)]: patch.name })
        .eq('user_id', user.id)
        .eq(optionTaskColumn(kind), previousName);
    }
  }

  const { error } = await supabase
    .from(optionTable(kind))
    .update(compactPatch(patch))
    .eq('id', id);

  if (error) {
    logger.error(`[tasks/actions] updateTaskOptionAction(${kind}) failed`,
      error,
      { userId: user.id, optionId: id },
    );
    return { ok: false, error: 'Could not update option.' };
  }

  return { ok: true, data: undefined };
}

async function deleteTaskOptionAction(
  kind: OptionKind,
  id: string,
): Promise<ActionResult<void>> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Invalid option ID.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Look up the name first so we can null it out on referencing tasks.
  // Two round-trips here — could be folded into a single Postgres
  // function later, but the volume on these surfaces is tiny.
  const { data: row } = await supabase
    .from(optionTable(kind))
    .select('name')
    .eq('id', parsed.data)
    .single();

  const { error } = await supabase
    .from(optionTable(kind))
    .delete()
    .eq('id', parsed.data);

  if (error) {
    logger.error(`[tasks/actions] deleteTaskOptionAction(${kind}) failed`,
      error,
      { userId: user.id, optionId: id },
    );
    return { ok: false, error: 'Could not delete option.' };
  }

  if (row?.name) {
    // `tasks.status` is NOT NULL (defaults to 'todo'), so deleting a
    // custom status resets referencing tasks to the built-in 'todo'
    // rather than nulling them out. Priority and task_type are
    // nullable so they get cleared.
    const fallback: string | null = kind === 'status' ? 'todo' : null;
    // Best-effort — failure here doesn't undo the delete; the task
    // just keeps a dangling label that the UI falls back to a
    // hash-derived colour for.
    await supabase
      .from('tasks')
      .update({ [optionTaskColumn(kind)]: fallback })
      .eq('user_id', user.id)
      .eq(optionTaskColumn(kind), row.name);
  }

  return { ok: true, data: undefined };
}

/* Priority-specific exports (thin wrappers around the generic
 * helpers above so call sites stay typed and discoverable). */

export async function createTaskPriorityAction(
  input: CreateTaskOptionInput,
) {
  return createTaskOptionAction('priority', input);
}

export async function updateTaskPriorityAction(
  input: UpdateTaskOptionInput,
) {
  return updateTaskOptionAction('priority', input);
}

export async function deleteTaskPriorityAction(id: string) {
  return deleteTaskOptionAction('priority', id);
}

/* Task-type-specific exports. */

export async function createTaskTypeAction(input: CreateTaskOptionInput) {
  return createTaskOptionAction('type', input);
}

export async function updateTaskTypeAction(input: UpdateTaskOptionInput) {
  return updateTaskOptionAction('type', input);
}

export async function deleteTaskTypeAction(id: string) {
  return deleteTaskOptionAction('type', id);
}

/* Status-specific exports. Same shape as priority/type but writes to
 * `task_statuses` and falls back to the built-in `todo` rather than
 * nulling references (since `tasks.status` is NOT NULL). */

export async function createTaskStatusAction(input: CreateTaskOptionInput) {
  return createTaskOptionAction('status', input);
}

export async function updateTaskStatusAction(input: UpdateTaskOptionInput) {
  return updateTaskOptionAction('status', input);
}

export async function deleteTaskStatusAction(id: string) {
  return deleteTaskOptionAction('status', id);
}
