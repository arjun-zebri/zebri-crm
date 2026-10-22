import { createIcon } from './icon-base';

/**
 * Photos glyph: a soft frame with a sun dot over two hills. For a document's photo gallery.
 *
 * @example
 * ```tsx
 * <PhotosIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/photos
 */
export const PhotosIcon = createIcon(
  'PhotosIcon',
  'glyph',
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="4" />
    <path d="M15.5 9h0" />
    <path d="M7 16.5l3.5-3.5 3 3 1.5-1.5 2 2" />
  </>,
);
