import { createIcon } from './icon-base';

/**
 * Play circle glyph: a ring with the Video play triangle inside. For a play button over media.
 *
 * @example
 * ```tsx
 * <PlayCircleIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/play-circle
 */
export const PlayCircleIcon = createIcon(
  'PlayCircleIcon',
  'glyph',
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M10.5 9.5v5l4-2.5z" />
  </>,
);
