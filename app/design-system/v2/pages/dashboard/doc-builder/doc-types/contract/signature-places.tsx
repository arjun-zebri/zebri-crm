'use client';

import type { ReactNode } from 'react';

import { EditIcon } from '@/components/ui-v2/icons';
import { RichDocView, type ProposalTheme, type RichDocContext } from '@/features/proposals';

import { PartText, RULE } from '../../sections/parts/parts';

import type { Signing } from './signing';

/**
 * A contract's signing places, one per signer: the MC's label over it
 * ("The MC"), the place they sign, then their printed name and the date
 * they signed, each line shown or not as the block says. On the page
 * being edited each place is a placeholder that says whose it is ("Client
 * signature"), as an e-sign template's fields do, and the label is typed
 * in place (`label`); for the couple, it is their real name and, once
 * signed, their signature. Shared by the sent page (`./parts.tsx`) and the
 * editor (`editor/signatures-edit.tsx`).
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/contract/signature-places
 */

/** One signer's place. */
export interface Place {
  role: 'You' | 'Client';
  /** Their name; null on the template, where it is not known yet. */
  name: string | null;
  /** When they signed ("Today"), or null. */
  signed: string | null;
  /** The MC's drawn signature, a data URL, once they have one. */
  ink?: string | null | undefined;
}

export interface SignaturePlacesProps {
  signing: Signing;
  places: Place[];
  theme: ProposalTheme;
  /** What the labels draw with. */
  ctx: RichDocContext;
  /** The editor's placeholders: the label over each place typed in place, in place of the drawn one. */
  label?: ((role: Place['role']) => ReactNode) | undefined;
}

/** What a place is called on the template. */
const WHOSE = { You: 'Your', Client: 'Client' } as const;

/** Filled in when they sign: tinted as a field in the words is (`editor/variable-token.tsx`). */
function Filled({ children }: { children: ReactNode }) {
  return <span className="rounded-check bg-grass-500/15 px-[0.2em]">{children}</span>;
}

/** The places. See {@link SignaturePlacesProps}. */
export function SignaturePlaces({ signing, places, theme, ctx, label }: SignaturePlacesProps) {
  const editing = Boolean(label);
  return (
    // Named, so the contract editor can bring it into view as the MC signs.
    <div aria-label="Signatures" role="group" className={signing.layout === 'stack' ? 'max-w-sm space-y-8' : 'grid gap-6 @xl/doc:grid-cols-3'}>
      {places.map((p, i) => (
        <div key={`${p.role}-${i}`} className="space-y-1">
          <div className="opacity-70 [&_p]:m-0">{label ? label(p.role) : <RichDocView doc={p.role === 'You' ? signing.yourLabel : signing.clientLabel} ctx={ctx} />}</div>
          {editing ? (
            <div className="flex h-14 items-center gap-2 rounded-check border border-dashed border-current/30 bg-current/5 px-3 opacity-70">
              <EditIcon aria-hidden="true" className="size-4 shrink-0" />
              <PartText theme={theme}>{WHOSE[p.role]} signature</PartText>
            </div>
          ) : (
            <div className={`flex h-14 items-end border-b pb-1 ${RULE}`}>
              {p.signed && p.ink ? (
                // The MC's own drawn signature: a data URL.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.ink} alt={`Signed by ${p.name ?? ''}`} className="h-full w-full object-contain object-bottom-left" />
              ) : p.signed ? (
                <span className="truncate font-[family-name:var(--font-signature)] text-[28px] leading-9">{p.name}</span>
              ) : null}
            </div>
          )}
          {signing.name ? <PartText theme={theme}>{editing ? <Filled>{WHOSE[p.role]} name</Filled> : p.name}</PartText> : null}
          {signing.date ? (
            <PartText theme={theme} muted>
              {editing ? <Filled>Date signed</Filled> : p.signed ? `Signed ${p.signed}` : 'Not signed yet'}
            </PartText>
          ) : null}
        </div>
      ))}
    </div>
  );
}
