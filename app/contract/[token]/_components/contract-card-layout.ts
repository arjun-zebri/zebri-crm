/**
 * Deciding how a contract's block tree lays out around its injected content.
 *
 * The public card walks the MC's blocks and swaps each marker for real content:
 * the locked contract body at `contractBody`, and a signature panel at each
 * signature marker. Everything else is "chrome" (headings, text, dividers,
 * images) rendered by the generic block renderer in runs.
 *
 * This module is the decision, kept pure and React-free so it can be tested
 * directly. Which layout mode a tree is in governs whether an already-sent
 * contract still renders the way its signatories saw it, so it is not something
 * to verify only by eye.
 *
 * ## Why there are two signature modes
 *
 * Block trees are NOT snapshotted per contract: `get_public_contract` reads the
 * MC's live tree, so a contract sent months ago re-renders through whatever
 * their branding says today. That rules out silently migrating the deprecated
 * all-in-one `contractSign` block into the three per-party ones, because doing
 * so would restructure the signature section of every live contract the next
 * time anyone opened it.
 *
 * So both are supported, and the tree picks:
 *
 *  1. No signer rows at all         → legacy mode, whatever the blocks say.
 *     The per-party panels resolve their content from `contract_signers`, so
 *     a contract predating that table would render a blank signature page.
 *     The legacy section reads the denormalised `signer_name` /
 *     `mc_signature_name` columns instead and still shows the signature.
 *  2. Any per-party marker present  → per-party mode (a stray legacy marker is
 *     ignored, since the MC has clearly moved on).
 *  3. Otherwise a `contractSign`    → legacy mode, rendering the original
 *     stacked section untouched.
 *  4. Neither                       → the historical fallback: the sign slot
 *     goes immediately after the body.
 *
 * @module app/contract/[token]/_components/contract-card-layout
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types';

import { PARTY_BLOCK_TYPES, type SignParty } from './contract-parties';

/** Which signature arrangement a tree uses. See the module docs. */
export type SignMode = 'per-party' | 'legacy' | 'none';

/** One entry in the laid-out document, in render order. */
export type LayoutNode =
  | { kind: 'chrome'; blocks: Block[] }
  | { kind: 'body' }
  | { kind: 'sign-legacy' }
  | {
      kind: 'sign-party'
      party: SignParty
      block: Block
      /**
       * True for the first signature panel in the tree. The document-level
       * status banner (signed / declined / expired, and the PDF download)
       * belongs once per page, and this is where it goes: attaching it to the
       * first signature slot keeps it with the signatures without inventing a
       * position the MC did not choose.
       */
      first: boolean
    };

/** True for any of the three per-party signature markers. */
function partyOf(block: Block): SignParty | null {
  return (PARTY_BLOCK_TYPES as Record<string, SignParty | undefined>)[block.type] ?? null;
}

/**
 * Which signature mode a block tree is in.
 *
 * @param blocks - The contract surface's blocks, in saved order.
 * @param hasSigners - Whether the contract has any `contract_signers` rows.
 *   False forces legacy mode: per-party panels would have nobody to render,
 *   and a contract that displays no signature at all is worse than one whose
 *   signatures are stacked in the historical layout.
 */
export function signModeFor(blocks: readonly Block[], hasSigners = true): SignMode {
  if (!hasSigners) return 'legacy';
  if (blocks.some((b) => partyOf(b) !== null)) return 'per-party';
  if (blocks.some((b) => b.type === 'contractSign')) return 'legacy';
  return 'none';
}

/**
 * Walk the tree into an ordered node list, flushing runs of chrome blocks and
 * injecting each marker's content at its position.
 *
 * A tree with no `contractBody` marker (very old, or fully cleared) still gets
 * a body node, appended after all chrome, so the terms always render. The same
 * applies to the signature: a contract must never become unsignable because of
 * how its branding was arranged.
 *
 * @param blocks - The contract surface's blocks, in saved order.
 * @param hasSigners - See {@link signModeFor}.
 * @returns Nodes to render in order.
 */
export function layoutContractCard(
  blocks: readonly Block[],
  hasSigners = true,
): LayoutNode[] {
  const mode = signModeFor(blocks, hasSigners);
  const nodes: LayoutNode[] = [];
  let buffer: Block[] = [];

  const flush = () => {
    if (buffer.length > 0) {
      nodes.push({ kind: 'chrome', blocks: buffer });
      buffer = [];
    }
  };

  let sawBody = false;
  let sawSign = false;

  for (const block of blocks) {
    if (block.type === 'contractBody') {
      flush();
      nodes.push({ kind: 'body' });
      sawBody = true;
      continue;
    }

    const party = partyOf(block);
    if (party) {
      // A stray legacy marker in a per-party tree is dropped, not rendered:
      // showing both would print every signature twice.
      if (mode === 'per-party') {
        flush();
        nodes.push({ kind: 'sign-party', party, block, first: !sawSign });
        sawSign = true;
      } else if (!sawSign) {
        // Forced legacy (no signer rows): the first party marker becomes the
        // position of the single stacked section, so the signature still lands
        // where the MC put it rather than at the end of the document.
        flush();
        nodes.push({ kind: 'sign-legacy' });
        sawSign = true;
      }
      continue;
    }

    if (block.type === 'contractSign') {
      if (mode === 'legacy') {
        flush();
        nodes.push({ kind: 'sign-legacy' });
        sawSign = true;
      }
      continue;
    }

    buffer.push(block);
  }

  flush();

  // Safety nets. Neither should fire on a well-formed tree, but a contract that
  // cannot show its terms, or that cannot be signed, is the one failure mode
  // worth being defensive about.
  if (!sawBody) nodes.push({ kind: 'body' });
  if (!sawSign) nodes.push({ kind: 'sign-legacy' });

  return nodes;
}
