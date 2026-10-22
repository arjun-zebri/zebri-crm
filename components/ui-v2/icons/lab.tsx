import { createIcon } from './icon-base';

/**
 * Lab glyph: a conical flask with a lip and a liquid line. For experiments, tests or beta features. Bottom corners are softened with short quadratic curves (2 decimals).
 *
 * @example
 * ```tsx
 * <LabIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/lab
 */
export const LabIcon = createIcon(
  'LabIcon',
  'glyph',
  <>
    <path d="M8.5 3.5h7" />
    <path d="M10 3.5V10l-5.4 9Q4 20 5.17 20h13.66Q20 20 19.4 19L14 10V3.5" />
    <path d="M7 15h10" />
  </>,
);
