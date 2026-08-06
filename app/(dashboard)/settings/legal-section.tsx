/**
 * Shared chrome for the inline legal sections (Privacy, Terms) in the
 * Settings modal. Renders a title, a "last updated" line, a canonical
 * link to the published version on zebri.com.au, and the prose body.
 *
 * NOTE: the body copy mirrors the published policy at the canonical
 * URL. Confirm verbatim before relying on it as the legal source of
 * truth, the published page remains canonical.
 *
 * @module app/(dashboard)/settings/legal-section
 */
'use client';

import { ExternalLink } from 'lucide-react';

export interface LegalSectionProps {
  title: string;
  lastUpdated: string;
  canonicalUrl: string;
  children: React.ReactNode;
}

export function LegalSection({ title, lastUpdated, canonicalUrl, children }: LegalSectionProps) {
  return (
    <div>
      <h2 className="text-section font-semibold text-text">{title}</h2>
      <p className="mt-1 text-caption text-text-subtle">Last updated: {lastUpdated}</p>
      <a
        href={canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-body text-text-muted hover:text-gray-700 transition cursor-pointer"
      >
        View the latest at {canonicalUrl.replace(/^https?:\/\//, '')}
        <ExternalLink size={14} strokeWidth={1.5} />
      </a>
      <div className="mt-6 space-y-5 text-body leading-relaxed text-gray-700 [&_h3]:text-body [&_h3]:font-semibold [&_h3]:text-text [&_h3]:mt-5 [&_h3]:mb-1.5 [&_p]:text-gray-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-text [&_a]:underline">
        {children}
      </div>
    </div>
  );
}
