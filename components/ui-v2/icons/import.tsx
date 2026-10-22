import { createIcon } from './icon-base';

/**
 * Import glyph: an arrow down into an open soft box. For importing data.
 *
 * @example
 * ```tsx
 * <ImportIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/import
 */
export const ImportIcon = createIcon(
  'ImportIcon',
  'glyph',
  <>
    <path d="M12 3.5v11M8.5 11l3.5 3.5 3.5-3.5" />
    <path d="M8.5 6.5h-1a4 4 0 0 0-4 4v6a4 4 0 0 0 4 4h9a4 4 0 0 0 4-4v-6a4 4 0 0 0-4-4h-1" />
  </>,
);
