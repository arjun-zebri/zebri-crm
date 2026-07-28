/**
 * Branded-card variant — rendered when the MC has a customised
 * block tree on `contract.branding_blocks`. The block tree wraps
 * the contract body: pre-marker blocks render above (logo, business
 * name, title chrome), the locked HTML + MC signature live in the
 * middle, and any post-marker blocks render below.
 *
 * The "couplePortal" / "paymentSchedule" pattern carries over —
 * contracts split at the `contractBody` marker block; if no marker
 * exists (legacy data), all blocks render as pre-blocks and the
 * body section appears after.
 *
 * The action row (sign/decline form, decline dialog) is the
 * caller's responsibility — this card just renders chrome.
 *
 * @module app/contract/[token]/_components/contract-branded-card
 */
import { PublicBlockRenderer } from '@/lib/branding/public-renderer';
import { DENSITY_PAD } from '@/lib/branding/public-surface';

import { ContractBodySection } from './contract-body-section';
import type { PageState, PublicContract } from './public-contract';

export interface ContractBrandedCardProps {
  contract: PublicContract;
  /** Reserved for variant-specific behaviour. Currently unused by
   *  the branded card — the block-tree handles its own state-aware
   *  visibility via the renderer — but kept on the API so the
   *  branded/fallback signatures stay symmetric. */
  pageState: PageState;
  textColor: string;
  mutedColor: string;
  radius: number;
  /** Slot for the sign/decline form + any status banners — rendered
   *  inside the body section, between the body and any post-marker
   *  blocks. */
  bodyTrailing?: React.ReactNode;
}

export function ContractBrandedCard({
  contract,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pageState,
  textColor,
  mutedColor,
  radius,
  bodyTrailing,
}: ContractBrandedCardProps) {
  const pad = DENSITY_PAD[contract.density ?? 'cozy'];
  const allBlocks = contract.branding_blocks ?? [];
  const bodyMarkerIndex = allBlocks.findIndex(
    (b) => b.type === 'contractBody',
  );
  const preBlocks =
    bodyMarkerIndex >= 0 ? allBlocks.slice(0, bodyMarkerIndex) : allBlocks;
  const postBlocks =
    bodyMarkerIndex >= 0 ? allBlocks.slice(bodyMarkerIndex + 1) : [];

  return (
    <div
      className="shadow-sm border overflow-hidden"
      style={{
        backgroundColor: contract.surface_color,
        borderRadius: radius,
        borderColor: contract.border_color,
      }}
    >
      {preBlocks.length > 0 ? (
        <PublicBlockRenderer
          blocks={preBlocks}
          branding={contract}
          doc={{
            title: contract.title,
            refNumber: contract.contract_number,
            coupleName: contract.couple_name,
            eventDate: contract.event_date,
            venue: contract.venue,
            expiresAt: contract.expires_at,
            items: [],
            subtotal: 0,
            taxRate: 0,
          }}
          hideAction
        />
      ) : null}

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
      </div>

      {postBlocks.length > 0 ? (
        <PublicBlockRenderer
          blocks={postBlocks}
          branding={contract}
          doc={{
            title: contract.title,
            refNumber: contract.contract_number,
            coupleName: contract.couple_name,
            eventDate: contract.event_date,
            venue: contract.venue,
            expiresAt: contract.expires_at,
            items: [],
            subtotal: 0,
            taxRate: 0,
          }}
          hideAction
        />
      ) : null}
    </div>
  );
}
