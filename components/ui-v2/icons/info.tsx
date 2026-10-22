import { createIcon } from './icon-base';

/**
 * Info glyph: an "i" in a circle, drawn like `CircleCheckIcon`. For a
 * field's note kept behind a tooltip (a ledger row's `help`).
 *
 * @example
 * ```tsx
 * <InfoIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/info
 */
export const InfoIcon = createIcon(
  'InfoIcon',
  'glyph',
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h0" />
  </>,
);
