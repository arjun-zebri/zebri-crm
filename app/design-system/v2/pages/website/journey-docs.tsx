'use client';

import type { ReactNode } from 'react';

import { AccountContext } from '../dashboard/account';
import { formParts } from '../dashboard/bdm/couple-form-parts';
import { CoupleFormReview } from '../dashboard/bdm/couple-form-review';
import { formTemplate } from '../dashboard/bdm/noim-questions';
import { EmailBody } from '../dashboard/email/render/email-body';
import { quirksOf } from '../dashboard/email/render/quirks';
import { ContractPreview, Signatures } from '../dashboard/payments/modal/contract-preview';
import { InvoiceEmail } from '../dashboard/payments/modal/invoice-email';
import { BrandScope } from '../dashboard/payments/modal/letterhead';
import { BRAND } from '../dashboard/proposals/templates-data';
import { brandVars } from '../onboarding/brand-doc-parts';
import { BrandProposal } from '../onboarding/brand-proposal';
import { Packages } from '../onboarding/proposal-sections';

import { ACCOUNT, BALANCE, BALANCE_INVOICE, CEREMONY, CONTRACT, DEPOSIT, MIA_AND_LEO, PAPERWORK, PROPOSAL_WELCOME, WELCOME } from './journey-data';

/**
 * What each step of the Journeys band sends, at real size, as the
 * document itself floating on the band's gradient: no phone or browser
 * round it, which only competed with the document. Every
 * one is the component the product renders (`EmailBody`, `BrandProposal`,
 * `ContractPreview`, `InvoiceEmail` for the deposit and the balance,
 * the couple's `CoupleFormReview`),
 * fed Mia and Leo's booking (`journey-data.ts`). Founder reviews,
 * 2026-10-18: text popovers were not "the actual visual", and documents
 * shrunk into the list were "tiny image snapshots" that added little.
 *
 * Each scene fills the stage's canvas, 680 by 480, under the stage's head
 * and over its foot (`journey-stage.tsx`, `STAGE`).
 *
 * @module app/design-system/v2/pages/website/journey-docs
 */

/** The stage every scene is laid out on, in CSS px. */
export const STAGE = { width: 680, height: 600 } as const;

const none = () => undefined;

/** Mia's part of the NOIM, as "Check your answers" reads it back to her. */
const MIAS_PART = formParts(PAPERWORK, formTemplate(PAPERWORK).questions, {}).slice(0, 1);

/**
 * A document on the stage's canvas: white on the quiet grey, hairline
 * edge, resting shadow; `LIFT` for a piece lifted out in front. No
 * device or browser round it (founder, 2026-10-18: "would a premium app
 * build a random phone screen?"). Cards taller than the canvas fade out
 * at the foot.
 */
const CARD = 'absolute overflow-hidden rounded-panel bg-field shadow-sm ring-1 ring-hairline';
const LIFT = 'shadow-xl';

/** The thank-you email, as the couple reads it. */
function WelcomeScene() {
  return (
    <div className={`${CARD} left-1/2 top-8 w-[26rem] -translate-x-1/2`}>
      <EmailBody blocks={WELCOME} signature="full" signOff="Warmly," quirks={quirksOf('apple', 'phone', 10)} chrome={false} />
    </div>
  );
}

/** The proposal page at its cover, with its package lifted out in front. */
function ProposalScene() {
  return (
    // The brand arrives as custom properties, the one style, as in the proposal preview.
    <div style={brandVars(BRAND)} className="size-full">
      <div className={`${CARD} left-8 top-8 h-[26rem] w-[26rem] mask-b-from-75%`}>
        <BrandProposal
          business={ACCOUNT.business}
          name="Jess Taylor"
          role="Celebrant"
          logoUrl={BRAND.logoUrl}
          packages={[CEREMONY]}
          deposit={25}
          headline="A ceremony that feels like you"
          welcome={PROPOSAL_WELCOME}
          wedding={MIA_AND_LEO}
          hints={false}
        />
      </div>
      {/* Narrow enough to leave the couple's names on the cover clear. */}
      <div className={`${CARD} ${LIFT} right-6 top-14 w-[19rem] p-6 font-[family-name:var(--b-body)]`}>
        <Packages packages={[CEREMONY]} />
      </div>
    </div>
  );
}

/** The contract's first page, with its signing block lifted out in front: Jess, Mia and Leo, each signed. */
function ContractScene() {
  return (
    <>
      <div className={`${CARD} left-8 top-8 h-[25rem] w-[30rem] mask-b-from-75%`}>
        <ContractPreview contract={CONTRACT} />
      </div>
      <div className={`${CARD} ${LIFT} bottom-8 right-8 w-[30rem] px-6 pb-6 pt-2`}>
        <BrandScope>
          <Signatures contract={CONTRACT} />
        </BrandScope>
      </div>
    </>
  );
}

/** The deposit invoice email: the $500, Pay deposit, and the note under it. */
function DepositScene() {
  return (
    <div
      className={`${CARD} left-1/2 top-8 h-[28rem] w-[26rem] -translate-x-1/2 mask-b-from-80% [&>article]:rounded-none [&>article]:shadow-none [&>article]:ring-0`}
    >
      <InvoiceEmail invoice={DEPOSIT} balance={BALANCE} />
    </div>
  );
}

/** Mia's NOIM answers, read back to her before she sends them. */
function NoimScene() {
  return (
    <div className={`${CARD} left-1/2 top-8 h-[28rem] w-[26rem] -translate-x-1/2 mask-b-from-80%`}>
      <BrandScope className="px-6 py-7">
        <CoupleFormReview parts={MIAS_PART} answers={PAPERWORK.answers} problems={{}} toFix={[]} onChange={none} send={null} />
      </BrandScope>
    </div>
  );
}

/**
 * The balance invoice email, laid out as the deposit's (founder,
 * 2026-10-19): the $1,500, Pay final payment, the note, and the
 * schedule with the deposit already paid.
 */
function BalanceScene() {
  return (
    <div
      className={`${CARD} left-1/2 top-8 h-[28rem] w-[26rem] -translate-x-1/2 mask-b-from-80% [&>article]:rounded-none [&>article]:shadow-none [&>article]:ring-0`}
    >
      <InvoiceEmail invoice={BALANCE_INVOICE} />
    </div>
  );
}

/** Each step's scene, by step index. */
export const STEP_SCENES: (() => ReactNode)[] = [WelcomeScene, ProposalScene, ContractScene, DepositScene, NoimScene, BalanceScene];

/** Puts the Celebrant's account round the scenes, so each signs and brands itself as Jess. */
export function DocsAccount({ children }: { children: ReactNode }) {
  return <AccountContext.Provider value={ACCOUNT}>{children}</AccountContext.Provider>;
}
