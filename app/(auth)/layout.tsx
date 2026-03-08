export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen w-full bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
