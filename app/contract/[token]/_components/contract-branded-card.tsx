/**
 * Branded-card variant — rendered when the MC has a customised
 * block tree on `contract.branding_blocks`. The block tree wraps
 * the contract body + sign form: chrome blocks render above / below /
 * between the markers, the locked HTML body renders at the
 * `contractBody` marker, and the sign / decline form + MC
 * countersignature render at the `contractSign` marker.
 *
 * Two-marker split: blocks render in their saved order, with the body
 * section injected at the `contractBody` marker and the sign slot at
 * the `contractSign` marker, so the MC's arrangement is respected.
 *
 * Legacy fallback (critical): contracts sent before the sign block
 * existed carry a `contractBody` marker but NO `contractSign` marker.
 * For those, the sign slot is injected right after the body section in
 * the same card section — exactly today's placement — so they render
 * identically and stay signable. A tree with no `contractBody` marker
 * (very old / fully cleared) still falls back to the body section after
 * all chrome.
 *
 * @module app/contract/[token]/_components/contract-branded-card
 */
import type { ReactNode } from 'react';

import type { Block } from '@/app/(dashboard)/branding/blocks/types';
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
  /** Sign/decline form + MC countersignature (see ContractSignSection).
   *  Rendered at the `contractSign` marker, or — on legacy contracts with no
   *  such marker — right after the body section. */
  signSlot?: ReactNode;
}

export function ContractBrandedCard({
  contract,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pageState,
  textColor,
  mutedColor,
  radius,
  signSlot,
}: ContractBrandedCardProps) {
  const pad = DENSITY_PAD[contract.density ?? 'cozy'];
  const allBlocks = contract.branding_blocks ?? [];
  const bodyMarkerIndex = allBlocks.findIndex((b) => b.type === 'contractBody');
  const signMarkerIndex = allBlocks.findIndex((b) => b.type === 'contractSign');

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

  const chrome = (blocks: Block[], key: string): ReactNode =>
    blocks.length > 0 ? (
      <PublicBlockRenderer key={key} blocks={blocks} branding={contract} doc={doc} hideAction />
    ) : null;

  const bodySection = (
    <ContractBodySection contract={contract} textColor={textColor} mutedColor={mutedColor} />
  );

  const section = (children: ReactNode, key: string, spaced = false): ReactNode => (
    <div
      key={key}
      className={`${pad.cardSection} ${spaced ? 'space-y-8 ' : ''}border-t`}
      style={{ borderTopColor: contract.border_color }}
    >
      {children}
    </div>
  );

  let inner: ReactNode;

  if (bodyMarkerIndex >= 0 && signMarkerIndex >= 0) {
    // Both markers present — walk the tree, flushing chrome runs and injecting
    // each marker's content at its position so the MC's arrangement is honoured.
    const nodes: ReactNode[] = [];
    let buffer: Block[] = [];
    let bufKey = 0;
    const flush = () => {
      if (buffer.length > 0) {
        nodes.push(chrome(buffer, `chrome-${bufKey++}`));
        buffer = [];
      }
    };
    for (const b of allBlocks) {
      if (b.type === 'contractBody') {
        flush();
        nodes.push(section(bodySection, 'body'));
      } else if (b.type === 'contractSign') {
        flush();
        nodes.push(section(signSlot, 'sign'));
      } else {
        buffer.push(b);
      }
    }
    flush();
    inner = nodes;
  } else if (bodyMarkerIndex >= 0) {
    // Legacy: body marker only. Inject the sign slot right after the body
    // section, in the same card section — today's exact placement.
    const preBlocks = allBlocks.slice(0, bodyMarkerIndex);
    const postBlocks = allBlocks.slice(bodyMarkerIndex + 1);
    inner = (
      <>
        {chrome(preBlocks, 'pre')}
        {section(
          <>
            {bodySection}
            {signSlot}
          </>,
          'body',
          true,
        )}
        {chrome(postBlocks, 'post')}
      </>
    );
  } else {
    // No body marker (very old / fully cleared) — render all chrome, then the
    // body section fallback followed by the sign slot.
    inner = (
      <>
        {chrome(allBlocks, 'all')}
        {section(
          <>
            {bodySection}
            {signSlot}
          </>,
          'body',
          true,
        )}
      </>
    );
  }

  return (
    <div
      className="shadow-sm border overflow-hidden"
      style={{
        backgroundColor: contract.surface_color,
        borderRadius: radius,
        borderColor: contract.border_color,
      }}
    >
      {inner}
    </div>
  );
}
