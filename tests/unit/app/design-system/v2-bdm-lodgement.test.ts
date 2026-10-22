import { describe, expect, it } from 'vitest';

import { DEMO_CELEBRANT, weddingIso, type Paperwork } from '@/app/design-system/v2/pages/dashboard/bdm/bdm-data';
import { SEEDS } from '@/app/design-system/v2/pages/dashboard/bdm/bdm-seeds';
import { noimRequest } from '@/app/design-system/v2/pages/dashboard/bdm/lodgement';
import { productCode } from '@/app/design-system/v2/pages/dashboard/bdm/lodgement-certificate';
import { missing } from '@/app/design-system/v2/pages/dashboard/bdm/noim-questions';
import { issuesOf } from '@/app/design-system/v2/pages/dashboard/bdm/rules';

/**
 * The Lodge with BDM block against the LifeLink lodgeNOIM request: every
 * answer lands in the request field it belongs to, in the shape the
 * guide's field rules ask, and what BDM would refuse is caught first.
 */

const seed = (client: string) => {
  const p = SEEDS.find((s) => s.client === client);
  if (!p) throw new Error(`No seed ${client}`);
  return p;
};
const celebrant = { ...DEMO_CELEBRANT, number: '12345' };
const ruby = seed('Ruby & Kai');

describe('noimRequest', () => {
  const { NOIMDetails: d, CertificateRequest: cert } = noimRequest(ruby, celebrant);

  it('dates the marriage YYYY-MM-DD from the client date', () => {
    expect(d.MarriageDetails.DateOfMarriage).toBe('2026-09-12');
    expect(weddingIso({ ...ruby, date: 'Sat 6 Mar 2027' })).toBe('2027-03-06');
  });

  it('gives addresses in their parts, and the venue its own', () => {
    expect(d.GroomDetails.ResidentialAddress).toEqual({ Country: 'Australia', Line1: '14 Wattle Street', SuburbOrTown: 'Newtown', State: 'NSW', Postcode: '2042' });
    expect(d.MarriageDetails.PlaceOfMarriage).toMatchObject({ Line1: '1 North Head Scenic Drive', Postcode: '2095' });
  });

  it('splits parents and witnesses into NameType', () => {
    expect(d.GroomDetails.FatherName).toEqual({ FamilyName: 'Walsh', FirstGivenName: 'David', OtherGivenNames: 'John' });
    expect(d.SolemnisationDetails.Witness1Name).toEqual({ FamilyName: 'Cole', FirstGivenName: 'Hannah', OtherGivenNames: 'Grace' });
  });

  it("maps a passport, residence and a parent's life to BDM's values", () => {
    expect(d.PartiesIdentification.BrideIdentification).toMatchObject({ OverseasPassportProduced: true, PassportCountry: 'New Zealand', PassportNumber: 'LA482913', BirthCertProduced: false });
    expect(d.AdditionalBrideDetails).toMatchObject({ PeriodOfResidenceInAusYears: 9, PeriodOfResidenceInAusMonths: 4, FatherLifeStatus: 'Alive' });
    expect(d.NOIMLodgement.GroomSignWitnessTitle).toBe('Authorised Marriage Celebrant');
  });

  it('carries a previous marriage and how it ended', () => {
    const chloe = noimRequest(seed('Chloe & Marcus'), celebrant).NOIMDetails;
    expect(chloe.BrideDetails.ConjugalStatus).toBe('Divorced');
    expect(chloe.AdditionalBrideDetails).toMatchObject({ TerminationMethodOfLastMarriage: 'Divorce', CourtLocation: 'Federal Circuit Court, Sydney', ChildBirthYear: [2016] });
    expect(chloe.AdditionalBrideDetails).toMatchObject({ PreviousMarriage: { YearOfPreviousMarriageCeremony: 2014 } });
  });

  it('orders the certificate by its product code, paid by card', () => {
    expect(cert).toMatchObject({ Product: { ProductCode: 'eWAP', Quantity: 1 }, Subproducts: [{ Specification: 'MR Commemorative Waratah' }], PaymentBy: 'Credit Card' });
    expect(cert?.Delivery.DeliveryMethod).toBe('Registered Mail');
    expect(productCode({ design: 'Standard', speed: 'Ordinary', copies: 1, delivery: 'Collect from the Registry' })).toBe('eNMO');
  });
});

describe('the couple form', () => {
  it('asks the ID numbers only for the ID chosen', () => {
    const ids = (answers: Paperwork['answers']) => missing({ ...ruby, answers }).map((q) => q.id).filter((id) => id.startsWith('p1.id'));
    expect(ids({ 'p1.id': 'Australian birth certificate' })).toEqual(['p1.idCertYear', 'p1.idCertNumber']);
    expect(ids({ 'p1.id': 'None of these' })).toEqual([]);
  });

  it('a complete seed has nothing missing and nothing BDM would refuse', () => {
    expect(missing(ruby)).toEqual([]);
    expect(issuesOf(ruby)).toEqual([]);
  });
});

describe('issuesOf', () => {
  const withAnswers = (answers: Paperwork['answers'], checks: Paperwork['checks'] = {}) => issuesOf({ ...ruby, answers: { ...ruby.answers, ...answers }, checks: { ...ruby.checks, ...checks } });

  it('strips commas from an address line, and sends a slash back to the couple', () => {
    expect(withAnswers({ 'p1.addrLine1': '14 Wattle St.,' })[0]).toMatchObject({ key: 'p1.addrLine1', fix: { answers: { 'p1.addrLine1': '14 Wattle St' } } });
    const slash = withAnswers({ 'p1.addrLine1': '4/14 Wattle Street' })[0];
    expect(slash?.key).toBe('p1.addrLine1');
    expect(slash?.fix).toBeUndefined();
  });

  it('catches a bad postcode, a long occupation and missing child years', () => {
    const keys = withAnswers({ 'p1.addrPostcode': '204', 'p1.occupation': 'x'.repeat(41), 'p1.conjugal': 'Widowed', 'p1.children': '2', 'p1.childYears': '2015' }).map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(['p1.addrPostcode', 'p1.occupation', 'p1.childYears']));
  });

  it('blocks someone under 18 on the day', () => {
    expect(withAnswers({ 'p2.dob': '2009-01-01' }).map((i) => i.key)).toContain('p2.dob');
  });

  it("fixes a witness's casing in the checks", () => {
    expect(withAnswers({}, { witness1Family: 'COLE' })[0]).toMatchObject({ key: 'after.witness1Family', fix: { checks: { witness1Family: 'Cole' } } });
  });
});
