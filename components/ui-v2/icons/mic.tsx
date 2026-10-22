import { createIcon } from './icon-base';

/**
 * Mic glyph: a soft capsule on a stand and base. For voice input.
 *
 * @example
 * ```tsx
 * <MicIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/mic
 */
export const MicIcon = createIcon(
  'MicIcon',
  'glyph',
  <>
    <rect x="8.5" y="4" width="7" height="11" rx="3.5" />
    <path d="M12 15v5M8.5 20h7" />
  </>,
);
