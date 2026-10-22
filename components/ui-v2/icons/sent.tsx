import { createIcon } from './icon-base';

/**
 * Sent glyph: a soft paper plane heading up and right, its fold line
 * running in from the tail. The outer points are rounded (1.5 back from
 * each point along both edges, a quadratic through the point), computed
 * and rounded to 2 decimals, so it belongs with the soft pages. For the
 * Sent view on the Documents page.
 *
 * @example
 * ```tsx
 * <SentIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/sent
 */
export const SentIcon = createIcon(
  'SentIcon',
  'glyph',
  <>
    <path d="M19.11 4.07 4.89 9.93Q3.5 10.5 4.88 11.09L10.5 13.5l2.41 5.62Q13.5 20.5 14.07 19.11L19.93 4.89Q20.5 3.5 19.11 4.07z" />
    <path d="m10.5 13.5 7-7" />
  </>,
);
