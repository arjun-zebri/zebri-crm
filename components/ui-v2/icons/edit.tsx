import { createIcon } from './icon-base';

/**
 * Edit glyph: a soft pencil with a round end and a ferrule line. For editing.
 *
 * @example
 * ```tsx
 * <EditIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/edit
 */
export const EditIcon = createIcon(
  'EditIcon',
  'glyph',
  <>
    <path d="M4.5 19.5V15L14.5 5a3.18 3.18 0 0 1 4.5 4.5L9 19.5z" />
    <path d="M12.5 7l4.5 4.5" />
  </>,
);
