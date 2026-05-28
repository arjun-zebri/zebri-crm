/**
 * Fallback-card variant — used when the MC hasn't customised the
 * contract block tree. Renders the legacy hero header (brand-colour
 * band with logo + business name + contract number + title), then
 * the locked HTML body + MC signature, then the sign/decline slot
 * passed in by the caller.
 *
 * This is the path most contracts will take until the MC opens the
 * branding editor — the block-tree variant kicks in for users who
 * customise.
 *
 * @module app/contract/[token]/_components/contract-fallback-card
 */
import { getTextColor } from '@/lib/branding/contrast';
import { Html } from '@/lib/branding/public-blocks/html';
import { DENSITY_PAD } from '@/lib/branding/public-surface';

import { ContractBodySection } from './contract-body-section';
import { formatDate, type PageState, type PublicContract } from './public-contract';

export interface ContractFallbackCardProps {
  contract: PublicContract;
  pageState: PageState;
  textColor: string;
  mutedColor: string;
  brand: string;
  radius: number;
  headingStack?: string | undefined;
  headingWeight: number;
  /** Sign/decline form + any status banners — placed under the body. */
  bodyTrailing?: React.ReactNode;
}

export function ContractFallbackCard({
  contract,
  pageState,
  textColor,
  mutedColor,
  brand,
  radius,
  headingStack,
  headingWeight,
  bodyTrailing,
}: ContractFallbackCardProps) {
  const pad = DENSITY_PAD[contract.density ?? 'cozy'];
  const brandText = getTextColor(brand);

  return (
    <div
      className="bg-surface border border-border overflow-hidden shadow-sm"
      style={{ borderRadius: radius }}
    >
      {/* Branded hero header band */}
      <div
        className={pad.cardHeader}
        style={{ backgroundColor: brand, color: brandText }}
      >
        <div className="flex items-center gap-3 mb-4">
          {contract.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contract.logo_url}
              alt=""
              className="h-10 w-10 object-cover bg-white"
              style={{ borderRadius: Math.min(radius, 12) }}
            />
          ) : null}
          <div className="min-w-0">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: brandText, fontFamily: headingStack }}
            >
              {contract.business_name ? (
                <Html value={contract.business_name} allowLists={false} />
              ) : (
                'Your MC'
              )}
            </p>
            {contract.tagline ? (
              <p
                className="text-xs opacity-80 truncate"
                style={{ color: brandText }}
              >
                <Html value={contract.tagline} allowLists={false} />
              </p>
            ) : null}
          </div>
        </div>
        <p
          className="text-xs font-medium opacity-75 uppercase tracking-wide mb-1"
          style={{ color: brandText }}
        >
          Contract {contract.contract_number}
        </p>
        <h1
          className="text-2xl sm:text-3xl"
          style={{
            color: brandText,
            fontFamily: headingStack,
            fontWeight: headingWeight,
          }}
        >
          {contract.title}
        </h1>
        {contract.expires_at && pageState === 'active' ? (
          <p
            className="mt-3 text-sm opacity-90"
            style={{ color: brandText }}
          >
            Please sign by <strong>{formatDate(contract.expires_at)}</strong>
          </p>
        ) : null}
      </div>

      {/* Body */}
      <div
        className={`${pad.cardSection} space-y-8 border-t border-border`}
      >
        <ContractBodySection
          contract={contract}
          textColor={textColor}
          mutedColor={mutedColor}
        />
        {bodyTrailing}

        {contract.show_contact_on_documents &&
        (contract.phone || contract.website) ? (
          <div
            className="border-t border-border pt-6 text-xs space-y-0.5"
            style={{ color: mutedColor }}
          >
            {contract.phone ? <p>{contract.phone}</p> : null}
            {contract.website ? <p>{contract.website}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
