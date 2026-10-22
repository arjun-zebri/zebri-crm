import { createIcon } from './icon-base';

/**
 * Image glyph: a soft frame with a sun dot over rolling hills. One picture; the single-image partner of Photos.
 *
 * @example
 * ```tsx
 * <ImageIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/image
 */
export const ImageIcon = createIcon(
  'ImageIcon',
  'glyph',
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="4" />
    <path d="M8.5 9h0" />
    <path d="M7 16.5l4-4 3 3 1-1 2 2" />
  </>,
);
