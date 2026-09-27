/**
 * The preview and the apply agree on what gets skipped (Phase 3, Task 20).
 *
 * The Start preview flags the steps an apply will skip because their
 * date is already gone. If it ever disagreed with `settlePastOnApply`,
 * the MC would be told one thing and the couple would get another. Both
 * read one pure rule (`lib/workflows/apply-skips`); this feeds the same
 * workflow to the real `settlePastOnApply`, over an in-memory stand-in
 * for the steps table, and to the projection, and asserts they match.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recomputeDueDates } from '@/lib/workflows/timing';
import type { Database } from '@/types/database';
import type { WorkflowInstanceRow, WorkflowStepRow } from '@/types/workflows';

import { everyArm, NOW, pastBranchArm, TZ, WEDDING } from './apply-fixtures';

/** The in-memory `workflow_steps` table. */
let table: WorkflowStepRow[] = [];

vi.mock('@/lib/workflows/audit', () => ({
  writeAudit: vi.fn(async () => undefined),
  writeAuditMany: vi.fn(async () => undefined),
}));

// The real recompute reads the wedding date and timezone from the DB;
// here they are the fixture's, and the patch is the same pure function.
vi.mock('@/lib/workflows/executor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/workflows/executor')>();
  return {
    ...actual,
    recomputeInstance: vi.fn(async (_c: unknown, instance: WorkflowInstanceRow) => {
      const patch = recomputeDueDates(table, {
        weddingDate: WEDDING,
        appliedAt: instance.applied_at,
        timezone: TZ,
      });
      for (const p of patch) {
        const row = table.find((s) => s.id === p.id);
        if (row && row.status !== 'waiting' && row.status !== 'running') row.due_at = p.due_at;
      }
    }),
  };
});

// eslint-disable-next-line import/order
import { projectApply } from '@/lib/workflows/apply-projection';
// eslint-disable-next-line import/order
import { settlePastOnApply } from '@/lib/workflows/resume';

/** Just enough of the query builder for the steps table. */
function fakeClient(): SupabaseClient<Database> {
  const steps = {
    select: () => ({
      eq: async (_col: string, instanceId: string) => ({
        data: table.filter((s) => s.instance_id === instanceId).map((s) => ({ ...s })),
        error: null,
      }),
    }),
    update: (patch: Partial<WorkflowStepRow>) => {
      const filters: Array<(s: WorkflowStepRow) => boolean> = [];
      const chain = {
        eq(col: keyof WorkflowStepRow, value: unknown) {
          filters.push((s) => s[col] === value);
          return chain;
        },
        in(col: keyof WorkflowStepRow, values: unknown[]) {
          filters.push((s) => values.includes(s[col]));
          return chain;
        },
        async select() {
          const hit = table.filter((s) => filters.every((f) => f(s)));
          for (const row of hit) Object.assign(row, patch);
          return { data: hit.map((s) => ({ id: s.id, due_at: s.due_at })), error: null };
        },
      };
      return chain;
    },
  };
  return { from: () => steps } as unknown as SupabaseClient<Database>;
}

const INSTANCE = {
  id: 'inst-1',
  user_id: 'user-1',
  couple_id: 'couple-1',
  applied_at: NOW.toISOString(),
} as WorkflowInstanceRow;

/** Date the drafts exactly as `applyTemplate` does before it settles. */
function datedLikeApply(drafts: WorkflowStepRow[] = everyArm()): WorkflowStepRow[] {
  const patch = recomputeDueDates(drafts, {
    weddingDate: WEDDING,
    appliedAt: NOW.toISOString(),
    timezone: TZ,
  });
  return drafts.map((s) => ({ ...s, due_at: patch.find((p) => p.id === s.id)?.due_at ?? null }));
}

describe('the apply and its preview skip the same steps', () => {
  beforeEach(() => {
    table = datedLikeApply();
    // The skip stamps `completed_at` with the wall clock; pin it to the
    // fixture's apply moment so what follows a skip dates predictably.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('agrees on every arm of the rule', async () => {
    const preview = projectApply(
      everyArm(),
      { weddingDate: WEDDING, appliedAt: NOW.toISOString(), timezone: TZ },
      NOW,
    )
      .filter((r) => r.flag === 'skipped_past')
      .map((r) => r.id)
      .sort();

    const count = await settlePastOnApply(
      fakeClient(),
      INSTANCE,
      { weddingDate: WEDDING, timezone: TZ },
      NOW,
    );
    const applied = table
      .filter((s) => s.status === 'skipped')
      .map((s) => s.id)
      .sort();

    expect(applied).toEqual(['skip-after-wait', 'skip-past-wait', 'skip-same-moment', 'skip-six-months']);
    expect(preview).toEqual(applied);
    expect(count).toBe(applied.length);
  });

  it('dates what follows a skip the same way in both', async () => {
    const preview = projectApply(
      everyArm(),
      { weddingDate: WEDDING, appliedAt: NOW.toISOString(), timezone: TZ },
      NOW,
    );
    await settlePastOnApply(fakeClient(), INSTANCE, { weddingDate: WEDDING, timezone: TZ }, NOW);
    const twoDays = table.find((s) => s.id === 'two-days-after');
    // Both leave it undated the same way: it waits for "send-now" above
    // it, which has not run at the apply (owner ruling 2026-09-27; see
    // apply-projection.test.ts). It was dated from the skip before.
    expect(twoDays).toMatchObject({ status: 'pending', due_at: null });
    expect(preview.find((r) => r.id === 'two-days-after')?.date).toBeNull();
  });

  it('agrees on a past branch: the branch, its whole subtree, and what it releases', async () => {
    table = datedLikeApply(pastBranchArm());
    const preview = projectApply(
      pastBranchArm(),
      { weddingDate: WEDDING, appliedAt: NOW.toISOString(), timezone: TZ },
      NOW,
    )
      .filter((r) => r.flag === 'skipped_past')
      .map((r) => r.id)
      .sort();

    await settlePastOnApply(fakeClient(), INSTANCE, { weddingDate: WEDDING, timezone: TZ }, NOW);
    const applied = table
      .filter((s) => s.status === 'skipped')
      .map((s) => s.id)
      .sort();

    expect(applied).toEqual(
      pastBranchArm()
        .map((s) => s.id)
        .filter((id) => id.startsWith('skip-'))
        .sort(),
    );
    // The projection lists a nested branch's lane at depth 1 under its
    // top-level root only, so compare on the rows it does show.
    expect(preview).toEqual(applied.filter((id) => id !== 'skip-nested-lane'));
    expect(table.find((s) => s.id === 'future-branch')?.status).toBe('pending');
    expect(table.find((s) => s.id === 'future-lane')?.status).toBe('pending');
  });
});
