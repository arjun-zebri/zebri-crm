import { ShadowBanner } from "@/app/components/shadow-banner";
import { SidebarLayout } from "@/app/components/sidebar-layout";
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
      <WelcomeGate />
      {/* Deliberately NOT an async layout. Awaiting `cookies()` here made
          this segment dynamic, and the sidebar (a client component below
          it) then intermittently rendered without the root
          QueryClientProvider in scope, 500ing the page. The provider
          reads the shadow cookie on the client instead: it is set with
          httpOnly false precisely so the browser can read it. */}
      <TimerProvider>
        <div className="flex-1 overflow-hidden min-h-0">
          {children}
        </div>
        {modal}
      </TimerProvider>
    </SidebarLayout>
  );
}
