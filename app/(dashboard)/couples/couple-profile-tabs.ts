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
  LEGACY_SECTION_KEYS,
  SECTION_KEYS,
  type CoupleProfileSection,
  type CoupleProfileTabsConfig,
} from './couple-profile-types';

const VALID_KEYS = new Set<string>(SECTION_KEYS);

/**
 * Normalise a stored list of tab keys: rewrite retired keys to their
 * replacement, drop anything unrecognised, and de-duplicate while keeping
 * the first occurrence's position.
 *
 * De-duplication matters because two retired keys can collapse onto one
 * replacement (Tasks and Automations both became Workflow). Leaving the
 * duplicate in `tab_order` would trip the write schema's uniqueness check
 * the next time the MC saved their layout.
 */
export function migrateTabKeys(keys: readonly string[]): CoupleProfileSection[] {
  const out: CoupleProfileSection[] = [];
  const seen = new Set<CoupleProfileSection>();
  for (const raw of keys) {
    const key = LEGACY_SECTION_KEYS[raw] ?? raw;
    if (!VALID_KEYS.has(key)) continue;
    const valid = key as CoupleProfileSection;
    if (seen.has(valid)) continue;
    seen.add(valid);
    out.push(valid);
  }
  return out;
}

/**
 * Same rewrite as {@link migrateTabKeys}, but a replacement tab only stays
 * hidden when *every* retired key it absorbed was hidden.
 *
 * Hiding Automations was a statement about automations, not about to-dos.
 * Carrying that hide straight over would bury the Workflow tab for an MC who
 * still wanted their task list, so the merged tab only disappears when the MC
 * had turned off both halves of it.
 */
export function migrateHiddenTabKeys(
  keys: readonly string[],
): CoupleProfileSection[] {
  const absorbed = new Map<CoupleProfileSection, Set<string>>();
  for (const [legacy, replacement] of Object.entries(LEGACY_SECTION_KEYS)) {
    const set = absorbed.get(replacement) ?? new Set<string>();
    set.add(legacy);
    absorbed.set(replacement, set);
  }

  const hidden = new Set(keys);
  return migrateTabKeys(keys).filter((key) => {
    const legacyKeys = absorbed.get(key);
    if (!legacyKeys || hidden.has(key)) return true;
    return [...legacyKeys].every((legacy) => hidden.has(legacy));
  });
}

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
