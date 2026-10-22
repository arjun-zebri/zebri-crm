'use client';

import { Checkbox } from '@/components/ui-v2/checkbox';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { Input } from '@/components/ui-v2/input';

import { money } from '../payments/payments-data';
import { answerText } from '../questionnaires/questionnaire-data';

import {
  CERT_DESIGNS,
  CERT_SPEEDS,
  CERTIFICATE_FEE,
  DELIVERY,
  type Celebrant,
  type CertificateOrder,
  type Paperwork,
} from './bdm-data';

/**
 * Ordering the couple's marriage certificate with the lodgement, in the
 * lodge dialog: off until ticked, since it costs money. Then the design
 * (standard or a commemorative one), the speed, how many, and how it
 * reaches them, with the address it goes to written underneath so the
 * celebrant sees where it is posted. Posting to the celebrant needs their
 * postal address from Settings; until it is there the order cannot go.
 * The fee is BDM's: the request says only that a celebrant pays by
 * credit card and carries no card, so the label promises no more than
 * that it goes to BDM (how BDM collects it is an open question for them).
 *
 * @module app/design-system/v2/pages/dashboard/bdm/certificate-order
 */

/** A new order: a standard certificate, ordinary speed, one copy, posted to the couple. */
export const NEW_ORDER: CertificateOrder = {
  design: 'Standard',
  speed: 'Ordinary',
  copies: 1,
  delivery: DELIVERY[0],
};

/** Where an order is posted, in words, or null when there is no address for it yet. */
export function postedTo(p: Paperwork, celebrant: Celebrant, o: CertificateOrder): string | null {
  if (o.delivery === 'Collect from the Registry') return 'Collected from the Registry in Sydney';
  if (o.delivery === 'Registered mail to the couple') {
    const a = (id: string) => answerText(p.answers[`p1.${id}`]).trim();
    const line =
      a('addrCountry') && a('addrCountry') !== 'Australia'
        ? a('addrIntl')
        : [a('addrLine1'), a('addrSuburb'), a('addrState'), a('addrPostcode')]
            .filter(Boolean)
            .join(' ');
    return line || null;
  }
  const c = celebrant.postal;
  return c.line1 && c.postcode ? `${c.line1}, ${c.suburb} ${c.state} ${c.postcode}` : null;
}

export interface CertificateOrderProps {
  paper: Paperwork;
  celebrant: Celebrant;
  /** The order, or null when none is wanted. */
  value: CertificateOrder | null;
  onChange: (order: CertificateOrder | null) => void;
}

/** The order's fields. See {@link CertificateOrderProps}. */
export function CertificateOrderFields({
  paper,
  celebrant,
  value: o,
  onChange,
}: CertificateOrderProps) {
  const set = (change: Partial<CertificateOrder>) => o && onChange({ ...o, ...change });
  const to = o ? postedTo(paper, celebrant, o) : null;
  return (
    <>
      <Checkbox
        label={`Order it now: from ${money(CERTIFICATE_FEE)}, paid to NSW BDM, not Zebri`}
        checked={Boolean(o)}
        onChange={(e) => onChange(e.target.checked ? NEW_ORDER : null)}
      />
      {o ? (
        <div className="space-y-0.5 pt-2">
          <Dropdown
            row
            label="Design"
            options={CERT_DESIGNS.map((d) => ({ value: d, label: d }))}
            value={o.design}
            onChange={(d) => set({ design: d as CertificateOrder['design'] })}
          />
          <Dropdown
            row
            label="Speed"
            options={CERT_SPEEDS.map((s) => ({ value: s, label: s }))}
            value={o.speed}
            onChange={(s) => set({ speed: s as CertificateOrder['speed'] })}
          />
          <Input
            row
            label="Copies"
            inputMode="numeric"
            value={String(o.copies)}
            // The Registry takes up to two digits.
            onChange={(e) =>
              set({
                copies: Math.min(99, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)),
              })
            }
          />
          <Dropdown
            row
            label="Delivery"
            options={DELIVERY.map((d) => ({ value: d, label: d }))}
            value={o.delivery}
            onChange={(d) => set({ delivery: d as CertificateOrder['delivery'] })}
          />
          {/* Under the value column: the name column's 9.5rem and the row's 1rem gap, as ledger rows' help is. */}
          <p className={`type-body sm:pl-[10.5rem] ${to ? 'text-zebra-500' : 'text-warning-ink'}`}>
            {to ??
              (o.delivery === 'Registered mail to you'
                ? 'Add your postal address in Settings, Lodge with BDM.'
                : 'Their home address is missing from their form.')}
          </p>
        </div>
      ) : null}
    </>
  );
}
