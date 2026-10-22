import { createIcon } from './icon-base';

/**
 * Mic off glyph: the Mic capsule, stand and base with a slash through. For muted voice input.
 *
 * @example
 * ```tsx
 * <MicOffIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/mic-off
 */
export const MicOffIcon = createIcon(
  'MicOffIcon',
  'glyph',
  <>
    <rect x="8.5" y="4" width="7" height="11" rx="3.5" />
    <path d="M12 15v5M8.5 20h7" />
    <path d="M4.5 4.5l15 15" />
  </>,
);
