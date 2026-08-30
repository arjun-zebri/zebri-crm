/**
 * Signing progress for a multi-party contract.
 *
 * A contract can require both partners (and the supplier). Without this the
 * page gave no sign that anyone else was involved, so a partner who signed
 * could not tell whether the agreement was done or still waiting on someone.
 *
 * @module app/contract/[token]/_components/contract-signers-list
 */
import { Check, Clock, X } from 'lucide-react';

import { FONT_STACKS } from '@/lib/branding/fonts';
import { roleDefaults } from '@/lib/branding/type-defaults';

import { formatDate, type ContractSigner, type PublicContract } from './public-contract';

export interface ContractSignersListProps {
  contract: PublicContract;
  textColor: string;
  mutedColor: string;
}

/** Status glyph + wording for one signer. */
function signerState(signer: ContractSigner): {
  icon: typeof Check;
  label: string;
  done: boolean;
} {
  if (signer.declined_at) {
    return { icon: X, label: `Declined ${formatDate(signer.declined_at)}`, done: true };
  }
  if (signer.signed_at) {
    return { icon: Check, label: `Signed ${formatDate(signer.signed_at)}`, done: true };
  }
  return { icon: Clock, label: 'Awaiting signature', done: false };
}

/**
 * Lists every party on the contract and whether they have signed.
 *
 * Renders nothing for a single-signer contract, where the roster would just
 * repeat what the signature block already says.
 */
export function ContractSignersList({
  contract,
  textColor,
  mutedColor,
}: ContractSignersListProps) {
  const signers = contract.signers ?? [];
  if (signers.length < 2) return null;

  const labelDefaults = roleDefaults(contract, 'sectionLabel');
  const bodyDefaults = roleDefaults(contract, 'finePrint');

  return (
    <div className="border-t pt-6" style={{ borderTopColor: contract.border_color }}>
      <p
        className="mb-3"
        style={{
          color: mutedColor,
          fontSize: `${labelDefaults.fontSize}px`,
          fontFamily: FONT_STACKS[labelDefaults.fontFamily as never],
          fontWeight: labelDefaults.fontWeight,
        }}
      >
        Signatures
      </p>
      <ul className="flex flex-col gap-2">
        {signers.map((signer) => {
          const { icon: Icon, label, done } = signerState(signer);
          const isViewer = signer.id === contract.viewer_signer_id;
          return (
            <li key={signer.id} className="flex items-center gap-2.5">
              <Icon
                size={15}
                strokeWidth={1.5}
                style={{ color: done ? textColor : mutedColor }}
                className="shrink-0"
              />
              <span
                style={{
                  color: textColor,
                  fontSize: `${bodyDefaults.fontSize}px`,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                }}
              >
                {signer.name}
                {isViewer ? ' (you)' : ''}
              </span>
              <span
                style={{
                  color: mutedColor,
                  fontSize: `${bodyDefaults.fontSize}px`,
                  fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
                }}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
