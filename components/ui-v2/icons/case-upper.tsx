import { createIcon } from './icon-base';

/**
 * Case Upper glyph: two capital As (AA). For upper case.
 *
 * @example
 * ```tsx
 * <CaseUpperIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/case-upper
 */
export const CaseUpperIcon = createIcon(
  'CaseUpperIcon',
  'glyph',
  <>
    <path d="M3 17.5 6.5 6.5l3.5 11M4.5 13.5h4" />
    <path d="M14 17.5l3.5-11 3.5 11M15.5 13.5h4" />
  </>,
);
