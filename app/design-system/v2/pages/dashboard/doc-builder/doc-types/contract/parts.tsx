'use client';

import type { Account } from '../../../account';
import { CLAUSES } from '../../../payments/modal/contract-clauses';
import { money, type Contract, type Signer } from '../../../payments/payments-data';
import { type DocParts, PartText, roleCss, RULE } from '../../sections/parts/parts';

import { type Place, SignaturePlaces } from './signature-places';
import { signaturesOf } from './signing';

/**
 * A contract's working parts, drawn for one contract: the booking details
 * (the event, package, fee, deposit and balance), and the signing block,
 * with the MC's drawn signature once they have one, for whoever the
 * block says signs and laid out as it says (`signaturesOf`). Both come
 * from the booking and from signing, so neither is typed on the page;
 * everything around them is the MC's own words (`./starter.ts`). The
 * booking details are now words too, with fields (`./fields.ts`); the
 * part stays for a contract made before.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/contract/parts
 */

/** What a contract is drawn from. */
export interface ContractPartsData {
  contract: Contract;
  /** The MC's signature as they draw it, before it is saved. */
  drawn?: string | null | undefined;
}

/** "$375 on signing, $1,125 30 days before", or the whole fee on signing, or none of it. */
export function depositLine(total: number, held: number, days: number) {
  if (held >= total) return `${money(total)} on signing`;
  if (!held) return `${money(total)} ${days} days before`;
  return `${money(held)} on signing, ${money(total - held)} ${days} days before`;
}

/** The parts for one contract, from `account`'s business. */
export function contractParts({ contract: c, drawn }: ContractPartsData, account: Account): DocParts {
  const clauses = c.clauses ?? CLAUSES;
  const held = Math.round((c.total * account.deposit) / 100);
  const facts: [string, string][] = [
    ['Event', c.event],
    ['Package', c.item],
    ['Fee', `${money(c.total)} incl. GST`],
    ['Deposit and balance', depositLine(c.total, held, c.balanceDays ?? 14)],
  ];
  // A contract not yet sent (the design's sample) has no signers: the MC and the couple's lines stand in, so the block has its shape.
  const signers: Signer[] = c.signers.length
    ? c.signers
    : [{ name: account.mc?.name ?? account.business, role: 'You', signed: null }, ...c.names.filter(Boolean).map((name): Signer => ({ name, role: 'Client', signed: null }))];
  return {
    // The booking's facts. The title and who it is between are the MC's own words above it (`./starter.ts`).
    agreement: ({ theme }) => (
      <dl className={`grid gap-x-8 gap-y-4 border-y py-5 @xl/doc:grid-cols-2 ${RULE}`}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt style={roleCss(theme, 'paragraph')} className="opacity-70">
              {label}
            </dt>
            <dd style={roleCss(theme, 'paragraph')}>{value}</dd>
          </div>
        ))}
      </dl>
    ),
    // Kept for a contract designed before its clauses were words on the page.
    clauses: ({ theme }) => (
      <ol className="space-y-5">
        {clauses.map(([title, text], n) => (
          <li key={title} className="space-y-1">
            <PartText theme={theme} strong>
              {n + 1}. {title}
            </PartText>
            <PartText theme={theme} muted className="text-pretty">
              {text}
            </PartText>
          </li>
        ))}
      </ol>
    ),
    signatures: ({ theme, section, branding, mode, values = {} }) => {
      const signing = signaturesOf(section, account.mc?.role);
      // Signed by the couple alone, the MC's place is left off; the sentence about it is the MC's own words above.
      const places: Place[] = (signing.who === 'couple' ? signers.filter((s) => s.role !== 'You') : signers).map((s) => ({
        role: s.role === 'You' ? 'You' : 'Client',
        name: s.name,
        signed: s.signed,
        ink: s.role === 'You' ? (drawn ?? account.signature) : null,
      }));
      const ctx = { branding, theme, mode, values, textColor: section.style.textColor, align: section.style.align };
      return <SignaturePlaces signing={signing} places={places} theme={theme} ctx={ctx} />;
    },
  };
}
