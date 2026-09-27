/**
 * The Start preview's projection (Phase 3, Task 20).
 *
 * The MC sees the workflow's calendar before it starts on a couple, and
 * a step the apply will skip because its date is already gone is flagged
 * as such. These pin the flags against the plan's own case: a long
 * wedding workflow applied three weeks out.
 */
import { describe, expect, it } from 'vitest';

import { projectApply } from '@/lib/workflows/apply-projection';

import {
  afterPrevious,
  draft,
  everyArm,
  NOW,
  onStart,
  TZ,
  WEDDING,
  weddingBefore,
} from './apply-fixtures';

const anchors = (weddingDate: string | null) => ({
  weddingDate,
  appliedAt: NOW.toISOString(),
  timezone: TZ,
});

describe('projectApply', () => {
  it('flags the steps already past three weeks out, and keeps the week-before one', () => {
    const rows = projectApply(
      [
        draft('six', 0, weddingBefore(6, 'months')),
        draft('three', 1, weddingBefore(3, 'months')),
        draft('week', 2, weddingBefore(1, 'weeks')),
      ],
      anchors(WEDDING),
      NOW,
    );
    expect(rows.map((r) => [r.id, r.flag, r.date])).toEqual([
      ['six', 'skipped_past', '2026-04-15'],
      ['three', 'skipped_past', '2026-07-15'],
      ['week', 'scheduled', '2026-10-08'],
    ]);
  });

  it('keeps a "send now" step scheduled for today', () => {
    const rows = projectApply(
      [draft('now', 0, afterPrevious(0)), draft('start-day', 1, onStart)],
      anchors(WEDDING),
      NOW,
    );
    expect(rows.map((r) => [r.flag, r.date])).toEqual([
      ['scheduled', '2026-09-24'],
      ['scheduled', '2026-09-24'],
    ]);
  });

  it('marks a to-do manual, even when its date has passed', () => {
    const rows = projectApply(
      [draft('call', 0, weddingBefore(2, 'months'), { type: 'todo', config: {} })],
      anchors(WEDDING),
      NOW,
    );
    expect(rows[0]).toMatchObject({ flag: 'manual', date: '2026-08-15' });
  });

  it('says a wedding-dated step needs a wedding date when the couple has none', () => {
    const rows = projectApply(
      [draft('send-now', 0, onStart), draft('month-out', 1, weddingBefore(1, 'months'))],
      anchors(null),
      NOW,
    );
    expect(rows.map((r) => [r.flag, r.date])).toEqual([
      ['scheduled', '2026-09-24'],
      ['needs_wedding_date', null],
    ]);
  });

  it('follows the cascade: a zero-delay follower is skipped, a delayed one waits for the earlier email', () => {
    const rows = projectApply(everyArm(), anchors(WEDDING), NOW);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get('skip-same-moment')?.flag).toBe('skipped_past');
    // Was "dated from the skip" (2026-09-26). Since the owner's ruling of
    // 2026-09-27 a step is released only once every earlier step in its
    // lane has run, and "send-now" above it has not run yet at the apply.
    // So it still runs, but undated in the preview: it waits for that
    // email, then is dated two days after the later of the two.
    expect(byId.get('two-days-after')).toMatchObject({ flag: 'scheduled', date: null });
    expect(byId.get('approval-past')?.flag).toBe('scheduled');
  });

  it('words each timing the way the rest of the app does', () => {
    const [row] = projectApply([draft('week', 0, weddingBefore(1, 'weeks'))], anchors(WEDDING), NOW);
    expect(row?.timing).toBe('1 week before the wedding');
  });

  it('lists branch children under their branch, in lane order', () => {
    const rows = projectApply(
      [
        draft('branch', 0, onStart, { type: 'branch', config: {} }),
        draft('no-1', 0, afterPrevious(0), { parent_step_id: 'branch', branch_path: 'no' }),
        draft('yes-1', 0, afterPrevious(0), { parent_step_id: 'branch', branch_path: 'yes' }),
        draft('after', 1, afterPrevious(0)),
      ],
      anchors(WEDDING),
      NOW,
    );
    expect(rows.map((r) => [r.id, r.depth])).toEqual([
      ['branch', 0],
      ['yes-1', 1],
      ['no-1', 1],
      ['after', 0],
    ]);
  });
});
