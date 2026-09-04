/**
 * Shared types + pure helpers for the public-contract surface.
 *
 * Mirrors `app/invoice/[token]/_components/public-invoice.ts`. The shape
 * is the JSONB payload from `get_public_contract(token)`.
 *
 * @module app/contract/[token]/_components/public-contract
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types';
import type { PublicBranding } from '@/lib/branding/public-surface';
import { isPastDue } from '@/lib/utils';

export interface PublicContract extends PublicBranding {
  id: string;
  title: string;
  contract_number: string;
  status: string;
  locked_content_html: string | null;
  expires_at: string | null;
  signed_at: string | null;
  signer_name: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  mc_signature_name: string | null;
  email_sent_at: string | null;
  couple_name: string;
  event_date: string | null;
  venue: string | null;
  branding_blocks: Block[] | null;
  /** Everyone who must sign. Never carries sign tokens. */
  signers: ContractSigner[];
  /** Which signer opened this link; null on a legacy share link. */
  viewer_signer_id: string | null;
  /**
   * 'sequential' holds each client signer until every lower `signing_order`
   * client has signed. Absent on payloads predating the toggle, which means
   * parallel.
   */
  signing_mode?: 'parallel' | 'sequential' | null;
  /** Whether a client signer must verify an emailed code before signing. */
  require_signer_otp?: boolean | null;
  /**
   * Whether THIS link's signer has verified recently enough to sign. Computed
   * for the viewer only: other signers' verification state is not the link
   * holder's business.
   */
  viewer_otp_verified?: boolean | null;
  /**
   * Every audit event on the contract, present ONLY once it reaches a final
   * status. IPs in it are network prefixes, never full addresses.
   */
  audit_trail?: unknown[] | null;
  /** Hex SHA-256 over the executed facts. Set at completion. */
  document_hash?: string | null;
  document_hash_algo?: string | null;
  document_hash_at?: string | null;
}

/** One party on a contract, as returned by `get_public_contract`. */
export interface ContractSigner {
  id: string;
  role: 'client' | 'vendor';
  name: string;
  /**
   * The name this signer actually typed when signing. Null until they sign.
   * Distinct from `name`, which is the roster name the MC entered beforehand;
   * a signature line must print the mark the person made, not the label.
   */
  signer_name_typed?: string | null;
  /** How they signed. Absent on payloads predating drawn signatures. */
  signature_mode?: 'typed' | 'drawn' | null;
  /** The drawn mark as a PNG data URL, when signature_mode is 'drawn'. */
  signature_image?: string | null;
  signing_order: number;
  required: boolean;
  signed_at: string | null;
  declined_at: string | null;
}

/**
 * The signer whose link this is.
 *
 * @returns The viewer's signer row, or null on a legacy share link (or once
 * every signer is done).
 */
export function viewerSigner(contract: PublicContract | null): ContractSigner | null {
  if (!contract?.viewer_signer_id) return null;
  return contract.signers?.find((s) => s.id === contract.viewer_signer_id) ?? null;
}

/**
 * Required signers who have not signed yet, excluding the viewer.
 *
 * Drives the "waiting on Alex" line after one partner signs, so nobody is left
 * wondering whether their signature registered.
 */
export function outstandingSigners(contract: PublicContract | null): ContractSigner[] {
  if (!contract) return [];
  return (contract.signers ?? []).filter(
    (s) => s.required && !s.signed_at && !s.declined_at && s.id !== contract.viewer_signer_id,
  );
}

/**
 * Page-state machine. Derived from the contract's `status` field +
 * the current date relative to `expires_at`. The `loading` and
 * `not_found` states are owned by the orchestrator, not the
 * contract row.
 */
export type PageState =
  | 'loading'
  | 'not_found'
  | 'active'
  | 'expired'
  | 'signed'
  | 'declined';

export function deriveState(contract: PublicContract | null): PageState {
  if (!contract) return 'not_found';
  if (contract.status === 'signed') return 'signed';
  if (contract.status === 'declined') return 'declined';
  if (isPastDue(contract.expires_at)) {
    return 'expired';
  }
  return 'active';
}

export function formatDate(s: string | null): string {
  if (!s) return '-';
  try {
    const iso = s.length === 10 ? s + 'T00:00:00' : s;
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return s;
  }
}

export function formatDateTime(s: string | null): string {
  if (!s) return '-';
  try {
    return new Date(s).toLocaleString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}
