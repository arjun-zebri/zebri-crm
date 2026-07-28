/**
 * Tests for the couple-profile tab-layout derive helpers.
 *
 * Covers ordering (configured order, drift in both directions) and visibility
 * (hidden tabs, the always-visible Overview guarantee).
 */
import { describe, expect, it } from 'vitest';

import {
  orderedTabKeys,
  visibleTabKeys,
} from '@/app/(dashboard)/couples/couple-profile-tabs';
import {
  DEFAULT_TABS_CONFIG,
  SECTION_KEYS,
  type CoupleProfileTabsConfig,
} from '@/app/(dashboard)/couples/couple-profile-types';

function config(
  overrides: Partial<CoupleProfileTabsConfig> = {},
): CoupleProfileTabsConfig {
  return { ...DEFAULT_TABS_CONFIG, ...overrides };
}

describe('orderedTabKeys', () => {
  it('returns the canonical order when no order is configured', () => {
    expect(orderedTabKeys(config())).toEqual([...SECTION_KEYS]);
  });

  it('respects the configured order and appends any missing keys', () => {
    const result = orderedTabKeys(config({ tab_order: ['emails', 'tasks'] }));
    expect(result.slice(0, 2)).toEqual(['emails', 'tasks']);
    // Every known key is still present exactly once.
    expect([...result].sort()).toEqual([...SECTION_KEYS].sort());
  });

  it('drops keys that are no longer part of the tab set', () => {
    const result = orderedTabKeys(
      config({ tab_order: ['ghost' as never, 'overview'] }),
    );
    expect(result).not.toContain('ghost');
    expect(result).toContain('overview');
  });
});

describe('visibleTabKeys', () => {
  it('omits hidden tabs', () => {
    const result = visibleTabKeys(config({ hidden_tabs: ['vows', 'songs'] }));
    expect(result).not.toContain('vows');
    expect(result).not.toContain('songs');
    expect(result).toContain('overview');
  });

  it('never hides Overview even if asked to', () => {
    expect(visibleTabKeys(config({ hidden_tabs: ['overview'] }))).toContain(
      'overview',
    );
  });
});
