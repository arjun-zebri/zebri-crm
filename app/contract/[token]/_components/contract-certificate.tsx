/**
 * Certificate of completion for an executed contract.
 *
 * Renders only on a final status (`get_public_contract` withholds the trail
 * until then, so `audit_trail` is null while a contract is in flight).
 *
 * DELIBERATELY NOT A BRANDING BLOCK. Every other part of the document is the
 * MC's to arrange, restyle or delete. This is not: a certificate an interested
 * party can edit or remove is not evidence. It is appended after the card, in a
 * fixed shape, on every completed contract.
 *
 * It is also always expanded rather than behind a disclosure. A certificate
 * nobody finds does no good, and it only exists on completed contracts, so it
 * never clutters the signing flow.
 *
 * @module app/contract/[token]/_components/contract-certificate
 */
import { FONT_STACKS } from '@/lib/branding/fonts';
import { DENSITY_PAD } from '@/lib/branding/public-surface';
import { roleDefaults } from '@/lib/branding/type-defaults';
import { DEFAULT_VENDOR_ROLE } from '@/lib/branding/vendor-role';
import { formatFingerprint, type AuditTrailEvent } from '@/lib/contracts/audit-trail';

import { ContractCertificateEvents } from './contract-certificate-events';
import { formatDateTime, type PublicContract } from './public-contract';

export interface ContractCertificateProps {
  contract: PublicContract;
  textColor: string;
  mutedColor: string;
  radius: number;
}

export function ContractCertificate({
  contract,
  textColor,
  mutedColor,
  radius,
}: ContractCertificateProps) {
  const events = (contract.audit_trail ?? []) as AuditTrailEvent[];
  // Nothing to certify: an in-flight contract, or a payload from before the
  // trail was exposed.
  if (events.length === 0) return null;

  const pad = DENSITY_PAD[contract.density ?? 'cozy'];
  const headingDefaults = roleDefaults(contract, 'sectionHeading');
  const labelDefaults = roleDefaults(contract, 'sectionLabel');
  const fineDefaults = roleDefaults(contract, 'finePrint');
  const vendorRole = contract.vendor_role || DEFAULT_VENDOR_ROLE;

  const fineStyle = {
    color: mutedColor,
    fontSize: `${fineDefaults.fontSize}px`,
    fontFamily: FONT_STACKS[fineDefaults.fontFamily as never],
    lineHeight: fineDefaults.lineHeight,
  };

  return (
    // `certificate-page` gets a forced page break in the print stylesheet, so
    // the certificate starts on its own sheet rather than trailing the terms.
    <div
      className="certificate-page mt-6 overflow-hidden"
      style={{ backgroundColor: contract.surface_color, borderRadius: radius }}
    >
      <div className={pad.cardSection}>
        <p
          className="mb-1"
          style={{
            color: mutedColor,
            fontSize: `${labelDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[labelDefaults.fontFamily as never],
            fontWeight: labelDefaults.fontWeight,
          }}
        >
          Certificate of completion
        </p>
        <p
          style={{
            color: textColor,
            fontSize: `${headingDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[headingDefaults.fontFamily as never],
            lineHeight: headingDefaults.lineHeight,
          }}
        >
          {contract.contract_number}
        </p>

        <div className="mt-5">
          <ContractCertificateEvents
            contract={contract}
            events={events}
            vendorRole={vendorRole}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        </div>

        {contract.document_hash ? (
          <div
            className="mt-5 pt-4 border-t"
            style={{ borderTopColor: contract.border_color }}
          >
            <p className="mb-1" style={fineStyle}>
              Document fingerprint · {contract.document_hash_algo ?? 'sha-256'}
              {contract.document_hash_at
                ? ` · ${formatDateTime(contract.document_hash_at)}`
                : null}
            </p>
            <p
              className="break-all"
              style={{
                color: textColor,
                fontSize: `${fineDefaults.fontSize}px`,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                letterSpacing: '0.02em',
              }}
            >
              {formatFingerprint(contract.document_hash)}
            </p>
            {/* The recipe, in one sentence. Without it the value is
                unverifiable by construction and the fingerprint is decoration. */}
            <p className="mt-2" style={fineStyle}>
              SHA-256 of the agreement text plus each signer&apos;s name,
              signature and timestamp.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
