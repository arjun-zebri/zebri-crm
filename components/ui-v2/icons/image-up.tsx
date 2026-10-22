import { createIcon } from './icon-base';

/**
 * Image up glyph: the Image frame opened at its top-right corner for an up arrow. For uploading an image.
 *
 * @example
 * ```tsx
 * <ImageUpIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/image-up
 */
export const ImageUpIcon = createIcon(
  'ImageUpIcon',
  'glyph',
  <>
    <path d="M13.5 5.5H7a4 4 0 0 0-4 4v7a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V10" />
    <path d="M8.5 10h0" />
    <path d="M7 17l3.5-3.5 2.5 2.5 1-1 1.5 1.5" />
    <path d="M19 7.5v-5M16.5 5 19 2.5 21.5 5" />
  </>,
);
