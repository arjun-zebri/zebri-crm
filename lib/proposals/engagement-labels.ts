/**
 * MC-facing copy for engagement data: proposal block types, accept steps,
 * and durations.
 *
 * @module lib/proposals/engagement-labels
 */

// The ten proposal block types (see
// `app/(dashboard)/branding/blocks/types.ts`). A type outside this set
// (future block, or bad data) falls through to the capitalised fallback
// below rather than throwing. Labels mirror BLOCK_LABELS in that file
// (e.g. `introNote` reads as "Personal note" there) rather than
// reinventing MC-facing copy: two names for one block on the same
// dashboard is the drift the design system exists to prevent. Exported
// (rather than kept private) so a unit test (m4) can diff this literally
// against `BLOCK_LABELS` restricted to the proposal surface, so a rename
// in the block editor fails the build instead of silently drifting here.
export const BLOCK_TYPE_LABELS: Record<string, string> = {
  hero: 'Hero',
  introNote: 'Personal note',
  video: 'Video',
  gallery: 'Gallery',
  testimonials: 'Testimonials',
  aboutMe: 'About me',
  howItWorks: 'How it works',
  faq: 'FAQ',
  packages: 'Packages',
  accept: 'Accept',
}

const STEP_LABELS: Record<string, string> = {
  choose: 'Chose a package',
  sign: 'Signed',
  pay: 'Payment',
  done: 'Done',
}

const capitalize = (s: string) => (s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** MC-facing label for a proposal block type, e.g. `howItWorks` -> `How it works`. */
export function blockTypeLabel(type: string): string {
  return BLOCK_TYPE_LABELS[type] ?? capitalize(type)
}

/** MC-facing label for an accept-stepper step, e.g. `sign` -> `Signed`. */
export function stepLabel(step: string): string {
  return STEP_LABELS[step] ?? capitalize(step)
}

/**
 * Formats a duration in seconds as MC-facing copy: seconds under a minute,
 * minutes and seconds under an hour, otherwise hours and minutes.
 */
export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}
