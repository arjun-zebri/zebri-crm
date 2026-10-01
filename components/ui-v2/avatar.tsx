/**
 * Design system v2 avatar (preview): a person's initials in a circle,
 * for lists of people (a message row, the signed-in user in the rail).
 * Initials only for now; photos come with the real app data.
 *
 * @example
 * ```tsx
 * <Avatar name="Sarah Bennett" />
 * <Avatar name="Hannah Lee" tone="muted" />
 * <Avatar name="Amelia" tone="soft" />
 * <Avatar name="Jack" tone="shade" />
 * ```
 *
 * @module components/ui-v2/avatar
 */

/**
 * Fill. `'ink'` for the first or most important person, `'muted'` for
 * the rest, `'soft'` for a pair or a long list where dark circles on
 * every row would be the loudest thing on the page (a couple on the
 * Clients list). `'shade'` is one step deeper than soft, for the partner
 * tucked behind in a pair, so the two read as one stacked couple rather
 * than two separate letters.
 */
export type AvatarTone = 'ink' | 'muted' | 'soft' | 'shade';

export interface AvatarProps {
  /** Full name. The first letters of the first and last words are shown. */
  name: string;
  tone?: AvatarTone | undefined;
  className?: string | undefined;
}

const TONES: Record<AvatarTone, string> = {
  ink: 'bg-zebra-950 text-zebra-50',
  muted: 'bg-zebra-500 text-zebra-50',
  soft: 'bg-zebra-100 text-zebra-700',
  shade: 'bg-zebra-200 text-zebra-700',
};

/** "Sarah Bennett" to "SB"; a single word gives one letter. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** v2 avatar. See {@link AvatarProps}. */
export function Avatar({ name, tone = 'ink', className }: AvatarProps) {
  return (
    // The name is nearly always printed beside the avatar, so the
    // initials are decorative; a lone avatar should carry its own label.
    <span
      aria-hidden="true"
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-pill type-label ${TONES[tone]}${className ? ` ${className}` : ''}`}
    >
      {initials(name)}
    </span>
  );
}
