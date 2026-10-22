import { createIcon } from './icon-base';

/**
 * Send To Back glyph: two whole squares with a half-hidden one behind them. For send to back.
 *
 * @example
 * ```tsx
 * <SendToBackIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/send-to-back
 */
export const SendToBackIcon = createIcon(
  'SendToBackIcon',
  'glyph',
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    <path d="M12.5 8.5h1a2 2 0 0 1 2 2v1M8.5 12.5v1a2 2 0 0 0 2 2h1" />
  </>,
);
