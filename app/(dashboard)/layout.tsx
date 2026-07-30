import { cookies } from "next/headers";

import { ShadowBanner } from "@/app/components/shadow-banner";
import { SidebarLayout } from "@/app/components/sidebar-layout";
import { TimerProvider } from "@/components/time-tracking/timer-provider";

import { WelcomeGate } from "./onboarding/welcome-gate";

export default async function DashboardLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  // A support session must not be able to write time onto the MC's
  // timesheet, so the shadow flag is resolved here (the same cookie
  // `ShadowBanner` reads) and the provider hides every timer control.
  const cookieStore = await cookies();
  const shadowing = cookieStore.get("zebri_is_shadowing")?.value === "1";

  return (
    <SidebarLayout>
      <ShadowBanner />
      <WelcomeGate />
      <TimerProvider shadowing={shadowing}>
        <div className="flex-1 overflow-hidden min-h-0">
          {children}
        </div>
        {modal}
      </TimerProvider>
    </SidebarLayout>
  );
}
