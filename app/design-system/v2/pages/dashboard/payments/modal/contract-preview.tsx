import type { ReactNode } from 'react';

import { DocumentPage } from '@/components/ui-v2/document-page';

import { useAccount, type Clause } from '../../account';
import { coupleName, money, type Contract } from '../payments-data';

import { CLAUSES, FIRST_PAGE } from './contract-clauses';
import { BrandScope, Letterhead } from './letterhead';

/**
 * A contract as the couple gets it, on real A4 pages (`DocumentPage`),
 * two of them, since the standard agreement runs longer than one.
 *
 * Page one: the letterhead, who it is between, a summary of what was
 * agreed (the event, the package, the fee, and the deposit and balance
 * the payment clauses refer to), then the first clauses. Page two: the
 * rest of the clauses and a signature line per signer, drawn once they
 * have signed. Each page carries its business and page number in the
 * footer, as a printed agreement does.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/contract-preview
 */

export { CLAUSES } from './contract-clauses';

/**
 * The couple's copy of a contract. `signature` overrides the account's
 * saved one: the editor passes the MC's drawing as they draw it, so the
 * page shows their real signature before it is saved on send.
 */
export function ContractPreview({ contract: c, signature }: { contract: Contract; signature?: string | null | undefined }) {
  const { business, brand, deposit } = useAccount();
  const clauses = c.clauses ?? CLAUSES;
  const held = Math.round((c.total * deposit) / 100);
  return (
    <BrandScope>
      <div className="space-y-6">
        <Page title={c.title} number={1}>
          {brand ? <Letterhead /> : null}
          <header className="space-y-1">
            <p className="type-title text-zebra-950">{c.title}</p>
            <p className="type-body text-zebra-500">
              Between {business} (the MC) and {coupleName(c.names)} (the Client)
            </p>
          </header>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-zebra-950/10 py-5 type-body">
            <Fact label="Event">{c.event}</Fact>
            <Fact label="Package">{c.item}</Fact>
            <Fact label="Fee">{money(c.total)} incl. GST</Fact>
            <Fact label="Deposit and balance">
              {money(held)} on signing, {money(c.total - held)} 14 days before
            </Fact>
          </dl>
          <Clauses clauses={clauses.slice(0, FIRST_PAGE)} from={1} />
        </Page>
        <Page title={c.title} number={2}>
          <Clauses clauses={clauses.slice(FIRST_PAGE)} from={FIRST_PAGE + 1} />
          <Signatures contract={c} signature={signature} />
        </Page>
      </div>
    </BrandScope>
  );
}

function Page({ title, number, children }: { title: string; number: number; children: ReactNode }) {
  const { business, contact } = useAccount();
  return (
    <DocumentPage aria-label={`${title}, page ${number} of 2`}>
      <div className="flex h-full flex-col gap-10 p-16">
        {children}
        <footer className="mt-auto flex justify-between border-t border-zebra-950/10 pt-4 type-body text-zebra-500">
          <p>
            {business}
            {contact ? ` · ABN ${contact.abn}` : ''}
          </p>
          <p>Page {number} of 2</p>
        </footer>
      </div>
    </DocumentPage>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-zebra-500">{label}</dt>
      <dd className="text-zebra-950">{children}</dd>
    </div>
  );
}

function Clauses({ clauses, from }: { clauses: Clause[]; from: number }) {
  return (
    <ol start={from} className="space-y-5 type-body">
      {clauses.map(([title, text], n) => (
        <li key={title} className="space-y-1">
          <p className="type-label text-zebra-950">
            {from + n}. {title}
          </p>
          <p className="text-pretty text-zebra-700">{text}</p>
        </li>
      ))}
    </ol>
  );
}

function Signatures({ contract: c, signature: drawn }: { contract: Contract; signature?: string | null | undefined }) {
  const saved = useAccount().signature;
  const signature = drawn ?? saved;
  return (
    <section aria-label="Signatures" className="space-y-5 pt-4">
      <p className="type-body text-zebra-700">Signed by the MC and the Client, agreeing to the above.</p>
      <div className="grid grid-cols-3 gap-6">
        {c.signers.map((s) => (
          <div key={s.name} className="space-y-1">
            {s.role === 'You' && s.signed && signature ? (
              // The MC's own drawn signature: a data URL, which next/image cannot take.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signature} alt={`Signed by ${s.name}`} className="h-14 w-full border-b border-zebra-300 object-contain object-bottom-left pb-1" />
            ) : (
              <p
                className={`h-14 truncate border-b border-zebra-300 pt-4 font-[family-name:var(--font-signature)] text-[28px] leading-9 ${s.signed ? 'text-zebra-950' : 'text-transparent'}`}
              >
                {s.signed ? s.name : '.'}
              </p>
            )}
            <p className="type-body text-zebra-950">{s.name}</p>
            <p className="type-body text-zebra-500">{s.signed ? `Signed ${s.signed}` : 'Not signed yet'}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
