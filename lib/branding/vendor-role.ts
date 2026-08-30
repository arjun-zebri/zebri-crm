/**
 * Resolves the noun a user's clients should see them called by ("MC", "DJ",
 * "Celebrant") everywhere a document or public surface would otherwise
 * hard-code "MC".
 *
 * Background: Settings has offered a `business_type` multi-select (MC /
 * Celebrant / DJ) since the beginning, but nothing in the app ever read it.
 * Meanwhile "MC" was baked into the seeded contract template, the public
 * signing page and the client portal. A DJ signing up therefore had no way to
 * stop the product calling them an MC, which is what prompted this module.
 *
 * Resolution order:
 *  1. `vendor_role`: the free-text override, for anyone whose title is not one
 *     of the three presets ("Celebrant & MC", "Host", a trading style).
 *  2. `business_type`: the existing multi-select, joined for multi-select
 *     users ("MC & DJ").
 *  3. {@link DEFAULT_VENDOR_ROLE}: a neutral fallback, never "MC".
 *
 * @module lib/branding/vendor-role
 */

/** Shown when the user has set neither an override nor a business type. */
export const DEFAULT_VENDOR_ROLE = 'supplier'

/** The presets offered by the Settings multi-select, in display order. */
export const VENDOR_ROLE_PRESETS = [
  { value: 'mc', label: 'MC' },
  { value: 'celebrant', label: 'Celebrant' },
  { value: 'dj', label: 'DJ' },
] as const

const PRESET_LABELS = new Map<string, string>(
  VENDOR_ROLE_PRESETS.map((p) => [p.value, p.label]),
)

/** Longest role we will render inline in a sentence. */
const MAX_ROLE_LENGTH = 40

/**
 * Normalise the `business_type` metadata value, which is stored as an array
 * but was a bare string before the multi-select landed.
 *
 * @param value - Raw `business_type` from user metadata.
 * @returns The selected preset values, unknown entries dropped.
 */
export function parseBusinessTypes(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  return raw.filter((v): v is string => typeof v === 'string' && PRESET_LABELS.has(v))
}

/**
 * Derive the role label implied by the `business_type` selection alone,
 * ignoring any override. Used as the placeholder in Settings so the user can
 * see what they will get before typing anything.
 *
 * @param metadata - The user's metadata object.
 * @returns e.g. "MC", "MC & DJ", or {@link DEFAULT_VENDOR_ROLE}.
 */
export function derivedVendorRole(metadata: Record<string, unknown>): string {
  const labels = parseBusinessTypes(metadata.business_type).map(
    (v) => PRESET_LABELS.get(v) as string,
  )
  if (labels.length === 0) return DEFAULT_VENDOR_ROLE
  if (labels.length === 1) return labels[0] as string
  // "MC, Celebrant & DJ" reads better than a comma-only list.
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1] as string}`
}

/**
 * Resolve the role label to show clients.
 *
 * @param metadata - The user's metadata object (`user_metadata`).
 * @returns The override if set, else the derived label, else the default.
 */
export function resolveVendorRole(metadata: Record<string, unknown> | null | undefined): string {
  const override = typeof metadata?.vendor_role === 'string' ? metadata.vendor_role.trim() : ''
  if (override) return override.slice(0, MAX_ROLE_LENGTH)
  return derivedVendorRole(metadata ?? {})
}
