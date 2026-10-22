import { createIcon } from './icon-base';

/**
 * Clock glyph: a round face with two hands. For when something happens.
 *
 * @example
 * ```tsx
 * <ClockIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/clock
 */
export const ClockIcon = createIcon(
  'ClockIcon',
  'glyph',
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
