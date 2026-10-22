import { createIcon } from './icon-base';

/**
 * Minus glyph: the horizontal stroke of PlusIcon. For removing or reducing.
 *
 * @example
 * ```tsx
 * <MinusIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/minus
 */
export const MinusIcon = createIcon(
  'MinusIcon',
  'glyph',
  <>
    <path d="M5 12h14" />
  </>,
);
