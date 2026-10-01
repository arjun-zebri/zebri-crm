'use client';

import { useEffect } from 'react';

import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { useAccount } from './pages/dashboard/account';
import { ContractPreview } from './pages/dashboard/payments/modal/contract-preview';
import { InvoiceEmail } from './pages/dashboard/payments/modal/invoice-email';
import { finish } from './pages/dashboard/payments/payments-data';
import { Group, Spec } from './showroom-v2';

/**
 * v2 documents: what a couple receives, as the send-flow editors show
 * it. Both render from their real source with the demo business's data.
 *
 * @module app/design-system/v2/components-documents
 */
export function ComponentsDocumentsV2() {
  // The documents set the MC's brand fonts, which only the editors load otherwise.
  useEffect(() => ensureBrandFontsStylesheet(), []);
  const { contracts, invoices } = useAccount();
  const contract = contracts[0];
  const seed = invoices.find((i) => i.label === 'Deposit' && !i.paidOn) ?? invoices[0];
  const invoice = seed ? finish(seed) : null;
  return (
    <Group id="documents" title="Documents">
      <Spec
        name="Deposit email"
        file="app/design-system/v2/pages/dashboard/payments/modal/invoice-email.tsx"
        description="A deposit invoice as the couple meets it: an email in the MC's brand, not a sheet of paper (the paper tax invoice goes with it as a PDF). The amount and due date on the brand gradient with a light Pay button, the MC's note signed with their portrait, a two-step payment schedule over the package total, and the attachment."
      >
        <div className="rounded-panel bg-zebra-50 p-6">{invoice ? <InvoiceEmail invoice={invoice} /> : null}</div>
      </Spec>
      <Spec
        name="Contract"
        file="app/design-system/v2/pages/dashboard/payments/modal/contract-preview.tsx"
        description="Zebri's standard MC agreement (contract-clauses.ts: ten clauses, 'event' never 'wedding') on two A4 pages: the parties and a summary of event, package, fee, deposit and balance, clauses 1 to 5; then 6 to 10 and the signatures, which show the MC's drawn signature as it is drawn."
      >
        <div className="max-h-[40rem] overflow-y-auto rounded-panel bg-zebra-50 p-6">
          <div className="mx-auto max-w-lg">{contract ? <ContractPreview contract={contract} /> : null}</div>
        </div>
      </Spec>
    </Group>
  );
}
