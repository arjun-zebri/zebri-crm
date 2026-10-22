import { createIcon } from './icon-base';

/**
 * Ceremony script glyph: a soft page with a title line over two
 * interlocked rings. For the ceremony script document and anything
 * that opens one.
 *
 * @example
 * ```tsx
 * <CeremonyScriptIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/ceremony-script
 */
export const CeremonyScriptIcon = createIcon(
  'CeremonyScriptIcon',
  'glyph',
  <>
    <rect x="4.5" y="2.5" width="15" height="19" rx="4" />
    <path d="M8.5 7h7" />
    <circle cx="10" cy="14.5" r="2.75" />
    <circle cx="14" cy="14.5" r="2.75" />
  </>,
);
