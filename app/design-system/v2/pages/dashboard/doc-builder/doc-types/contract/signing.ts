import { doc, paragraph, text, type RichDoc } from '@/features/proposals';

import type { DocLayout, DocSection, SignatureLayout, SignaturesData, SignatureWho } from '../../model/types';

/**
 * A contract's signing block, read: who signs, how the places sit, the
 * label over each, and which lines show under it (`SignaturesData`), with
 * Zebri's defaults filled in; and from a whole contract whether the MC
 * signs it, which the send flow follows (no signature asked of an MC
 * whose contract has the couple sign alone). Plain functions, for the
 * page, the bar and the account alike.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/contract/signing
 */

/** A signing block with every choice made. */
export interface Signing {
  who: SignatureWho;
  layout: SignatureLayout;
  yourLabel: RichDoc;
  clientLabel: RichDoc;
  name: boolean;
  date: boolean;
}

/** A one-line label. */
const label = (words: string) => doc(paragraph(text(words)));

/** A signing block's choices, read safely; `role` names the MC in the default label ("The Celebrant"). */
export function signaturesOf(section: DocSection, role = 'MC'): Signing {
  const raw = section.data?.kind === 'signatures' ? (section.data.signatures as SignaturesData) : {};
  return {
    who: raw.who ?? 'both',
    layout: raw.layout ?? 'row',
    yourLabel: raw.yourLabel ?? label(`The ${role}`),
    clientLabel: raw.clientLabel ?? label('The Client'),
    name: raw.name ?? true,
    date: raw.date ?? true,
  };
}

/** Whether the MC signs a contract made from `layout` (their own contract, or the classic page when there is none). */
export function mcSigns(layout: DocLayout | null | undefined): boolean {
  const block = layout?.sections.find((s) => s.kind === 'signatures');
  return !block || signaturesOf(block).who === 'both';
}
