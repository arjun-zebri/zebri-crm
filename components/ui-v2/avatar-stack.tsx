import { Avatar, type AvatarTone } from './avatar';

/**
 * Design system v2 avatar stack (preview): a few people's faces
 * overlapping in a row, with a count bubble for the rest ("+23"). For
 * "these people are already here": the marketing hero's founding list,
 * or who is on a shared document.
 *
 * Each face gets a ring in the page's colour so the overlaps read as
 * separate circles. Decorative, like `Avatar`: say who and how many in
 * the text beside it, or pass `label` when nothing does.
 *
 * @example
 * ```tsx
 * <AvatarStack people={[{ name: 'Jess Taylor', src: '/founding/jess.jpg' }, { name: 'Sam Lee' }]} more={23} />
 * ```
 *
 * @module components/ui-v2/avatar-stack
 */

/** One face in the stack. */
export interface StackPerson {
  name: string;
  /** Their photo; initials show without one. */
  src?: string | undefined;
}

export interface AvatarStackProps {
  people: readonly StackPerson[];
  /** How many more there are, shown as "+N" in the last circle. Left out at 0. */
  more?: number | undefined;
  /** Fill for faces without a photo. Defaults to `'soft'`, so a row of letters stays quiet. */
  tone?: AvatarTone | undefined;
  /** An accessible name for the whole stack, when no text beside it says who. */
  label?: string | undefined;
}

/** v2 avatar stack. See {@link AvatarStackProps}. */
export function AvatarStack({ people, more = 0, tone = 'soft', label }: AvatarStackProps) {
  return (
    <span
      className="flex -space-x-2"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {people.map((p) => (
        // First name only: two-letter initials are clipped by the next circle's overlap.
        <Avatar key={p.name} name={p.name.split(' ')[0] ?? p.name} src={p.src} tone={tone} className="ring-2 ring-field" />
      ))}
      {more > 0 ? (
        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-pill bg-zebra-950 pl-3 pr-2.5 type-label text-zebra-50 ring-2 ring-field">
          +{more}
        </span>
      ) : null}
    </span>
  );
}
