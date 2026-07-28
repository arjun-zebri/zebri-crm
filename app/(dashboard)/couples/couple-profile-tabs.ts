/**
 * Pure derive helpers for the couple-profile tab layout.
 *
 * Turn a stored {@link CoupleProfileTabsConfig} into the effective tab order
 * and visibility, tolerating drift in both directions:
 * - stored keys that no longer exist (a tab was removed) are dropped;
 * - master keys missing from the stored order (a tab was added) are appended.
 *
 * Kept React-free so it can be unit-tested directly and reused by both the
 * client modal and the server action's normalisation.
 *
 * @module app/(dashboard)/couples/couple-profile-tabs
 */
import {
  SECTION_KEYS,
  type CoupleProfileSection,
  type CoupleProfileTabsConfig,
} from './couple-profile-types';

/**
 * The full set of tab keys in the user's configured order. Unknown keys are
 * dropped; any known key absent from `tab_order` is appended in canonical
 * order, so the result always contains exactly the current tab set.
 */
export function orderedTabKeys(
  config: CoupleProfileTabsConfig,
): CoupleProfileSection[] {
  const valid = new Set<CoupleProfileSection>(SECTION_KEYS);
  const ordered = config.tab_order.filter((key) => valid.has(key));
  const seen = new Set(ordered);
  for (const key of SECTION_KEYS) {
    if (!seen.has(key)) ordered.push(key);
  }
  return ordered;
}

/**
 * Configured order minus hidden tabs. `'overview'` can never be hidden (it is
 * the guaranteed-visible fallback), so it is always present in the result.
 */
export function visibleTabKeys(
  config: CoupleProfileTabsConfig,
): CoupleProfileSection[] {
  const hidden = new Set<CoupleProfileSection>(
    config.hidden_tabs.filter((key) => key !== 'overview'),
  );
  return orderedTabKeys(config).filter((key) => !hidden.has(key));
}
