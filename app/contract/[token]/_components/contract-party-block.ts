/**
 * Finding a party's block config in a contract's block tree.
 *
 * Each signature panel takes its labels, button colour and typography from the
 * MC's block for that party. The block is optional throughout: a tree that
 * still uses the deprecated all-in-one block has none, and the panels then fall
 * back to their historical defaults.
 *
 * Split into its own module so both the public page and the print element can
 * resolve it without importing each other.
 *
 * @module app/contract/[token]/_components/contract-party-block
 */
import type { Block } from '@/app/(dashboard)/branding/blocks/types';

import type { SignParty } from './contract-parties';
import type { PartyBlock } from './contract-signature-panel';

/** The block type that marks each party slot. */
const TYPE_FOR_PARTY: Record<SignParty, PartyBlock['type']> = {
  vendor: 'contractSignVendor',
  primary: 'contractSignPrimary',
  secondary: 'contractSignSecondary',
};

/**
 * The block configuring one party's panel, or null when the tree has none.
 *
 * @param blocks - The contract surface's blocks (already repaired), or null.
 * @param party - Which party slot to look up.
 */
export function partyBlockFrom(
  blocks: readonly Block[] | null | undefined,
  party: SignParty,
): PartyBlock | null {
  if (!blocks) return null;
  const wanted = TYPE_FOR_PARTY[party];
  return (blocks.find((b): b is PartyBlock => b.type === wanted) as PartyBlock | undefined) ?? null;
}
