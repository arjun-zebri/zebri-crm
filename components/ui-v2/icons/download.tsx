import { createIcon } from './icon-base';

/**
 * Download glyph: an arrow down into a soft tray. For downloading or exporting
 * a file.
 *
 * @example
 * ```tsx
 * <DownloadIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/download
 */
export const DownloadIcon = createIcon(
  'DownloadIcon',
  'glyph',
  <>
    <path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5" />
    <path d="M3.5 14.5v2a4 4 0 0 0 4 4h9a4 4 0 0 0 4-4v-2" />
  </>,
);
