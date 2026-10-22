import type { ReactNode } from 'react';

import { brandVars } from '../../../onboarding/brand-doc-parts';
import { useAccount } from '../../account';

/**
 * The MC's brand on contracts and invoices: {@link BrandScope} sets it
 * (the same CSS custom properties the proposal wears) around a
 * document, and {@link Letterhead} is their logo and business name at
 * its head, in their heading font. An account with no brand yet (the
 * demo business) gets the plain document, exactly as before.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/letterhead
 */

/**
 * Sets the account's brand on what it wraps; nothing when there is none.
 * `className` lays out the wrapper it adds, for a page whose height runs
 * through it (the couple's form, a card filling the window).
 */
export function BrandScope({ children, className }: { children: ReactNode; className?: string | undefined }) {
  const { brand } = useAccount();
  // Brand values are the MC's, chosen at runtime, so they arrive as custom properties.
  if (brand) return <div style={brandVars(brand)} className={className}>{children}</div>;
  return className ? <div className={className}>{children}</div> : <>{children}</>;
}

/** The logo (when there is one) and the business name, as a document's head. */
export function Letterhead({ className = 'type-heading' }: { className?: string }) {
  const { business, brand } = useAccount();
  return (
    <span className="flex items-center gap-3">
      {brand?.logoUrl ? (
        // A data URL from the MC's own file: next/image cannot take it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoUrl} alt="" className="h-9 w-auto max-w-28 object-contain" />
      ) : null}
      <span className={`text-zebra-950 ${brand ? 'font-[family-name:var(--b-heading)]' : ''} ${className}`}>{business}</span>
    </span>
  );
}
