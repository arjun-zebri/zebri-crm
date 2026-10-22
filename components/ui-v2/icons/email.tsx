import { createIcon } from './icon-base';

/**
 * Email glyph: a soft envelope with a flap running corner to corner. For email steps and anything sent as an email.
 *
 * @example
 * ```tsx
 * <EmailIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/email
 */
export const EmailIcon = createIcon(
  'EmailIcon',
  'glyph',
  <>
    <rect x="3" y="5" width="18" height="14" rx="4" />
    <path d="m4.5 8.5 7.5 5 7.5-5" />
  </>,
);
