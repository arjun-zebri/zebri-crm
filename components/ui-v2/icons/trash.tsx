import { createIcon } from './icon-base';

/**
 * Trash glyph: a soft bin with a lid, an arched handle and two ribs. For
 * deleting.
 *
 * @example
 * ```tsx
 * <TrashIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/trash
 */
export const TrashIcon = createIcon(
  'TrashIcon',
  'glyph',
  <>
    <path d="M3.5 6h17M9 6a3 3 0 0 1 6 0" />
    <path d="M5.5 6v11a4 4 0 0 0 4 4h5a4 4 0 0 0 4-4V6" />
    <path d="M10 10.5v6M14 10.5v6" />
  </>,
);
