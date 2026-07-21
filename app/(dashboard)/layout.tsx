import { SidebarLayout } from "@/app/components/sidebar-layout";
import { ShadowBanner } from "@/app/components/shadow-banner";
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
      <div className="flex-1 overflow-hidden min-h-0">
        {children}
      </div>
      {modal}
    </SidebarLayout>
  );
}
