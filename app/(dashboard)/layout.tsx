import { Sidebar } from "@/app/components/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Sidebar />
      <main className="ml-[68px] h-screen overflow-hidden">
        {children}
      </main>
    </>
  );
}
