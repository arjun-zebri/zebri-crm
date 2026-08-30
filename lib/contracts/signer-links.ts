/**
 * Per-signer contract links for the builder footer.
 *
 * Each client signer holds their own bearer link (`contract_signers.sign_token`),
 * so "Copy link" on a sent contract has two answers, not one. This builds the
 * row model the footer popover renders: primary and secondary contact, always
 * both rows, so the MC can see a missing partner rather than wonder why there
 * is only one link.
 *
 * @module lib/contracts/signer-links
 */

/** The subset of a `contract_signers` row this needs. */
export interface SignerRow {
  role: string;
  name: string | null;
  sign_token: string;
}

/** One row of the Copy link popover. */
export interface SignerLink {
  /** "Primary contact" / "Secondary contact". */
  label: string;
  /** The person, as named on the couple. Null when the row is unavailable. */
  name: string | null;
  /** Their own signing link, or null when there is nobody to link to. */
  url: string | null;
  /** Why `url` is null; shown as a tooltip on the greyed-out row. */
  unavailableReason?: string;
}

/** Why the secondary row is empty. Factual, and makes no promise about how
 *  adding one propagates: signer rows are seeded when the contract is created. */
export const NO_SECONDARY_CONTACT =
  'This couple has no secondary contact, so there is no link for them.';

/** Why a row has no link yet on a contract that has never been saved. */
export const NOT_SAVED_YET = 'Created when the contract is saved.';

/**
 * Rows for a contract that does not exist yet. Signer rows (and so tokens)
 * are seeded when the contract row is inserted, so before the first save the
 * popover can only name the contacts; the footer saves on open to fill them.
 */
export function pendingSignerLinks(
  primaryName: string | null | undefined,
  secondaryName: string | null | undefined,
): SignerLink[] {
  const has = (v: string | null | undefined) => !!v && v.trim() !== '';
  return [
    { label: 'Primary contact', name: has(primaryName) ? primaryName! : null, url: null, unavailableReason: NOT_SAVED_YET },
    {
      label: 'Secondary contact',
      name: has(secondaryName) ? secondaryName! : null,
      url: null,
      unavailableReason: has(secondaryName) ? NOT_SAVED_YET : NO_SECONDARY_CONTACT,
    },
  ];
}

/**
 * Build the popover rows from a contract's client signers, in signing order.
 *
 * @param signers - the contract's signer rows, already ordered by `signing_order`
 * @param origin  - `window.location.origin`; passed in so this stays pure
 */
export function signerLinks(signers: readonly SignerRow[], origin: string): SignerLink[] {
  const clients = signers.filter((s) => s.role === 'client');
  const url = (s: SignerRow | undefined) => (s ? `${origin}/contract/${s.sign_token}` : null);
  const [primary, secondary] = clients;
  return [
    { label: 'Primary contact', name: primary?.name ?? null, url: url(primary) },
    {
      label: 'Secondary contact',
      name: secondary?.name ?? null,
      url: url(secondary),
      ...(secondary ? {} : { unavailableReason: NO_SECONDARY_CONTACT }),
    },
  ];
}
