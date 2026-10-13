/**
 * One-line summary of a sequence's steps, for the list view.
 *
 * @module features/outreach/views/sequences/sequence-summary
 */

/**
 * One-line description of a sequence, e.g.
 * "Email, then IG after 3 days, then Email after 4 days".
 */
export function summarizeSteps(steps: { channel: string; delay_days: number }[]): string {
  return steps
    .map((s, i) => {
      const name = s.channel === 'email' ? 'Email' : 'Instagram';
      if (i === 0) return s.delay_days > 0 ? `${name} after ${dayCount(s.delay_days)}` : name;
      if (s.delay_days === 0) return `${name} the same day`;
      return `${name} after ${dayCount(s.delay_days)}`;
    })
    .join(', then ');
}

function dayCount(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}
