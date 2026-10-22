import { createIcon } from './icon-base';

/**
 * Desktop glyph: a soft screen on a short stand and base. For the desktop preview.
 *
 * @example
 * ```tsx
 * <DesktopIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/desktop
 */
export const DesktopIcon = createIcon(
  'DesktopIcon',
  'glyph',
  <>
    <rect x="2.5" y="3.5" width="19" height="13" rx="4" />
    <path d="M12 16.5v4M8 20.5h8" />
  </>,
);
