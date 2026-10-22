import { createIcon } from './icon-base';

/**
 * Play glyph: a soft-cornered play triangle. For playing media.
 *
 * @example
 * ```tsx
 * <PlayIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/play
 */
export const PlayIcon = createIcon(
  'PlayIcon',
  'glyph',
  <>
    <path d="M7 6v12q0 2 1.5 1l10-6.5q1.5-1 0-2L8.5 4Q7 3 7 6z" />
  </>,
);
