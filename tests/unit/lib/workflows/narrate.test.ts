import { describe, expect, it } from 'vitest';

import { narrateWorkflowEvent } from '@/lib/workflows/narrate';

describe('narrateWorkflowEvent', () => {
  it('names a removed step from the audit detail, since the delete nulls the join', () => {
    expect(
      narrateWorkflowEvent('step_removed', { manual: true, title: 'Branch', type: 'branch' }, {}),
    ).toBe('Removed: Branch');
  });

  it('prefers the joined title when the step still exists', () => {
    expect(narrateWorkflowEvent('step_removed', { title: 'old' }, { stepTitle: 'Call them' })).toBe(
      'Removed: Call them',
    );
  });

  it('falls back to the bare label when the removed step had no title', () => {
    expect(narrateWorkflowEvent('step_removed', { title: '' }, {})).toBe('Removed');
  });
});
