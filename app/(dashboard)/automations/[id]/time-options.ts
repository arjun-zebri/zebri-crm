/**
 * Time-of-day choices, shared by every builder surface that picks one.
 *
 * The stored value is always 24-hour `HH:MM` — that is what the
 * handlers write into `timeline_items.start_time` and what the
 * quiet-hours columns hold. Only the label is 12-hour, because that
 * is how an MC says it out loud.
 *
 * Two surfaces render these: the extended forms' `TimeField`, which
 * can use the design-system `Select`, and the chip popovers, which
 * cannot — a nested Radix portal registers as an outside interaction
 * and dismisses the popover, so those render the same options as
 * `MenuItem` rows. Sharing the list here is what keeps the two from
 * drifting.
 *
 * @module app/(dashboard)/automations/[id]/time-options
 */

/** `15:30` → `3:30 pm`. Falls back to the raw value if unparseable. */
export function formatTimeLabel(value: string): string {
  const [rawHour, rawMinute] = value.split(':')
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value
  const period = hour < 12 ? 'am' : 'pm'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`
}

/**
 * Every half hour of the day.
 *
 * @param current - A value to guarantee is present. A time saved
 *   through the old free-form input ("14:45") is not on the half
 *   hour, and dropping it would silently rewrite the step the first
 *   time its picker was opened.
 */
export function timeOptions(current?: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      options.push({ value, label: formatTimeLabel(value) })
    }
  }
  if (current && !options.some((o) => o.value === current)) {
    options.push({ value: current, label: formatTimeLabel(current) })
  }
  return options
}
