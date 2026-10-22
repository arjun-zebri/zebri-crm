import { createIcon } from './icon-base';

/**
 * Music glyph: two round notes joined by a slanted beam. For music or audio.
 *
 * @example
 * ```tsx
 * <MusicIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/music
 */
export const MusicIcon = createIcon(
  'MusicIcon',
  'glyph',
  <>
    <circle cx="6.5" cy="17.5" r="2.5" />
    <circle cx="17.5" cy="15.5" r="2.5" />
    <path d="M9 17.5V6l11-2v11.5" />
  </>,
);
