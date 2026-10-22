import { createIcon } from './icon-base';

/**
 * Activity glyph: a soft frame with a pulse line through it, everything
 * happening with a client. For the profile's Activity section.
 *
 * @example
 * ```tsx
 * <ActivityIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/activity
 */
export const ActivityIcon = createIcon(
  'ActivityIcon',
  'glyph',
  <>
    <rect x="3" y="4" width="18" height="16" rx="4" />
    <path d="M6.5 12H9l1.5-3 3 6 1.5-3h2.5" />
  </>,
);
