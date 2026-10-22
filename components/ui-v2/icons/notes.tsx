import { createIcon } from './icon-base';

/**
 * Notes glyph: a pencil writing on a line: the MC's own notes. For the Notes on a client's Overview.
 *
 * @example
 * ```tsx
 * <NotesIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/notes
 */
export const NotesIcon = createIcon(
  'NotesIcon',
  'glyph',
  <>
    <path d="M14.5 4.5 19 9l-9 9H5.5v-4.5z" />
    <path d="M12.5 6.5 17 11" />
    <path d="M13 20.5h7.5" />
  </>,
);
