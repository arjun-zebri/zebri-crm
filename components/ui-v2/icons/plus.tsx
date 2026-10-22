import { createIcon } from './icon-base';

/**
 * Plus glyph: a long plain plus. For adding something.
 *
 * @example
 * ```tsx
 * <PlusIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/plus
 */
export const PlusIcon = createIcon(
  'PlusIcon',
  'glyph',
  <>
    <path d="M12 5v14M5 12h14" />
  </>,
);
