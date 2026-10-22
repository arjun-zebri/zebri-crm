import { createIcon } from './icon-base';

/**
 * File edit glyph: the Documents soft rect with a small pencil. For editing a file.
 *
 * @example
 * ```tsx
 * <FileEditIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/file-edit
 */
export const FileEditIcon = createIcon(
  'FileEditIcon',
  'glyph',
  <>
    <rect x="4.5" y="2.5" width="15" height="19" rx="4" />
    <path d="M8.5 16v-2l5-5a1.41 1.41 0 0 1 2 2l-5 5z" />
  </>,
);
