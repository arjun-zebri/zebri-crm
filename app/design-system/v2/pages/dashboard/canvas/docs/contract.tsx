'use client';

import type { Account } from '../../account';
import { sampleContract } from '../../documents/samples';
import { CLAUSES, FIRST_PAGE } from '../../payments/modal/contract-clauses';
import { coupleName, money, type Contract } from '../../payments/payments-data';

import { band, field, logo, M, page, part, rule, text, W } from './build';
import { businessFields, type DesignSpec } from './spec';
import { Clauses, Facts, SigningBlock } from './widgets/agreement';


/**
 * The contract as a design: two pages, the parties and terms on the
 * first, the rest of the clauses and the signing block on the second. The
 * parties, the terms, every clause and the signatures are locked: they
 * are the agreement. The MC places and styles them, and everything around.
 *
 * @module app/design-system/v2/pages/dashboard/canvas/docs/contract
 */


/** "$375 on signing, $1,125 30 days before", or the whole fee on signing, or none of it. */
function depositLine(total: number, held: number, days: number) {
  if (held >= total) return `${money(total)} on signing`;
  if (!held) return `${money(total)} ${days} days before`;
  return `${money(held)} on signing, ${money(total - held)} ${days} days before`;
}

/** What a contract is filled from. */
export interface ContractData {
  contract: Contract;
  /** The MC's signature as they draw it, before it is saved. */
  drawn?: string | null | undefined;
}

const footer = (n: number) => [
  rule(`foot-rule-${n}`, { x: M, y: 1040, w: W }),
  field(`foot-${n}`, 'Business footer', 'business.footer', 'body', { x: M, y: 1060, w: 460 }, { color: 'kit:muted', locked: true }),
  text(`page-${n}`, 'Page number', `Page ${n} of 2`, 'body', { x: 530, y: 1060, w: 200 }, { color: 'kit:muted', align: 'right' }),
];

export const CONTRACT: DesignSpec<ContractData> = {
  kind: 'contract',
  label: 'Contract',
  layout: () => ({
    id: 'contract',
    kind: 'contract',
    title: 'Contract',
    pages: [
      // The onboarding look: a brand strip, the word "Contract" in the brand colour over a heading-font title.
      page('contract-1', [
        band('band-1'),
        logo('logo', { x: M, y: M, w: 280, h: 44 }),
        text('eyebrow', 'Eyebrow', 'Contract', 'caption', { x: M, y: 148, w: W, h: 24 }, { color: 'kit:primary' }),
        field('title', 'Title', 'contract.title', 'heading', { x: M, y: 174, w: W, h: 48 }, { size: 34 }),
        field('parties', 'Parties', 'contract.parties', 'body', { x: M, y: 230, w: W }, { color: 'kit:muted', locked: true }),
        part('facts', 'Terms', 'facts', { x: M, y: 284, w: W, h: 150 }),
        part('clauses-1', 'Clauses', 'clauses-1', { x: M, y: 464, w: W, h: 556 }),
        ...footer(1),
      ]),
      page('contract-2', [
        band('band-2'),
        part('clauses-2', 'Clauses', 'clauses-2', { x: M, y: M, w: W, h: 640 }),
        part('signatures', 'Signatures', 'signatures', { x: M, y: 800, w: W, h: 160 }),
        ...footer(2),
      ]),
    ],
  }),
  sample: (account) => ({ contract: sampleContract(account.terms) }),
  fill: ({ contract: c, drawn }, account: Account) => {
    const clauses = c.clauses ?? CLAUSES;
    const held = Math.round((c.total * account.deposit) / 100);
    const b = businessFields(account);
    return {
      fields: { ...b.fields, 'contract.title': c.title, 'contract.parties': `Between ${account.business} (the MC) and ${coupleName(c.names)} (the Client)` },
      fieldNames: { ...b.fieldNames, 'contract.title': 'Contract title', 'contract.parties': 'Parties' },
      widgets: {
        facts: () => (
          <Facts
            facts={[
              ['Event', c.event],
              ['Package', c.item],
              ['Fee', `${money(c.total)} incl. GST`],
              ['Deposit and balance', depositLine(c.total, held, c.balanceDays ?? 14)],
            ]}
          />
        ),
        'clauses-1': () => <Clauses clauses={clauses.slice(0, FIRST_PAGE)} from={1} />,
        'clauses-2': () => <Clauses clauses={clauses.slice(FIRST_PAGE)} from={FIRST_PAGE + 1} />,
        signatures: () => (
          <SigningBlock parties={c.signers.map((s) => ({ name: s.name, signed: s.signed, drawn: s.role === 'You' ? (drawn ?? account.signature) : null }))} />
        ),
      },
    };
  },
};
