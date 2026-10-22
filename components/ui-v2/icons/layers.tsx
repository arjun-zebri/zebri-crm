import { createIcon } from './icon-base';

/**
 * Layers glyph: a diamond with two layers under it. For layers.
 *
 * @example
 * ```tsx
 * <LayersIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/layers
 */
export const LayersIcon = createIcon(
  'LayersIcon',
  'glyph',
  <>
    <path d="M12 3.5 20.5 8 12 12.5 3.5 8z" />
    <path d="M3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5" />
  </>,
);
