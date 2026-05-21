/**
 * Layout for the unauthenticated auth route group.
 *
 * Centres a card on a token-driven surface. Each form renders its
 * own Zebri logo *inside* the card; the layout owns the centring +
 * outer padding only.
 *
 * @module app/(auth)/layout
 */
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-surface px-4 py-8 text-text sm:px-6">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
