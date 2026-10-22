import { createIcon } from './icon-base';

/**
 * Max plan glyph: a crown on a base line, the top plan. For a perk or
 * feature that comes with Max.
 *
 * @example
 * ```tsx
 * <MaxPlanIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/max-plan
 */
export const MaxPlanIcon = createIcon(
  'MaxPlanIcon',
  'glyph',
  <>
    <path d="M4.5 16 3.5 7.5 8 11l4-6.5 4 6.5 4.5-3.5-1 8.5z" />
    <path d="M5.5 19.5h13" />
  </>,
);
