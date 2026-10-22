import { describe, expect, it } from 'vitest';

import { RETENTION_MONTHS, retentionCutoff } from '@/lib/outreach/services/retention';

describe('retentionCutoff', () => {
  it('is the window before now, in whole months', () => {
    expect(RETENTION_MONTHS).toBe(12);
    expect(retentionCutoff(new Date('2026-10-13T10:00:00Z')).toISOString()).toBe('2025-10-13T10:00:00.000Z');
  });

  it('is not moved by the local timezone', () => {
    expect(retentionCutoff(new Date('2026-03-01T00:30:00Z')).toISOString()).toBe('2025-03-01T00:30:00.000Z');
  });
});
