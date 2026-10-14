/**
 * Wording for the Activate confirmation. Each branch states something
 * different: a count, an empty audience, or a failed count.
 */
import { describe, expect, it } from 'vitest';

import { activateDescription } from '@/features/outreach/views/campaigns/activate-copy';

const base = { counting: false, failed: false, dailyNew: 10, sequences: 2 };

describe('activateDescription', () => {
  it('states the audience size and the pace', () => {
    expect(activateDescription({ ...base, count: 42 })).toBe(
      'Start sending to up to 42 celebrants, 10 new per day across 2 sequences?',
    );
  });

  it('uses the singular for one celebrant and one sequence', () => {
    expect(activateDescription({ ...base, count: 1, sequences: 1 })).toBe(
      'Start sending to up to 1 celebrant, 10 new per day across 1 sequence?',
    );
  });

  it('warns when the audience is empty but still lets the founder go ahead', () => {
    const text = activateDescription({ ...base, count: 0 });
    expect(text).toContain('No active celebrants match this audience yet');
    expect(text).toContain('Activate anyway?');
  });

  it('says it is counting while the request is in flight', () => {
    expect(activateDescription({ ...base, counting: true, count: undefined })).toBe('Counting matching celebrants...');
  });

  it('still states the pace when the count fails', () => {
    const text = activateDescription({ ...base, failed: true, count: undefined });
    expect(text).toContain('Could not count the audience');
    expect(text).toContain('10 new per day across 2 sequences');
  });
});
