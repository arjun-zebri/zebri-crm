import { createIcon } from './icon-base';

/**
 * Upload glyph: a soft cloud with an arrow rising into it. For uploading a
 * file.
 *
 * @example
 * ```tsx
 * <UploadIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/upload
 */
export const UploadIcon = createIcon(
  'UploadIcon',
  'glyph',
  <>
    <path d="M8.5 18h-1a4.5 4.5 0 0 1-1-8.5 5.5 5.5 0 0 1 11 0 4.5 4.5 0 0 1-1 8.5h-1" />
    <path d="M12 20v-8M9 15l3-3 3 3" />
  </>,
);
