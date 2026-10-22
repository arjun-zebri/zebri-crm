import { createIcon } from './icon-base';

/**
 * Header section glyph: a page with a band across its top holding a logo
 * dot and a name, the body's lines under it. For the document builder's
 * Header section, where the MC's logo goes.
 *
 * @example
 * ```tsx
 * <HeaderSectionIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/header-section
 */
export const HeaderSectionIcon = createIcon(
  'HeaderSectionIcon',
  'glyph',
  <>
    <rect x="3.5" y="3" width="17" height="18" rx="4" />
    <path d="M3.5 9.5h17" />
    <path d="M7.5 6.25h0M10.5 6.25h6" />
    <path d="M7.5 13.5h9M7.5 17h6" />
  </>,
);
