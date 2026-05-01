import { MobileNav } from "@/app/components/mobile-nav";
import { ShadowBanner } from "@/app/components/shadow-banner";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <MobileNav />
      <main className="md:ml-[68px] h-screen overflow-hidden pt-14 md:pt-0 flex flex-col">
        <ShadowBanner />
        <div className="flex-1 overflow-hidden min-h-0">
          {children}
        </div>
      </main>
    </>
  );
}
