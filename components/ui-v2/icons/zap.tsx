import { createIcon } from './icon-base';

/**
 * Zap glyph: a lightning bolt. For automations, quick actions and
 * instant.
 *
 * @example
 * ```tsx
 * <ZapIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/zap
 */
export const ZapIcon = createIcon(
  'ZapIcon',
  'glyph',
  <>
    <path d="M13 3 5 13.5h6.5L11 21l8-10.5h-6.5z" />
  </>,
);
