'use client';

import { ContractPreview, Signatures } from '../../payments/modal/contract-preview';
import { BrandScope } from '../../payments/modal/letterhead';
import type { Contract } from '../../payments/payments-data';

import { BlockImageFrame, SCENE_CARD } from './block-image-frame';

/**
 * Contracts product image: Ruby and Kai's contract as the couple gets
 * it (the real `ContractPreview` in the MC's brand), with the real
 * signing block lifted out in front: the MC and Ruby signed, Kai still
 * to sign. The page is laid out and shrunk exactly as the Proposals
 * image's is, so the two read as a pair.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/contracts
 */


const CONTRACT: Contract = {
  id: 'img-ruby-kai',
  names: ['Ruby', 'Kai'],
  title: 'MC services agreement',
  item: 'Full day MC',
  total: 3850,
  event: 'Sat 15 May 2027 · Q Station, Manly',
  when: 'Sent Mon 1 Mar',
  sentOn: 'Mon 1 Mar',
  group: 'waiting',
  signers: [
    { name: 'Arjun Punekar', role: 'You', signed: 'Mon 1 Mar' },
    { name: 'Ruby Tan', role: 'Client', signed: 'Tue 2 Mar' },
    { name: 'Kai Walker', role: 'Client', signed: null },
  ],
  history: [],
};

/** Contracts block image. */
export function ContractsImage() {
  return (
    <BlockImageFrame alt="Ruby and Kai's contract in the MC's brand, with its signing block in front: the MC and Ruby signed, Kai still to sign.">
      {/* Laid out and shrunk exactly as the Proposals image's page is. */}
      <div className={`${SCENE_CARD} left-8 top-6 h-[30rem] w-[32rem] origin-top-left scale-[0.55]`}>
        <ContractPreview contract={CONTRACT} />
      </div>
      {/* The signing block, lifted out in front: laid out wide enough for three signatures, then shrunk to sit near the page's scale. */}
      <div className={`${SCENE_CARD} right-5 top-28 w-[38rem] origin-top-right scale-[0.45] p-6 shadow-md`}>
        <BrandScope>
          <Signatures contract={CONTRACT} />
        </BrandScope>
      </div>
    </BlockImageFrame>
  );
}
