import { createIcon } from './icon-base';

/**
 * Gallery glyph: a soft card in front with the edges of its neighbours at either side. For a horizontal gallery or carousel.
 *
 * @example
 * ```tsx
 * <GalleryIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/gallery
 */
export const GalleryIcon = createIcon(
  'GalleryIcon',
  'glyph',
  <>
    <rect x="7" y="3.5" width="10" height="17" rx="3" />
    <path d="M3.5 6v12M20.5 6v12" />
  </>,
);
