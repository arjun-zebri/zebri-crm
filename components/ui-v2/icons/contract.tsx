import { createIcon } from './icon-base';

/**
 * Contract glyph: a soft page with a title line, a signature squiggle and the line it sits on. For contracts.
 *
 * @example
 * ```tsx
 * <ContractIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/contract
 */
export const ContractIcon = createIcon(
  'ContractIcon',
  'glyph',
  <>
    <rect x="4.5" y="2.5" width="15" height="19" rx="4" />
    <path d="M8.5 7h7" />
    <path d="M8.5 15c1-2 2-2 2.5 0s1.5 2 2.5 0" />
    <path d="M8.5 18h7" />
  </>,
);
