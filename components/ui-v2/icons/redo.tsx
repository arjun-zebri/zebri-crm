import { createIcon } from './icon-base';

/**
 * Redo glyph: the UndoIcon mirrored, turning forward to the right. For redo.
 *
 * @example
 * ```tsx
 * <RedoIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/redo
 */
export const RedoIcon = createIcon(
  'RedoIcon',
  'glyph',
  <>
    <path d="M15.5 4.5 20 9l-4.5 4.5" />
    <path d="M20 9H10a5 5 0 0 0 0 10h3.5" />
  </>,
);
