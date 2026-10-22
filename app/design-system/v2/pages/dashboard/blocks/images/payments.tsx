import { AccountContext, DEMO_ACCOUNT } from '../../account';
import { InvoiceEmail, noteFor } from '../../payments/modal/invoice-email';
import { finish } from '../../payments/payments-data';

import { BlockImageFrame, SCENE_CARD } from './block-image-frame';
import { IMAGE_BRAND } from './image-brand';

/**
 * Payments product image drafts (round 2): the real deposit invoice as
 * the couple gets it (`InvoiceEmail`, in the light green brand), laid
 * out at real width and shrunk, as on the Proposals image.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/payments
 */


// The demo business, in the image brand, with nothing it could save.
const ACCOUNT = { ...DEMO_ACCOUNT, brand: IMAGE_BRAND, mc: { name: 'Arjun Punekar', role: 'MC' } };

const DEPOSIT = finish({
  id: 'img-1', number: 1042, names: ['Mei', 'Lachlan'], label: 'Deposit', amount: 1088, item: 'Premium MC', total: 4350, paidBefore: 0,
  dueOn: '2026-10-17', paidOn: null, method: null, sentOn: '2026-10-03', history: [], note: noteFor('Mei and Lachlan'),
});
const BALANCE = { span: { count: 14, unit: 'days' as const }, eventOn: '2027-11-13' };

/** The email, with the image's account around it. `className` places and crops it. */
function Email({ className }: { className: string }) {
  return (
    <AccountContext.Provider value={ACCOUNT}>
      {/* The email brings its own frame (ring, shadow-lg); the card is the only edge here. */}
      <div className={`${SCENE_CARD} ${className} [&>article]:rounded-none [&>article]:shadow-none [&>article]:ring-0`}>
        <InvoiceEmail invoice={DEPOSIT} balance={BALANCE} />
      </div>
    </AccountContext.Provider>
  );
}

/** A: the invoice scrolled to its line items, with its pay section in front. */
export function PaymentsImageA() {
  return (
    <BlockImageFrame alt="Mei and Lachlan's deposit invoice open at its payment schedule, with its Pay deposit button on a card in front.">
      {/* Cut past the pay section (56px header + 316px) to the note and the payment schedule: deposit, balance, package total. */}
      <Email className="left-8 top-6 h-[30rem] w-[28rem] origin-top-left scale-[0.55] [&>article]:-mt-[372px]" />
      {/* The same email cut to its pay section: past the 56px header, 316px tall (the section at this width). */}
      <Email className="right-5 top-20 h-[316px] w-[22rem] origin-top-right scale-[0.55] shadow-md [&>article]:-mt-14" />
    </BlockImageFrame>
  );
}
