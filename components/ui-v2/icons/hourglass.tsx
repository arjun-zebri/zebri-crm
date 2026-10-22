import { createIcon } from './icon-base';

/**
 * Hourglass glyph: two soft bulbs meeting at a waist, capped top and bottom.
 * For waiting, pending and time running.
 *
 * @example
 * ```tsx
 * <HourglassIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/hourglass
 */
export const HourglassIcon = createIcon(
  'HourglassIcon',
  'glyph',
  <>
    <path d="M6 3.5h12M6 20.5h12" />
    <path d="M7.5 3.5V5c0 3 4.5 4 4.5 7s-4.5 4-4.5 7v1.5M16.5 3.5V5c0 3-4.5 4-4.5 7s4.5 4 4.5 7v1.5" />
  </>,
);
