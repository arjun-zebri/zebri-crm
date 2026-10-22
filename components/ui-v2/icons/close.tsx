import { createIcon } from './icon-base';

/**
 * Close glyph: a plain cross. For closing a dialog and removing an item.
 *
 * @example
 * ```tsx
 * <CloseIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/close
 */
export const CloseIcon = createIcon(
  'CloseIcon',
  'glyph',
  <>
    <path d="M7 7l10 10M17 7 7 17" />
  </>,
);
