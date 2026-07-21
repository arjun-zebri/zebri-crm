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
import { applyCase, cssTextTransform } from '@/lib/branding/text-case';
import { FONT_STACKS } from '@/lib/branding/fonts';
import { Html } from '@/lib/branding/public-blocks/html';
import { DENSITY_PAD } from '@/lib/branding/public-surface';
import { roleDefaults } from '@/lib/branding/type-defaults';

import { ContractBodySection } from './contract-body-section';
import { formatDate, type PageState, type PublicContract } from './public-contract';

export interface ContractFallbackCardProps {
  contract: PublicContract;
  pageState: PageState;
  textColor: string;
  mutedColor: string;
  brand: string;
  radius: number;
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
  headingWeight,
  bodyTrailing,
}: ContractFallbackCardProps) {
  const pad = DENSITY_PAD[contract.density ?? 'cozy'];
  const brandText = getTextColor(brand);

  // Resolve type roles for the hero header
  const labelDefaults = roleDefaults(contract, 'sectionLabel');
  const titleDefaults = roleDefaults(contract, 'docTitle');
  const bodyDefaults = roleDefaults(contract, 'body');

  return (
    <div
      className="border overflow-hidden shadow-sm"
      style={{
        backgroundColor: contract.surface_color,
        borderRadius: radius,
        borderColor: contract.border_color,
      }}
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
              className="h-10 w-10 object-cover"
              style={{ borderRadius: Math.min(radius, 12), backgroundColor: contract.surface_color }}
            />
          ) : null}
          <div className="min-w-0">
            <p
              className="truncate"
              style={{
                color: brandText,
                fontFamily: FONT_STACKS[labelDefaults.fontFamily as never],
                fontSize: `${labelDefaults.fontSize}px`,
                fontWeight: labelDefaults.fontWeight,
              }}
            >
              {contract.business_name ? (
                <Html value={contract.business_name} allowLists={false} />
              ) : (
                'Your MC'
              )}
            </p>
            {contract.tagline ? (
              <p
                className="truncate"
                style={{
                  color: brandText,
                  opacity: 0.8,
                  fontSize: `${Math.round(labelDefaults.fontSize * 0.875)}px`,
                }}
              >
                <Html value={contract.tagline} allowLists={false} />
              </p>
            ) : null}
          </div>
        </div>
        <p
          className="mb-1"
          style={{
            color: brandText,
            fontFamily: FONT_STACKS[labelDefaults.fontFamily as never],
            fontSize: `${labelDefaults.fontSize}px`,
            fontWeight: labelDefaults.fontWeight,
            letterSpacing: labelDefaults.letterSpacing,
            textTransform: cssTextTransform(labelDefaults.textTransform),
          }}
        >
          {applyCase(`Contract ${contract.contract_number}`, labelDefaults.textTransform)}
        </p>
        <h1
          style={{
            color: brandText,
            fontFamily: FONT_STACKS[titleDefaults.fontFamily as never],
            fontSize: `${titleDefaults.fontSize}px`,
            fontWeight: headingWeight,
            lineHeight: titleDefaults.lineHeight,
          }}
        >
          {contract.title}
        </h1>
        {contract.expires_at && pageState === 'active' ? (
          <p
            className="mt-3"
            style={{
              color: brandText,
              opacity: 0.9,
              fontSize: `${bodyDefaults.fontSize}px`,
              fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
              lineHeight: bodyDefaults.lineHeight,
            }}
          >
            Please sign by <strong>{formatDate(contract.expires_at)}</strong>
          </p>
        ) : null}
      </div>

      {/* Body */}
      <div
        className={`${pad.cardSection} space-y-8 border-t`}
        style={{ borderTopColor: contract.border_color }}
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
            className="pt-6 space-y-0.5"
            style={{
              borderTopColor: contract.border_color,
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              color: mutedColor,
              fontSize: `${roleDefaults(contract, 'finePrint').fontSize}px`,
            }}
          >
            {contract.phone ? <p>{contract.phone}</p> : null}
            {contract.website ? <p>{contract.website}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
