/**
 * Tests for the couple-profile tab-layout derive helpers.
 *
 * Covers ordering (configured order, drift in both directions), visibility
 * (hidden tabs, the always-visible Overview guarantee) and the migration of
 * layouts saved before Workflows absorbed the Tasks and Automations tabs.
 */
import { describe, expect, it } from 'vitest';

import {
  migrateHiddenTabKeys,
  migrateTabKeys,
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
    const result = orderedTabKeys(config({ tab_order: ['emails', 'workflow'] }));
    expect(result.slice(0, 2)).toEqual(['emails', 'workflow']);
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

describe('migrateTabKeys', () => {
  it('rewrites the retired Tasks key to Workflow in place', () => {
    expect(migrateTabKeys(['overview', 'tasks', 'payments'])).toEqual([
      'overview',
      'workflow',
      'payments',
    ]);
  });

  it('collapses Tasks and Automations onto a single Workflow entry', () => {
    // Both retired tabs map to the same replacement, so a layout holding
    // both must not produce a duplicate: the write schema rejects those.
    expect(migrateTabKeys(['tasks', 'time', 'automations'])).toEqual([
      'workflow',
      'time',
    ]);
  });

  it('keeps the first position when a duplicate collapses', () => {
    expect(migrateTabKeys(['automations', 'emails', 'tasks'])).toEqual([
      'workflow',
      'emails',
    ]);
  });

  it('drops keys that were never part of the tab set', () => {
    expect(migrateTabKeys(['ghost', 'overview'])).toEqual(['overview']);
  });
});

describe('migrateHiddenTabKeys', () => {
  it('hides Workflow only when both retired tabs were hidden', () => {
    expect(migrateHiddenTabKeys(['tasks', 'automations'])).toEqual(['workflow']);
  });

  it('leaves Workflow visible when only Automations was hidden', () => {
    // Turning off Automations was a statement about automations, not about
    // to-dos; carrying it over would bury the MC's task list.
    expect(migrateHiddenTabKeys(['automations', 'vows'])).toEqual(['vows']);
  });

  it('leaves Workflow visible when only Tasks was hidden', () => {
    expect(migrateHiddenTabKeys(['tasks'])).toEqual([]);
  });

  it('respects an explicitly hidden Workflow key', () => {
    expect(migrateHiddenTabKeys(['workflow'])).toEqual(['workflow']);
  });

  it('passes untouched keys straight through', () => {
    expect(migrateHiddenTabKeys(['songs', 'files'])).toEqual(['songs', 'files']);
  });
});
