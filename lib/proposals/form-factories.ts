/**
 * Factories that build proposal builder form state: a blank form, a blank
 * option, and an option applied from a package in the library.
 *
 * Split from `./form-mapping` (which maps form state to and from database
 * rows) so both stay under the file-size guideline and so the two concerns
 * read separately: this module invents new state, that one translates
 * existing state.
 *
 * @module lib/proposals/form-factories
 */
import type { ProposalFormState } from './form-mapping';
import type { ProposalOptionInput } from './types';


const newId = () => `new-${crypto.randomUUID()}`;

/** A blank form for a brand-new proposal, optionally pre-selecting a couple. */
export function emptyForm(coupleId: string | null): ProposalFormState {
  return {
    proposalId: null,
    coupleId: coupleId ?? '',
    eventId: null,
    title: '',
    introNote: null,
    heroOverride: null,
    expiresAt: null,
    depositPercent: 30,
    paymentScheduleId: null,
    contractTemplateId: null,
    options: [],
    status: 'draft',
    proposalNumber: null,
    shareToken: null,
    shareTokenEnabled: false,
    emailSentAt: null,
    version: 1,
  };
}

/**
 * The subset of `ApplySource` (`components/builders/parts/use-apply-sources`)
 * that {@link applyPackageToOption} needs.
 *
 * Duplicated structurally rather than imported: `lib/` must stay
 * app-agnostic and must not import from `components/` (see CLAUDE.md's
 * repo-layering rule). TypeScript's structural typing means a real
 * `ApplySource` value satisfies this shape with no cast at the call site.
 */
export interface ApplySourceInput {
  notes: string | null;
  items: { description: string; note?: string | null; amount: number }[];
  addOns: { description: string; note?: string | null; amount: number }[];
  package: { id: string; gstInclusive: boolean; weekendLoadingPercent: number | null; isPopular: boolean } | null;
}

/**
 * A brand-new, unattached option for the MC to build by hand instead of
 * applying a package: no package snapshot, itemised pricing (matching a
 * fresh package's default), no items yet. Modelled on {@link emptyForm}.
 * The card explains the blank title with a placeholder, so an empty
 * string here is intentional rather than a stand-in for "Untitled".
 *
 * @param position - 1-based position among the proposal's other options.
 */
export function blankOption(position: number): ProposalOptionInput {
  return {
    id: newId(),
    position,
    title: '',
    description: null,
    sourcePackageId: null,
    pricingMode: 'itemised',
    fixedPrice: null,
    gstInclusive: true,
    weekendLoadingPercent: null,
    isPopular: false,
    items: [],
  };
}

/**
 * Snapshot a picked package (or template) into a new option.
 *
 * @param hasPopular - Whether an existing option on the proposal is
 *   already marked popular. A second popular option would show the
 *   couple two "Most popular" badges, so the new one is force-cleared
 *   when one already exists, even if the source package itself is
 *   flagged popular in the packages library.
 */
export function applyPackageToOption(
  source: ApplySourceInput,
  name: string,
  position: number,
  hasPopular: boolean,
): ProposalOptionInput {
  const base = source.items.map((it, idx) => ({
    id: newId(),
    description: it.description,
    note: it.note ?? null,
    amount: it.amount,
    quantity: 1,
    isAddon: false,
    defaultIncluded: true,
    position: idx + 1,
  }));
  const addOns = source.addOns.map((it, idx) => ({
    id: newId(),
    description: it.description,
    note: it.note ?? null,
    amount: it.amount,
    quantity: 1,
    isAddon: true,
    defaultIncluded: false,
    position: base.length + idx + 1,
  }));
  return {
    id: newId(),
    position,
    title: name,
    description: source.notes,
    sourcePackageId: source.package?.id ?? null,
    pricingMode: 'itemised',
    fixedPrice: null,
    gstInclusive: source.package?.gstInclusive ?? true,
    weekendLoadingPercent: source.package?.weekendLoadingPercent ?? null,
    isPopular: hasPopular ? false : (source.package?.isPopular ?? false),
    items: [...base, ...addOns],
  };
}
