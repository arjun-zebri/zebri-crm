import { TextLink } from '@/components/ui-v2/text-link';

import { DashboardClient } from './pages/dashboard/dashboard-client';
import { LoginPageV2 } from './pages/login-form';
import { OnboardingFlow } from './pages/onboarding/onboarding-flow';
import { SignupPageV2 } from './pages/signup-form';
import { Spec } from './showroom-v2';

/**
 * v2 page patterns: the auth pages, onboarding, the dashboard, Proposals
 * and Payments, each previewed in a frame or linked to its full-screen
 * route.
 *
 * @module app/design-system/v2/pages-auth
 */
export function PagesAuthV2() {
  return (
    <>
      <div id="login" className="scroll-mt-8">
        <Spec name="Log in" file="app/design-system/v2/pages/login-form.tsx">
          <TextLink href="/design-system/v2/login">Open full page</TextLink>
          <LoginPageV2 contained />
        </Spec>
      </div>
      <div id="signup" className="scroll-mt-8">
        <Spec name="Sign up" file="app/design-system/v2/pages/signup-form.tsx">
          <TextLink href="/design-system/v2/signup">Open full page</TextLink>
          <SignupPageV2 contained />
        </Spec>
      </div>
      <div id="onboarding" className="scroll-mt-8">
        <Spec name="Onboarding" file="app/design-system/v2/pages/onboarding/onboarding-flow.tsx">
          <TextLink href="/design-system/v2/onboarding">Open full page</TextLink>
          <OnboardingFlow contained />
        </Spec>
      </div>
      <div id="dashboard" className="scroll-mt-8">
        <Spec name="Dashboard" file="app/design-system/v2/pages/dashboard/dashboard-page.tsx">
          <TextLink href="/design-system/v2/dashboard">Open full page</TextLink>
          <DashboardClient contained />
        </Spec>
      </div>
      <div id="proposals" className="scroll-mt-8">
        <Spec
          name="Proposals"
          file="app/design-system/v2/pages/dashboard/proposals/proposals-page.tsx"
          description="Overview (laid out as Payments: figures on the backdrop, the sent-to-booked chart beside a What’s next rail of readers to nudge and proposals about to expire), Proposals as row sections, Templates as media cards, and a proposal modal: the live preview beside the facts, a mirror chart of where each partner's attention went (following the preview as it scrolls) and Activity. Fills a laptop screen, so it opens full page."
        >
          <TextLink href="/design-system/v2/dashboard#proposals">Open full page</TextLink>
        </Spec>
      </div>
      <div id="payments" className="scroll-mt-8">
        <Spec
          name="Payments"
          file="app/design-system/v2/pages/dashboard/payments/payments-page.tsx"
          description="Overview (stat strip, cash flow by month, Overdue and Next 30 days, a period picker with a custom date range), Invoices and Contracts as row sections, and a document modal. Fills a laptop screen without scrolling, so it opens full page."
        >
          <TextLink href="/design-system/v2/dashboard#payments">Open full page</TextLink>
        </Spec>
      </div>
    </>
  );
}
