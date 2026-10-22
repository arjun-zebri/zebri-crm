import { createIcon } from './icon-base';

/**
 * Video off glyph: the Video screen and triangle with a slash through, broken where it passes behind the triangle. For a camera or video that is off.
 *
 * @example
 * ```tsx
 * <VideoOffIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/video-off
 */
export const VideoOffIcon = createIcon(
  'VideoOffIcon',
  'glyph',
  <>
    <rect x="3" y="5" width="18" height="14" rx="4" />
    <path d="M10.5 9.5v5l4-2.5z" />
    <path d="M3.5 3.5l5.5 5.5M14.5 14.5l6 6" />
  </>,
);
