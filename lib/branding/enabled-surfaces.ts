/**
 * Enabled-surfaces resolution for the branding editor.
 *
 * `user_branding.enabled_surfaces` has held three shapes over time:
 *
 * 1. A jsonb array of surface names (the column default set by the
 *    migrations, e.g. `["invoice", "contract", ...]`).
 * 2. A map with only `true` keys (legacy app saves; disabled surfaces
 *    were simply absent).
 * 3. A map with an explicit boolean for every surface (current saves,
 *    written by {@link buildEnabledSurfacesMap}).
 *
 * Shapes 1 and 2 predate the `lead` and `proposal` surfaces, so neither
 * can record a deliberate "off" choice for them. {@link resolveEnabledSurfaces}
 * therefore treats a missing `lead` or `proposal` entry as enabled, while a
 * missing entry for any older surface keeps meaning disabled (that was the
 * only way shape 2 recorded a disable).
 */

import type { SurfaceTab } from '@/types/branding-preview'

/** Every branding surface, in canonical display order. */
export const ALL_SURFACE_TABS: SurfaceTab[] = [
  'invoice',
  'contract',
  'portal',
  'vendorTimeline',
  'questionnaire',
  'lead',
  'proposal',
]

/**
 * Surfaces that predate a saved shape and so must default to enabled when
 * absent from it, rather than the older "missing means disabled" rule.
 */
const DEFAULT_ON_WHEN_MISSING: ReadonlySet<SurfaceTab> = new Set(['lead', 'proposal'])

/**
 * Resolve a stored `enabled_surfaces` value into the list of enabled
 * surface tabs, in canonical order.
 *
 * Accepts any of the historical shapes (see module doc). Any surface name
 * in the stored value that isn't a current `SurfaceTab` is ignored. `null` /
 * `undefined` (no row yet) enables everything.
 */
export function resolveEnabledSurfaces(saved: unknown): SurfaceTab[] {
  if (saved == null) return [...ALL_SURFACE_TABS]

  if (Array.isArray(saved)) {
    // Array shape predates lead/proposal and can only list enabled surfaces,
    // so a missing entry for either is "never seen", not "turned off".
    return ALL_SURFACE_TABS.filter(
      (tab) => DEFAULT_ON_WHEN_MISSING.has(tab) || saved.includes(tab),
    )
  }

  if (typeof saved === 'object') {
    const map = saved as Record<string, unknown>
    return ALL_SURFACE_TABS.filter((tab) =>
      DEFAULT_ON_WHEN_MISSING.has(tab) ? map[tab] !== false : map[tab] === true,
    )
  }

  return [...ALL_SURFACE_TABS]
}

/**
 * Build the `enabled_surfaces` map to persist from the editor's enabled
 * list. Every surface gets an explicit boolean so a deliberate disable
 * survives {@link resolveEnabledSurfaces}'s missing-key defaulting.
 */
export function buildEnabledSurfacesMap(
  enabled: SurfaceTab[],
): Record<SurfaceTab, boolean> {
  return Object.fromEntries(
    ALL_SURFACE_TABS.map((tab) => [tab, enabled.includes(tab)]),
  ) as Record<SurfaceTab, boolean>
}
