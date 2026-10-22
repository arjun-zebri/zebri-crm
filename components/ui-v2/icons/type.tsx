import { createIcon } from './icon-base';

/**
 * Type glyph: a T with turned-down arms, for text or font.
 *
 * @example
 * ```tsx
 * <TypeIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/type
 */
export const TypeIcon = createIcon(
  'TypeIcon',
  'glyph',
  <>
    <path d="M5.5 7V6A1.5 1.5 0 0 1 7 4.5h10A1.5 1.5 0 0 1 18.5 6v1M12 4.5v15M9 19.5h6" />
  </>,
);
