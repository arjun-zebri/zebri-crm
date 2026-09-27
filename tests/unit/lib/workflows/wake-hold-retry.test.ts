/**
 * `wakeHold` when the quiet-hours check cannot run.
 *
 * Finishing the wait without the check could release the send behind it
 * inside quiet hours, so a throw while building the context must come
 * back as `retry` (leave the row for the next tick), never `finish`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { wakeHold } from '@/lib/workflows/executor';
import type { Database } from '@/types/database';
import type { WorkflowInstanceRow, WorkflowStepRow } from '@/types/workflows';

vi.mock('@/lib/workflows/context', () => ({
  buildStepContext: vi.fn(async () => {
    throw new Error('connection reset');
  }),
}));

/** Answers the template quiet-hours read with "no override". */
const supabase = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
  }),
} as unknown as SupabaseClient<Database>;

const instance = { id: 'i1', user_id: 'u1', couple_id: 'c1', template_id: 't1' } as WorkflowInstanceRow;
const wait = {
  id: 's1',
  type: 'wait',
  status: 'waiting',
  config: { mode: 'duration', durationMinutes: 60 },
  due_at: '2027-05-31T21:00:00.000Z',
} as unknown as WorkflowStepRow;

describe('wakeHold', () => {
  it('asks for a retry, not a finish, when the context cannot be built', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const decision = await wakeHold(supabase, instance, wait, new Date('2027-05-31T21:30:00.000Z'));
    expect(decision).toEqual({ kind: 'retry' });
  });
});
