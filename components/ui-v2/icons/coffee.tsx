import { createIcon } from './icon-base';

/**
 * Coffee glyph: a soft mug with a round handle and three steam lines. For a break, a meeting or a cafe.
 *
 * @example
 * ```tsx
 * <CoffeeIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/coffee
 */
export const CoffeeIcon = createIcon(
  'CoffeeIcon',
  'glyph',
  <>
    <path d="M7.5 3.5V6M10.5 3.5V6M13.5 3.5V6" />
    <path d="M5 8.5h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
    <path d="M16 10.5h1a2.5 2.5 0 0 1 0 5h-1" />
  </>,
);
