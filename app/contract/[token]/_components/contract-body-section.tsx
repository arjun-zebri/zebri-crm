/**
 * Shared "contract body + MC signature" section, rendered identically
 * in both the branded and fallback card variants.
 *
 * The contract body is a server-rendered HTML string (the locked
 * snapshot taken at send-time, with all `{{variable}}` substitution
 * applied). We use the `.contract-content` class so the editor,
 * preview pane, and public surface all render identical typography.
 *
 * @module app/contract/[token]/_components/contract-body-section
 */
import { FONT_STACKS } from '@/lib/branding/fonts';
import { htmlToPlainText } from '@/lib/branding/sanitize';
import { roleDefaults } from '@/lib/branding/type-defaults';

import { formatDate, type PublicContract } from './public-contract';

export interface ContractBodySectionProps {
  contract: PublicContract;
  textColor: string;
  mutedColor: string;
}

export function ContractBodySection({
  contract,
  textColor,
  mutedColor,
}: ContractBodySectionProps) {
  const bodyDefaults = roleDefaults(contract, 'body');
  const labelDefaults = roleDefaults(contract, 'sectionLabel');
  const finePrintDefaults = roleDefaults(contract, 'finePrint');

  return (
    <div className="space-y-8">
      {contract.locked_content_html ? (
        <div
          className="contract-content"
          style={{
            color: textColor,
            fontSize: `${bodyDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
            lineHeight: bodyDefaults.lineHeight,
          }}
          // The HTML is generated server-side from a TipTap document
          // and sanitised by the renderer — safe to inject.
          dangerouslySetInnerHTML={{ __html: contract.locked_content_html }}
        />
      ) : (
        <p
          style={{
            color: mutedColor,
            fontSize: `${bodyDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
            lineHeight: bodyDefaults.lineHeight,
          }}
        >
          No content.
        </p>
      )}

      {/* MC countersignature. Stays visible across all states; the
          MC effectively signs the moment the contract is sent. */}
      <div className="border-t pt-6" style={{ borderTopColor: contract.border_color }}>
        <p
          className="mb-1"
          style={{
            color: mutedColor,
            fontSize: `${labelDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[labelDefaults.fontFamily as never],
            fontWeight: labelDefaults.fontWeight,
          }}
        >
          Signed by MC
        </p>
        <p
          style={{
            color: textColor,
            fontSize: `${roleDefaults(contract, 'sectionHeading').fontSize}px`,
            fontFamily: 'Caveat, "Brush Script MT", cursive',
            lineHeight: roleDefaults(contract, 'sectionHeading').lineHeight,
          }}
        >
          {contract.mc_signature_name ||
            htmlToPlainText(contract.business_name) ||
            'Your MC'}
        </p>
        <p
          className="mt-1"
          style={{
            color: mutedColor,
            fontSize: `${finePrintDefaults.fontSize}px`,
            fontFamily: FONT_STACKS[finePrintDefaults.fontFamily as never],
            lineHeight: finePrintDefaults.lineHeight,
          }}
        >
          {htmlToPlainText(contract.business_name) || ''} ·{' '}
          {formatDate(contract.email_sent_at)}
        </p>
      </div>
    </div>
  );
}
