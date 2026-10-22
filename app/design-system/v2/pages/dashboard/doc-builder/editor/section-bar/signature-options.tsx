'use client';

import { useAccount } from '../../../account';
import { signaturesOf } from '../../doc-types/contract/signing';
import type { DocSection, SignatureLayout, SignaturesData, SignatureWho } from '../../model/types';
import type { DocEditor } from '../../state/use-doc-editor';

import { PickMenu, ShowMenu, type MenuChoice } from './word-menus';

/**
 * The Signatures block's choices on its bar, each a short menu in words:
 * who signs (the MC and the couple, or the couple alone, which the send
 * flow follows: no signature asked of the MC), how the places sit (side
 * by side, or one under another), and Show: whether each place has the
 * signer's printed name and the date they signed under it. The labels
 * over the places are typed on the page (`../signatures-edit.tsx`), and
 * the words around the places are the MC's own text sections.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/section-bar/signature-options
 */

const WHO: MenuChoice<SignatureWho>[] = [
  { value: 'both', label: 'You and the couple' },
  { value: 'couple', label: 'The couple only' },
];
const LAYOUT: MenuChoice<SignatureLayout>[] = [
  { value: 'row', label: 'Side by side' },
  { value: 'stack', label: 'One under another' },
];
const LINES: { key: 'name' | 'date'; label: string }[] = [
  { key: 'name', label: 'Printed name' },
  { key: 'date', label: 'Date signed' },
];

/** Who signs, the places' layout, and the lines under them, for `section`. */
export function SignatureOptions({ builder, section }: { builder: DocEditor; section: DocSection }) {
  const account = useAccount();
  const data = signaturesOf(section, account.mc?.role);
  const set = (patch: SignaturesData) => builder.dispatch({ type: 'setData', id: section.id, data: { kind: 'signatures', signatures: { ...data, ...patch } } }, { commit: true });
  return (
    <>
      <PickMenu label="Who signs" choices={WHO} value={data.who} onPick={(who) => set({ who })} />
      <PickMenu label="Layout" choices={LAYOUT} value={data.layout} onPick={(layout) => set({ layout })} />
      <ShowMenu lines={LINES} on={data} onToggle={(key) => set({ [key]: !data[key] })} />
    </>
  );
}
