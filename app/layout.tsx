import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Zebri",
  description: "A simple CRM for Wedding MCs",
};

/**
 * Synchronous theme bootstrap.
 *
 * Runs before React hydrates so the correct theme is painted on the very
 * first frame (no flash of unstyled / wrong-mode content). Reads an
 * explicit user choice from localStorage; falls back to the OS preference.
 * Kept tiny on purpose — anything more sophisticated belongs in
 * `components/ui/theme-toggle.tsx`.
 */
const themeBootstrap = `(function(){try{
  var t = localStorage.getItem('zebri-theme');
  var system = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (t === 'dark' || (t !== 'light' && system)) {
    document.documentElement.classList.add('dark');
  }
}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the bootstrap above toggles the `dark`
    // class on <html> before hydration, which would otherwise trigger a
    // class-mismatch warning. The mismatch is by design.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={`${inter.className} antialiased bg-surface text-text`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
