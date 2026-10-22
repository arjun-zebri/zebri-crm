import type { Contract } from '../payments/payments-data';

/**
 * The sample client documents are drawn for when there is no real one:
 * a template card's miniature and the Brand tab's preview. The same
 * couple (Sarah and Tom) as the proposal templates, so every kind's
 * sample reads as one booking.
 *
 * @module app/design-system/v2/pages/dashboard/documents/samples
 */

/** A contract for the sample couple, in the MC's wording (`clauses`) or the standard one. */
export const sampleContract = (clauses?: Contract['clauses'] | null): Contract => ({
  id: 'sample-contract',
  names: ['Sarah', 'Tom'],
  title: 'MC services agreement',
  item: 'Premium MC package',
  total: 4350,
  event: 'Saturday 12 March 2027',
  when: 'Not sent',
  group: 'draft',
  signers: [],
  history: [],
  clauses: clauses ?? undefined,
});
