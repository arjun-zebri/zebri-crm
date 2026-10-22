'use client';

import type { ProposalTheme } from '@/features/proposals';

import type { Account } from '../../../account';
import { clientName } from '../../../clients/clients-data';
import { fullDate } from '../../../payments/dates';
import { coupleName, personOf, type Invoice } from '../../../payments/payments-data';
import { type DocParts, Eyebrow, PartText } from '../../sections/parts/parts';

import { LineItemsView } from './line-items-view';
import { lineItemsOf } from './lines';

/**
 * An invoice's working parts, drawn for one invoice: the lines it
 * charges with the totals (`./line-items-view.tsx`), whose every word is
 * the MC's and whose figures are worked out. Everything else on an
 * invoice is the MC's own words with fields (`./starter.ts`); the
 * details and how-to-pay parts stay for an invoice made before.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/invoice/parts
 */

/** A label over its value, as the invoice's details read. */
function Detail({ theme, label, lines }: { theme: ProposalTheme; label: string; lines: string[] }) {
  return (
    <div className="space-y-1">
      <Eyebrow theme={theme}>{label}</Eyebrow>
      {lines.filter(Boolean).map((l) => (
        <PartText key={l} theme={theme}>
          {l}
        </PartText>
      ))}
    </div>
  );
}

/** The parts for `invoice`, from `account`'s business. */
export function invoiceParts(invoice: Invoice, account: Account): DocParts {
  const i = invoice;
  const event = account.clients.find((c) => clientName(c) === coupleName(i.names));
  const people = event?.email !== undefined ? i.names.filter(Boolean).map((n) => ({ name: n, email: event.email ?? '' })) : i.names.filter(Boolean).map(personOf);
  const contact = account.contact;
  return {
    invoiceHead: ({ theme, branding }) => (
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <Eyebrow theme={theme} brand={branding.brand_color}>
              Tax invoice
            </Eyebrow>
            <PartText theme={theme} muted>
              #{i.number}
            </PartText>
          </div>
          {contact ? (
            <div className="space-y-1 text-right">
              <PartText theme={theme} muted>
                ABN {contact.abn}
              </PartText>
              <PartText theme={theme} muted>
                {contact.email} · {contact.phone}
              </PartText>
            </div>
          ) : null}
        </div>
        <div className="grid gap-6 @xl/doc:grid-cols-3">
          <Detail theme={theme} label="Billed to" lines={[...people.map((p) => p.name), people[0]?.email ?? '']} />
          <Detail theme={theme} label="Invoice" lines={[`Issued ${fullDate(i.sentOn ?? i.zebriSends ?? i.dueOn)}`, `Due ${fullDate(i.dueOn)}`]} />
          <Detail theme={theme} label="Event" lines={[i.item, event?.date ?? '', event?.venue ?? '']} />
        </div>
      </div>
    ),
    lineItems: ({ theme, section, branding, mode, values = {} }) => {
      const ctx = { branding, theme, mode, values, textColor: section.style.textColor, align: section.style.align };
      return <LineItemsView lines={lineItemsOf(section)} theme={theme} ctx={ctx} />;
    },
    payment: ({ theme, branding }) => (
      // A soft wash of the MC's brand colour behind how to pay: a runtime colour.
      <div style={{ background: `color-mix(in srgb, ${branding.brand_color} 8%, transparent)`, borderRadius: branding.button_radius }} className="grid gap-6 p-6 @xl/doc:grid-cols-2">
        <div className="space-y-1">
          <Eyebrow theme={theme}>Pay online</Eyebrow>
          <PartText theme={theme} muted>Card or Apple Pay at</PartText>
          <PartText theme={theme} className="underline">
            zebri.app/pay/{i.number}
          </PartText>
        </div>
        {contact ? (
          <div className="space-y-1">
            <Eyebrow theme={theme}>Bank transfer</Eyebrow>
            <PartText theme={theme} muted>
              {account.business} · {contact.bank}
            </PartText>
            <PartText theme={theme} muted>
              Reference INV-{i.number}
            </PartText>
          </div>
        ) : null}
      </div>
    ),
  };
}
