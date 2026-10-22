import { createIcon } from './icon-base';

/**
 * Undo glyph: an arrow turning back to the left over a soft hook. For undo.
 *
 * @example
 * ```tsx
 * <UndoIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/undo
 */
export const UndoIcon = createIcon(
  'UndoIcon',
  'glyph',
  <>
    <path d="M8.5 4.5 4 9l4.5 4.5" />
    <path d="M4 9h10a5 5 0 0 1 0 10h-3.5" />
  </>,
);
