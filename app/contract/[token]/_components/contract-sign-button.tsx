/**
 * The "Sign here" control that sits inside an empty signature line.
 *
 * Deliberately small and inline: it occupies the signature slot itself, so it
 * reads as "your mark goes here" rather than as a page-level call to action.
 * Clicking it opens the signing dialog.
 *
 * @module app/contract/[token]/_components/contract-sign-button
 */
import { PenLine } from 'lucide-react';

import { getTextColor } from '@/lib/branding/contrast';
import { FONT_STACKS } from '@/lib/branding/fonts';
import { roleDefaults } from '@/lib/branding/type-defaults';

import type { PublicContract } from './public-contract';

export interface ContractSignButtonProps {
  contract: PublicContract;
  onClick: () => void;
  /** Brand colour, the button fill. */
  brand: string;
  radius: number;
  /** Button text, from the MC's signature block. */
  label: string;
}

export function ContractSignButton({
  contract,
  onClick,
  brand,
  radius,
  label,
}: ContractSignButtonProps) {
  // Body size with a 28px box: the document's own type scale, and close to the
  // app's 32px control height without pretending to be an app control on a
  // branded page. The first attempt was a large padded chip, the second shrank
  // to fine print and read as a caption rather than something to click.
  const bodyDefaults = roleDefaults(contract, 'body');

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 cursor-pointer items-center gap-1.5 px-2.5"
      style={{
        backgroundColor: brand,
        color: getTextColor(brand),
        borderRadius: Math.min(radius, 8),
        fontSize: `${bodyDefaults.fontSize}px`,
        fontFamily: FONT_STACKS[bodyDefaults.fontFamily as never],
      }}
    >
      <PenLine size={13} strokeWidth={1.5} />
      {label}
    </button>
  );
}
