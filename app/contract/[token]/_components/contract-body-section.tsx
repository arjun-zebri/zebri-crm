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
import { htmlToPlainText } from '@/lib/branding/sanitize';

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
  return (
    <div className="space-y-8">
      {contract.locked_content_html ? (
        <div
          className="contract-content text-sm"
          style={{ color: textColor }}
          // The HTML is generated server-side from a TipTap document
          // and sanitised by the renderer — safe to inject.
          dangerouslySetInnerHTML={{ __html: contract.locked_content_html }}
        />
      ) : (
        <p className="text-sm" style={{ color: mutedColor }}>
          No content.
        </p>
      )}

      {/* MC countersignature. Stays visible across all states; the
          MC effectively signs the moment the contract is sent. */}
      <div className="border-t border-border pt-6">
        <p className="text-xs font-medium mb-1" style={{ color: mutedColor }}>
          Signed by MC
        </p>
        <p
          className="text-xl"
          style={{
            color: textColor,
            fontFamily: 'Caveat, "Brush Script MT", cursive',
          }}
        >
          {contract.mc_signature_name ||
            htmlToPlainText(contract.business_name) ||
            'Your MC'}
        </p>
        <p className="text-xs mt-1" style={{ color: mutedColor }}>
          {htmlToPlainText(contract.business_name) || ''} ·{' '}
          {formatDate(contract.email_sent_at)}
        </p>
      </div>
    </div>
  );
}
