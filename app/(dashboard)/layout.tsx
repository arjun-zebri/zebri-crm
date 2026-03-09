import { Sidebar } from "@/app/components/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Sidebar />
      <main className="ml-17 h-screen overflow-hidden px-8 py-4">{children}</main>
    </>
  );
}
