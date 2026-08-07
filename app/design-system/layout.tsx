import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Layout for the internal component showroom.
 *
 * Two jobs: gate the route out of production, and keep the dashboard
 * chrome away. The showroom renders components in isolation, so the
 * sidebar and its auth-dependent data would only get in the way.
 *
 * @module app/design-system/layout
 */

/** Showroom pages are never indexed or linked; keep crawlers off them. */
export const metadata = {
  title: 'Zebri Design System',
  robots: { index: false, follow: false },
};

/**
 * Wraps every /design-system page.
 *
 * The production gate is a hard `notFound()` rather than a redirect so
 * the route is indistinguishable from a typo to anyone probing the
 * deployed app.
 */
export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <div className="min-h-screen bg-surface text-text">{children}</div>;
}
