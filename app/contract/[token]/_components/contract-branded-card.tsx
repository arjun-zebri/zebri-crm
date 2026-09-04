/**
 * Branded-card variant — rendered when the MC has a customised block tree on
 * `contract.branding_blocks`. Chrome blocks render above / below / between the
 * markers, the locked HTML body renders at the `contractBody` marker, and the
 * signature content renders at each signature marker.
 *
 * The ordering decision lives in `contract-card-layout`, which is pure and
 * tested; this component only turns its nodes into sections. In particular, see
 * that module for why BOTH the deprecated all-in-one `contractSign` block and
 * the three per-party blocks are supported rather than one being migrated into
 * the other.
 *
 * @module app/contract/[token]/_components/contract-branded-card
 */
import type { ReactNode } from 'react';

import { PublicBlockRenderer } from '@/lib/branding/public-renderer';
import { DENSITY_PAD } from '@/lib/branding/public-surface';

import { ContractBodySection } from './contract-body-section';
import { layoutContractCard } from './contract-card-layout';
import { partySigner, type SignParty } from './contract-parties';
import type { PageState, PublicContract } from './public-contract';

export interface ContractBrandedCardProps {
  contract: PublicContract;
  /** Reserved for variant-specific behaviour; the block tree handles its own
   *  state-aware visibility via the renderer. Kept so the branded/fallback
   *  signatures stay symmetric. */
  pageState: PageState;
  textColor: string;
  mutedColor: string;
  radius: number;
  /**
   * The legacy all-in-one sign section (MC countersignature + roster + form).
   * Rendered at a `contractSign` marker, or as the fallback when a tree has no
   * signature marker at all.
   */
  signSlot?: ReactNode;
  /**
   * One party's signature panel. Called per per-party marker. Absent when the
   * caller only supports the legacy slot (the print element passes both).
   */
  signSlotFor?: (party: SignParty) => ReactNode;
  /**
   * Document-level status banner (signed / declined / expired + the PDF
   * download). Rendered once, above the first signature panel. Only used in
   * per-party mode: the legacy section carries its own banner.
   */
  statusBanner?: ReactNode;
}

export function ContractBrandedCard({
  contract,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pageState,
  textColor,
  mutedColor,
  radius,
  signSlot,
  signSlotFor,
  statusBanner,
}: ContractBrandedCardProps) {
  const pad = DENSITY_PAD[contract.density ?? 'cozy'];
  // A contract with no signer rows predates `contract_signers`; its signature
  // lives in the denormalised columns the legacy section reads, so the layout
  // falls back rather than rendering empty per-party panels.
  const nodes = layoutContractCard(
    contract.branding_blocks ?? [],
    (contract.signers?.length ?? 0) > 0,
  );

  const doc = {
    title: contract.title,
    refNumber: contract.contract_number,
    coupleName: contract.couple_name,
    eventDate: contract.event_date,
    venue: contract.venue,
    expiresAt: contract.expires_at,
    items: [],
    subtotal: 0,
    taxRate: 0,
  };

  const section = (children: ReactNode, key: string): ReactNode => (
    <div
      key={key}
      className={`${pad.cardSection} border-t`}
      style={{ borderTopColor: contract.border_color }}
    >
      {children}
    </div>
  );

  const inner = nodes.map((node, i) => {
    switch (node.kind) {
      case 'chrome':
        return (
          <PublicBlockRenderer
            key={`chrome-${i}`}
            blocks={node.blocks}
            branding={contract}
            doc={doc}
            hideAction
          />
        );
      case 'body':
        return section(
          <ContractBodySection
            contract={contract}
            textColor={textColor}
            mutedColor={mutedColor}
          />,
          `body-${i}`,
        );
      case 'sign-legacy':
        return section(signSlot, `sign-${i}`);
      case 'sign-party': {
        const banner = node.first && statusBanner ? statusBanner : null;
        // Ask the DATA whether this party exists, not the element: the slot
        // returns a component that renders null, which is still truthy. A
        // couple with one named contact has no secondary signer, and without
        // this the section wrapper drew its padding and top border anyway,
        // leaving an empty bordered box where the second signature would go.
        if (!partySigner(contract, node.party) && !banner) return null;
        return section(
          <>
            {banner ? <div className="mb-6">{banner}</div> : null}
            {signSlotFor?.(node.party)}
          </>,
          `sign-${node.party}-${i}`,
        );
      }
    }
  });

  return (
    <div
      className="overflow-hidden"
      style={{
        backgroundColor: contract.surface_color,
        borderRadius: radius,
      }}
    >
      {inner}
    </div>
  );
}
