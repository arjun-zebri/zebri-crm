'use client';

import type { Clause } from '../../../account';
import { KitText, useRule } from '../kit-text';

/**
 * A contract's parts, drawn in the kit: its numbered clauses (a run of
 * them per page) and the signing block. The wording is the agreement's,
 * never typed on the page, and signatures come from signing.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/widgets/agreement
 */

/** Clauses `from` (1-based) on, in order. */
export function Clauses({ clauses, from }: { clauses: Clause[]; from: number }) {
  return (
    <ol className="w-full space-y-5">
      {clauses.map(([title, text], n) => (
        <li key={title} className="space-y-1">
          <KitText strong>
            {from + n}. {title}
          </KitText>
          <KitText tone="muted" className="text-pretty">
            {text}
          </KitText>
        </li>
      ))}
    </ol>
  );
}

/** One person signing. */
export interface SigningParty {
  name: string;
  /** When they signed, or null while waiting. */
  signed: string | null;
  /** Their drawn signature, once signed (the MC's). */
  drawn?: string | null | undefined;
}

/** The signing block: a line per party, drawn once they have signed. */
export function SigningBlock({ parties }: { parties: SigningParty[] }) {
  const line = useRule(0.35);
  return (
    // Named, so the contract editor can bring it into view as the MC signs.
    <section aria-label="Signatures" className="w-full space-y-5">
      <KitText tone="muted">Signed by the MC and the Client, agreeing to the above.</KitText>
      <div className="grid grid-cols-3 gap-6">
        {parties.map((p) => (
          <div key={p.name} className="space-y-1">
            {/* The signing line in the kit's ink: a runtime colour. */}
            <div style={{ borderBottom: `1px solid ${line}` }} className="flex h-14 items-end pb-1">
              {p.signed && p.drawn ? (
                // The MC's own drawn signature: a data URL.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.drawn} alt={`Signed by ${p.name}`} className="h-full w-full object-contain object-bottom-left" />
              ) : p.signed ? (
                <span className="truncate font-[family-name:var(--font-signature)] text-[28px] leading-9">{p.name}</span>
              ) : null}
            </div>
            <KitText>{p.name}</KitText>
            <KitText tone="muted">{p.signed ? `Signed ${p.signed}` : 'Not signed yet'}</KitText>
          </div>
        ))}
      </div>
    </section>
  );
}

/** An agreement's key terms, two to a row, each a label over its value. */
export function Facts({ facts }: { facts: [label: string, value: string][] }) {
  const faint = useRule();
  return (
    // Ruled above and below in the kit's ink: a runtime colour.
    <dl style={{ borderTop: `1px solid ${faint}`, borderBottom: `1px solid ${faint}` }} className="grid w-full grid-cols-2 gap-x-8 gap-y-4 py-5">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>
            <KitText as="span" tone="muted">{label}</KitText>
          </dt>
          <dd>
            <KitText as="span">{value}</KitText>
          </dd>
        </div>
      ))}
    </dl>
  );
}
