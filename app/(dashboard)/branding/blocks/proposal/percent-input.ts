/**
 * Shared clamp for the 0-100 percentage inputs on proposal block controls
 * (hero/video overlay, section background overlay): a non-numeric or
 * out-of-range typed value is coerced to the nearest valid integer rather
 * than rejected, so the field never shows an invalid intermediate state.
 *
 * @module app/(dashboard)/branding/blocks/proposal/percent-input
 */
export function clampPercent(raw: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}
