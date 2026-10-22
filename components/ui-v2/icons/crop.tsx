import { createIcon } from './icon-base';

/**
 * Crop glyph: two soft corner brackets crossing, the classic crop marks. For cropping an image.
 *
 * @example
 * ```tsx
 * <CropIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/crop
 */
export const CropIcon = createIcon(
  'CropIcon',
  'glyph',
  <>
    <path d="M6.5 2.5v11a4 4 0 0 0 4 4h11" />
    <path d="M17.5 21.5v-11a4 4 0 0 0-4-4h-11" />
  </>,
);
