import { answerText } from '../questionnaires/questionnaire-data';

import type { Celebrant, CertificateOrder, Paperwork } from './bdm-data';
import { addressType, nameType } from './lodgement';

/**
 * A certificate ordered with the lodgement, as the LifeLink
 * `LodgeApplication` `ApplicationDetails` (guide §11, Tables 13 and 14):
 * the product code for the design and speed, the subproducts a
 * commemorative package carries, how it is delivered and where, and the
 * couple it is for. Celebrants pay by credit card; they have no Registry
 * account. The guide's own sample uses codes without the "e" ("NMO",
 * "MRO1") where its table has "eNMO": the table's codes are used here,
 * to confirm against BDM's current XSD.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/lodgement-certificate
 */

/** Each design's product code stem and the commemorative subproduct it carries. */
const PRODUCTS: Record<CertificateOrder['design'], { stem: string; commem?: string }> = {
  Standard: { stem: 'eNM' },
  Rose: { stem: 'eRO', commem: 'MR Commemorative Rose' },
  Waratah: { stem: 'eWA', commem: 'MR Commemorative Waratah' },
  'Marriage ring': { stem: 'eMR', commem: 'MR Commemorative Marriage Ring' },
  'Diamond rings': { stem: 'eDR', commem: 'MarriageDiamondRings' },
  'Holding hands': { stem: 'eHH', commem: 'MarriageHoldingHands' },
  'Cut the cake': { stem: 'eCT', commem: 'MR Commem Cut the Cake' },
};

/** The product code: "eNMO" for a standard certificate, ordinary speed. */
export const productCode = (o: CertificateOrder) => `${PRODUCTS[o.design].stem}${o.speed === 'Priority' ? 'P' : 'O'}`;

/** Where a certificate goes: the couple's home (Party 1's), or the celebrant's postal address. */
export function deliveryAddress(p: Paperwork, celebrant: Celebrant, o: CertificateOrder) {
  const a = (id: string) => answerText(p.answers[`p1.${id}`]);
  if (o.delivery === 'Registered mail to the couple') return addressType(a('addrCountry'), a('addrLine1'), a('addrSuburb'), a('addrState'), a('addrPostcode'), a('addrIntl'));
  // Collect still needs an address on the application: the celebrant's.
  const c = celebrant.postal;
  return addressType('Australia', c.line1, c.suburb, c.state, c.postcode);
}

/** The application, for the request's `CertificateRequest`. */
export function certificateRequest(p: Paperwork, celebrant: Celebrant, o: CertificateOrder) {
  const product = PRODUCTS[o.design];
  const a = (id: string) => answerText(p.answers[id]);
  const toCouple = o.delivery === 'Registered mail to the couple';
  return {
    Product: { ProductCode: productCode(o), Quantity: o.copies, Specification: 'MR Certificate' },
    Subproducts: product.commem ? [{ ProductCode: productCode(o), Specification: product.commem }] : [],
    MarriageSubjectDetails: {
      Party1: nameType(a('p1.familyName'), a('p1.givenName'), a('p1.otherNames')),
      Party2: nameType(a('p2.familyName'), a('p2.givenName'), a('p2.otherNames')),
    },
    Delivery: {
      DeliveryMethod: o.delivery === 'Collect from the Registry' ? 'Collect' : 'Registered Mail',
      DeliveryAddress: deliveryAddress(p, celebrant, o),
      DeliveryName: toCouple ? nameType(a('p1.familyName'), a('p1.givenName')) : nameType(celebrant.familyName, celebrant.givenName),
      ExternalRefNumber: p.client.slice(0, 30),
    },
    // The stakeholder name as LifeLink has it: unknown until BDM sets Zebri or the celebrant up as one.
    Stakeholder: `${celebrant.givenName} ${celebrant.familyName}`.trim(),
    PaymentBy: 'Credit Card',
  };
}
