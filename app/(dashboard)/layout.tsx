import { ShadowBanner } from "@/app/components/shadow-banner";
import { SidebarLayout } from "@/app/components/sidebar-layout";
import { FeedbackLauncher } from "@/components/feedback/feedback-launcher";
import { TimerProvider } from "@/components/time-tracking/timer-provider";

import { WelcomeGate } from "./onboarding/welcome-gate";

export default function DashboardLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <SidebarLayout>
      <ShadowBanner />
      <FeedbackLauncher />
      <WelcomeGate />
      {/* Deliberately NOT an async layout, and nothing rendered here may
          be an async server component either. Awaiting `cookies()` at
          this level made the segment dynamic, which (a) intermittently
          rendered the sidebar without the root QueryClientProvider in
          scope, 500ing the page, and (b) killed `<Link>` prefetching for
          every dashboard route, so sidebar clicks blocked on a round
          trip. `<ShadowBanner>` reads the shadow cookie on the client
          instead: it is set with httpOnly false precisely so the browser
          can read it. */}
      <TimerProvider>
        <div className="flex-1 overflow-hidden min-h-0">
          {children}
        </div>
        {modal}
      </TimerProvider>
    </SidebarLayout>
  );
}
