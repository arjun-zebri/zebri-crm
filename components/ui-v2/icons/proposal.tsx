import { createIcon } from './icon-base';

/**
 * Proposal glyph: a soft page with a title over two package options,
 * the proposal a couple picks from. For Proposals and anything that
 * sends one.
 *
 * @example
 * ```tsx
 * <ProposalIcon className="size-4" />
 * ```
 *
 * @module components/ui-v2/icons/proposal
 */
export const ProposalIcon = createIcon(
  'ProposalIcon',
  'glyph',
  <>
    <rect x="4.5" y="2.5" width="15" height="19" rx="4" />
    <path d="M8.5 7h7" />
    <rect x="8.5" y="10.5" width="7" height="3" rx="1" />
    <rect x="8.5" y="15.5" width="7" height="3" rx="1" />
  </>,
);
