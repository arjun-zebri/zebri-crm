import { createIcon } from './icon-base';

/**
 * Alert glyph: a round face with an exclamation mark. For warnings and
 * errors.
 *
 * @example
 * ```tsx
 * <AlertIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/alert
 */
export const AlertIcon = createIcon(
  'AlertIcon',
  'glyph',
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v4.5M12 16h0" />
  </>,
);
