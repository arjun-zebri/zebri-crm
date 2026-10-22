import { createIcon } from './icon-base';

/**
 * Move vertical glyph: a line with an arrowhead at each end, up and down. For
 * resizing or moving something up and down.
 *
 * @example
 * ```tsx
 * <MoveVerticalIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/move-vertical
 */
export const MoveVerticalIcon = createIcon(
  'MoveVerticalIcon',
  'glyph',
  <>
    <path d="M12 3v18M8.5 6.5 12 3l3.5 3.5M8.5 17.5 12 21l3.5-3.5" />
  </>,
);
