/**
 * Layout for the unauthenticated auth route group.
 *
 * Centred card on a token-driven surface — light/dark mode and brand
 * changes propagate automatically via the design tokens defined in
 * `app/globals.css`. Mobile padding scales up at the `sm:` breakpoint.
 *
 * @module app/(auth)/layout
 */
import Image from 'next/image';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-surface px-4 py-8 text-text sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center sm:mb-8">
          <Image src="/zebri-logo.svg" alt="Zebri" width={120} height={32} priority />
        </div>
        {children}
      </div>
    </main>
  );
}
