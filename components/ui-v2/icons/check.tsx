import { createIcon } from './icon-base';

/**
 * Check glyph: a plain tick, the same weight and span as PlusIcon. For done,
 * selected and confirmed.
 *
 * @example
 * ```tsx
 * <CheckIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/check
 */
export const CheckIcon = createIcon(
  'CheckIcon',
  'glyph',
  <>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </>,
);
