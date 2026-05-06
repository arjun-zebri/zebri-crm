import { SidebarLayout } from "@/app/components/sidebar-layout";
import { ShadowBanner } from "@/app/components/shadow-banner";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarLayout>
      <ShadowBanner />
      <div className="flex-1 overflow-hidden min-h-0">
        {children}
      </div>
    </SidebarLayout>
  );
}
