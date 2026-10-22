import { createIcon } from './icon-base';

/**
 * Video glyph: a soft screen with a play triangle. For a video in a document.
 *
 * @example
 * ```tsx
 * <VideoIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/video
 */
export const VideoIcon = createIcon(
  'VideoIcon',
  'glyph',
  <>
    <rect x="3" y="5" width="18" height="14" rx="4" />
    <path d="M10.5 9.5v5l4-2.5z" />
  </>,
);
