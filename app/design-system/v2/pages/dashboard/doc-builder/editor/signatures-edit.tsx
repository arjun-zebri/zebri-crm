'use client';

import { InlineField } from '@/features/proposals';

import { useAccount } from '../../account';
import { type Place, SignaturePlaces } from '../doc-types/contract/signature-places';
import { signaturesOf, type Signing } from '../doc-types/contract/signing';
import type { DocSection, SignaturesData } from '../model/types';
import { useDocFields } from '../sections/parts/parts';
import type { DocEditor } from '../state/use-doc-editor';

/**
 * The Signatures block while editing: a placeholder for each signer,
 * as an e-sign template's fields are (the MC's place, then one for each
 * of the couple), saying whose it is, with the label over it typed in
 * place ("The MC", "The Client") and the lines under it (printed name,
 * date signed) as the bar's Show menu has them. Who signs and how the
 * places sit are the bar's too (`section-bar/signature-options.tsx`).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/signatures-edit
 */

/** The template's places: the couple is two people until a real contract names them. */
const placesFor = (signing: Signing): Place[] => [
  ...(signing.who === 'both' ? [{ role: 'You' as const, name: null, signed: null }] : []),
  { role: 'Client', name: null, signed: null },
  { role: 'Client', name: null, signed: null },
];

export interface SignaturesEditProps {
  section: DocSection;
  builder: DocEditor;
  /** Production's editor state version, which tells each label's editor when the layout changed under it (undo). */
  externalVersion: number;
}

/** The edit form. See {@link SignaturesEditProps}. */
export function SignaturesEdit({ section, builder, externalVersion }: SignaturesEditProps) {
  const account = useAccount();
  const fields = useDocFields();
  const signing = signaturesOf(section, account.mc?.role);
  const set = (patch: SignaturesData) => builder.dispatch({ type: 'setData', id: section.id, data: { kind: 'signatures', signatures: { ...signing, ...patch } } });
  const ctx = { branding: builder.branding, theme: builder.theme, mode: 'edit' as const, values: {}, textColor: section.style.textColor, align: section.style.align };
  return (
    <SignaturePlaces
      signing={signing}
      places={placesFor(signing)}
      theme={builder.theme}
      ctx={ctx}
      label={(role) => (
        <InlineField
          value={role === 'You' ? signing.yourLabel : signing.clientLabel}
          placeholder={role === 'You' ? 'Your label' : 'Their label'}
          singleLine
          className="[&_p]:m-0"
          externalVersion={externalVersion}
          onFocus={() => builder.select(section.id)}
          onChange={(doc) => set(role === 'You' ? { yourLabel: doc } : { clientLabel: doc })}
          variables={fields?.list}
        />
      )}
    />
  );
}
