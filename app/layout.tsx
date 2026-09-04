import type { Metadata } from "next";
import { Caveat, Inter } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// The handwriting face for rendered signatures. Exposed as a CSS variable
// rather than a class because it is applied by inline style deep inside the
// contract components and the Settings signature preview. Self-hosted by
// next/font, so it costs no extra network request and cannot fail to load the
// way the previous unregistered `Caveat` reference silently did.
// See lib/branding/signature-font.ts for why the print window needs its own
// registration as well.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-signature",
});

export const metadata: Metadata = {
  title: "Zebri",
  description: "A simple CRM for Wedding MCs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${caveat.variable} antialiased bg-surface text-text`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
