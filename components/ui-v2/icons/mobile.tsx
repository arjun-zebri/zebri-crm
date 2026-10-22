import { createIcon } from './icon-base';

/**
 * Mobile glyph: a tall soft phone with a dot at its foot. For the mobile preview.
 *
 * @example
 * ```tsx
 * <MobileIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/mobile
 */
export const MobileIcon = createIcon(
  'MobileIcon',
  'glyph',
  <>
    <rect x="6" y="2.5" width="12" height="19" rx="4" />
    <path d="M12 18h0" />
  </>,
);
