import { createIcon } from './icon-base';

/**
 * Tablet glyph: a soft iPad, wider than the phone, with a dot at its foot. For the iPad preview.
 *
 * @example
 * ```tsx
 * <TabletIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/tablet
 */
export const TabletIcon = createIcon(
  'TabletIcon',
  'glyph',
  <>
    <rect x="3.5" y="2.5" width="17" height="19" rx="4" />
    <path d="M12 18h0" />
  </>,
);
