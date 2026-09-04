/**
 * Mapping the three signature blocks onto the contract's actual signers.
 *
 * The branding editor speaks in fixed roles ("you", "partner 1", "partner 2")
 * because the MC is designing a template before any particular couple exists.
 * The contract speaks in `contract_signers` rows. This module is the join.
 *
 * Kept React-free and pure so the mapping can be unit-tested directly: it
 * decides who appears where on a legal document, which is not something to
 * verify only by looking at a rendered page.
 *
 * @module app/contract/[token]/_components/contract-parties
 */
import type { ContractSigner, PublicContract } from './public-contract';

/** The three party slots a contract's signature blocks can address. */
export type SignParty = 'vendor' | 'primary' | 'secondary';

/** Block types that mark a party slot, in the same order as {@link SignParty}. */
export const PARTY_BLOCK_TYPES = {
  contractSignVendor: 'vendor',
  contractSignPrimary: 'primary',
  contractSignSecondary: 'secondary',
} as const satisfies Record<string, SignParty>;

/**
 * The signer occupying a party slot, or null when the contract has no such
 * party.
 *
 * A couple with one named contact has no secondary signer, and the panel for
 * that slot renders nothing rather than an empty signature line. The supplier
 * row is created at send time, so it is also absent on a draft.
 *
 * Client signers are ordered by `signing_order` (1 = primary, 2 = secondary),
 * which is the order `get_public_contract` returns them in; the sort here makes
 * that independent of the payload rather than assuming it.
 *
 * @param contract - The public contract payload.
 * @param party - Which slot to resolve.
 */
export function partySigner(
  contract: PublicContract | null,
  party: SignParty,
): ContractSigner | null {
  const signers = contract?.signers ?? [];
  if (party === 'vendor') {
    return signers.find((s) => s.role === 'vendor') ?? null;
  }
  const clients = signers
    .filter((s) => s.role === 'client')
    .slice()
    .sort((a, b) => a.signing_order - b.signing_order);
  return (party === 'primary' ? clients[0] : clients[1]) ?? null;
}

/**
 * True when this party's panel belongs to the person holding the current link,
 * i.e. the one who should see the sign form.
 */
export function isViewer(contract: PublicContract | null, signer: ContractSigner | null): boolean {
  if (!contract?.viewer_signer_id || !signer) return false;
  return signer.id === contract.viewer_signer_id;
}

/** How far along one party is. Drives the panel's status line and glyph. */
export type PartyState = 'signed' | 'declined' | 'awaiting';

/** Resolve a signer's state. */
export function partyState(signer: ContractSigner): PartyState {
  if (signer.declined_at) return 'declined';
  if (signer.signed_at) return 'signed';
  return 'awaiting';
}

/**
 * Whether it is this signer's turn to sign.
 *
 * Always true on a parallel contract (the default), which is every contract
 * created before the signing-order toggle existed. On a sequential contract a
 * client signer waits for every required client ahead of them; a signer who
 * declined does not block the queue, since the contract is over anyway. The
 * supplier is exempt: they sign at `signing_order` 0 by sending.
 *
 * This mirrors the predicate in `sign_contract_v2`. The database is the
 * authority. This exists so the page can explain the wait instead of
 * offering a form the RPC would reject.
 *
 * @param contract - The public contract payload.
 * @param signer - The signer whose turn is in question.
 */
export function isMyTurn(
  contract: PublicContract | null,
  signer: ContractSigner | null,
): boolean {
  if (!signer) return false;
  if (contract?.signing_mode !== 'sequential') return true;
  if (signer.role === 'vendor') return true;
  return !(contract.signers ?? []).some(
    (s) =>
      s.role === 'client' &&
      s.required &&
      !s.signed_at &&
      !s.declined_at &&
      s.signing_order < signer.signing_order,
  );
}

/**
 * Required client signers ahead of this one who have not signed yet. Drives the
 * "Sarah signs first" copy.
 */
export function signersAhead(
  contract: PublicContract | null,
  signer: ContractSigner | null,
): ContractSigner[] {
  if (!signer || contract?.signing_mode !== 'sequential') return [];
  return (contract.signers ?? []).filter(
    (s) =>
      s.role === 'client' &&
      s.required &&
      !s.signed_at &&
      !s.declined_at &&
      s.signing_order < signer.signing_order,
  );
}

/**
 * The mark to print for a signer: what they actually typed, falling back to the
 * roster name.
 *
 * The distinction matters on a signature line. The roster carries the name the
 * MC entered ("Sarah"); `signer_name_typed` is what the signer themselves
 * entered ("Sarah Ellen Mitchell"). Printing the roster name in a signature
 * slot would show a mark the person never made, so the typed name wins wherever
 * it exists.
 */
export function signatureText(signer: ContractSigner): string {
  return signer.signer_name_typed?.trim() || signer.name;
}
