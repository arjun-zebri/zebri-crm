import { describe, expect, it } from 'vitest';

import { campaignStatusLine } from '@/features/outreach/views/campaigns/campaign-status-line';
import { parseShare } from '@/features/outreach/views/campaigns/share-input';

describe('campaignStatusLine', () => {
  it('confirms each status change in plain words', () => {
    expect(campaignStatusLine('active')).toBe('Campaign is live');
    expect(campaignStatusLine('paused')).toBe('Campaign paused. Scheduled follow-ups wait until you resume.');
    expect(campaignStatusLine('finished')).toBe('Campaign finished');
  });
});

describe('parseShare', () => {
  it('returns null for a blank or non-numeric field so the caller does not write 0', () => {
    expect(parseShare('')).toBeNull();
    expect(parseShare('   ')).toBeNull();
    expect(parseShare('abc')).toBeNull();
  });

  it('clamps to a whole number from 0 to 100', () => {
    expect(parseShare('42')).toBe(42);
    expect(parseShare('150')).toBe(100);
    expect(parseShare('-3')).toBe(0);
    expect(parseShare('33.6')).toBe(34);
  });
});
