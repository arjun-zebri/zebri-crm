import { createIcon } from './icon-base';

/**
 * Settings glyph: a cog with six broad straight teeth and round tips
 * around a hub. The outline is computed (exact lines and arcs), so its
 * coordinates are off the half-unit grid by design. For Settings and
 * anything that opens a configuration.
 *
 * @example
 * ```tsx
 * <SettingsIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/settings
 */
export const SettingsIcon = createIcon(
  'SettingsIcon',
  'glyph',
  <>
    <path d="M10.1 5.26L10.1 4.15A1.9 1.9 0 0 1 13.9 4.15L13.9 5.26A7 7 0 0 1 16.88 6.99L17.85 6.43A1.9 1.9 0 0 1 19.75 9.72L18.78 10.28A7 7 0 0 1 18.78 13.72L19.75 14.28A1.9 1.9 0 0 1 17.85 17.57L16.88 17.01A7 7 0 0 1 13.9 18.74L13.9 19.85A1.9 1.9 0 0 1 10.1 19.85L10.1 18.74A7 7 0 0 1 7.12 17.01L6.15 17.57A1.9 1.9 0 0 1 4.25 14.28L5.22 13.72A7 7 0 0 1 5.22 10.28L4.25 9.72A1.9 1.9 0 0 1 6.15 6.43L7.12 6.99A7 7 0 0 1 10.1 5.26z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
