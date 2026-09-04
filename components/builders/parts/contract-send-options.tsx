/**
 * The two signing-protocol choices an MC makes before sending a contract:
 * whether partners sign in order, and whether each must verify an emailed code.
 *
 * Both default to the historical behaviour (anyone signs any time, no code), so
 * an MC who never opens this sends exactly what they always sent.
 *
 * Both lock once the contract leaves draft. Changing the protocol underneath
 * someone who has already been invited is unfair and confusing: a signer told
 * to go ahead would suddenly be held, or a link already in an inbox would start
 * demanding a code the signer never received.
 *
 * @module components/builders/parts/contract-send-options
 */
'use client';

import { Toggle } from '@/components/ui/toggle';

export interface ContractSendOptionsProps {
  /** 'sequential' holds each partner until the one before has signed. */
  signingMode: 'parallel' | 'sequential';
  onSigningModeChange: (next: 'parallel' | 'sequential') => void;
  /** Require an emailed one-time code before a client signer can sign. */
  requireOtp: boolean;
  onRequireOtpChange: (next: boolean) => void;
  /** False once the contract has been sent; both controls lock. */
  canEdit: boolean;
  /** Hide the ordering control when there is only one person to sign. */
  multipleSigners: boolean;
}

export function ContractSendOptions({
  signingMode,
  onSigningModeChange,
  requireOtp,
  onRequireOtpChange,
  canEdit,
  multipleSigners,
}: ContractSendOptionsProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">
        Signing
      </h4>

      {/* Ordering is meaningless with a single signatory, so it is not offered
          rather than shown disabled with no explanation. */}
      {multipleSigners ? (
        <Toggle
          checked={signingMode === 'sequential'}
          onChange={(next) => onSigningModeChange(next ? 'sequential' : 'parallel')}
          disabled={!canEdit}
          label="Sign in order"
          description={
            signingMode === 'sequential'
              ? "The second partner is invited once the first has signed."
              : 'Both partners can sign whenever they like.'
          }
        />
      ) : null}

      <Toggle
        checked={requireOtp}
        onChange={onRequireOtpChange}
        disabled={!canEdit}
        label="Require an email code"
        description={
          requireOtp
            ? 'Each signer enters a 6-digit code emailed to them before they can sign.'
            : 'Signers go straight to the contract from their link.'
        }
      />
    </div>
  );
}
