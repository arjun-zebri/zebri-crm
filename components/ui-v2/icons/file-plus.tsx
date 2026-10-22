import { createIcon } from './icon-base';

/**
 * File plus glyph: the Documents soft rect with a plus. For adding or creating a file.
 *
 * @example
 * ```tsx
 * <FilePlusIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/file-plus
 */
export const FilePlusIcon = createIcon(
  'FilePlusIcon',
  'glyph',
  <>
    <rect x="4.5" y="2.5" width="15" height="19" rx="4" />
    <path d="M12 9v6M9 12h6" />
  </>,
);
