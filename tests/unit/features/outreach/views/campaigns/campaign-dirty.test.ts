/**
 * The campaign editor asks before discarding edits. "Dirty" means the
 * draft differs from the state the editor opened with.
 */
import { describe, expect, it } from 'vitest';

import { blankCampaign, isDraftDirty } from '@/features/outreach/views/campaigns/campaign-draft';

describe('isDraftDirty', () => {
  it('is clean for a fresh blank draft', () => {
    const d = blankCampaign();
    expect(isDraftDirty(d, blankCampaign())).toBe(false);
  });

  it('is dirty after typing a name', () => {
    const initial = blankCampaign();
    expect(isDraftDirty({ ...initial, name: 'NSW' }, initial)).toBe(true);
  });

  it('is clean again when an edit is undone to the opening value', () => {
    const initial = blankCampaign();
    const edited = { ...initial, minScore: 40 };
    expect(isDraftDirty({ ...edited, minScore: null }, initial)).toBe(false);
  });

  it('is dirty when a sequence weight changes', () => {
    const initial = { ...blankCampaign(), arms: [{ sequence_id: 's1', weight: 1 }] };
    expect(isDraftDirty({ ...initial, arms: [{ sequence_id: 's1', weight: 2 }] }, initial)).toBe(true);
  });
});
