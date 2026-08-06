/**
 * Right-pane preview for the Quote + Invoice builder modals.
 *
 * Three tabs:
 * - **PDF**: the printable HTML preview (what the user gets when
 *   they click Download PDF).
 * - **Email**: the templated email body (with To/From/Subject
 *   envelope) the couple receives.
 * - **Payment page**: the branded public page (`/{quote,invoice}/
 *   [token]`) the couple opens from the email — uses the user's
 *   actual branding + block tree.
 *
 * Includes a "Branded as {Business Name} · Update branding ↗" link
 * in the header. The link opens `/branding` in a new tab so the
 * user can adjust + come back without losing the modal.
 *
 * @module components/builders/parts/builder-preview-pane
 */
'use client';

import { Download, ExternalLink, FileText, Globe, Mail, Palette } from 'lucide-react';
import { useState } from 'react';

import { useCurrentBranding } from '@/lib/branding/use-current-branding';

import { PreviewEmail } from './preview-email';
import { PreviewPaymentPage } from './preview-payment-page';
import { PreviewPdf } from './preview-pdf';
import type { PreviewDoc } from './preview-shared';

export type PreviewTab = 'pdf' | 'email' | 'payment_page';

export interface BuilderPreviewPaneProps {
  doc: PreviewDoc;
  /** Used by the payment-page tab to load the right block tree +
   *  default fonts. Invoice builder passes 'invoice'; contract
   *  'contract'. */
  surface: 'invoice' | 'contract';
  /** Couple's email for the "To:" line of the email preview.
   *  Optional — when missing the preview shows a placeholder. */
  coupleEmail?: string | null | undefined;
  /** Hands the MC the PDF of whatever is currently on screen. When
   *  omitted the Download control is not rendered. */
  onDownloadPdf?: (() => void) | undefined;
}

const TABS: { id: PreviewTab; label: string; icon: typeof FileText }[] = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'email', label: 'Email', icon: Mail },
  // The "Link" tab is the branded public-page preview — what the
  // couple sees when they click the share link from the email.
  { id: 'payment_page', label: 'Link', icon: Globe },
];

export function BuilderPreviewPane({
  doc,
  surface,
  coupleEmail,
  onDownloadPdf,
}: BuilderPreviewPaneProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('payment_page');
  // Shares the cached branding fetch with the PDF + Link tabs below
  // rather than issuing its own `auth.getUser()`, so the header label
  // and the preview surface land on the same beat.
  const { brandLabel } = useCurrentBranding(surface);

  return (
    // Bordless tonal wrapper — the bg-surface-muted is enough to
    // separate the preview pane from the editor without a border.
    // Padding grows on lg so the inner preview card has breathing
    // room.
    <div className="flex h-full flex-col gap-3 rounded-control bg-surface-muted/60 p-4 sm:p-5">
      {/* Header: Preview label + tabs */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <h2 className="text-section font-semibold text-text">Preview</h2>

        {/* Download sits before the tab group so it reads as an action
            on the document, not a fourth preview mode. */}
        {onDownloadPdf ? (
          <button
            type="button"
            onClick={onDownloadPdf}
            className="ml-auto inline-flex items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 py-1.5 text-caption font-medium text-text-muted transition-colors hover:text-text cursor-pointer"
          >
            <Download size={12} strokeWidth={1.5} />
            Download
          </button>
        ) : null}

        <div
          className={`flex items-center gap-1 rounded-control border border-border bg-surface p-1 ${
            onDownloadPdf ? '' : 'ml-auto'
          }`}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-caption font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-surface-emphasis text-text'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <tab.icon size={12} strokeWidth={1.5} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Branded-as line */}
      <div className="flex items-center justify-between gap-2 text-caption text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Palette size={12} strokeWidth={1.5} className="text-text-subtle" />
          {brandLabel ? (
            <>
              Branded as <span className="text-text">{brandLabel}</span>
            </>
          ) : (
            <span className="italic">Using default branding</span>
          )}
        </span>
        <a
          href="/branding"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-text-muted hover:text-text transition-colors"
        >
          Update branding
          <ExternalLink size={11} strokeWidth={1.5} />
        </a>
      </div>

      {/* Preview surface */}
      <div className="flex-1 min-h-0">
        {activeTab === 'pdf' ? (
          <PreviewPdf doc={doc} surface={surface} />
        ) : activeTab === 'email' ? (
          <PreviewEmail doc={doc} coupleEmail={coupleEmail} />
        ) : (
          <PreviewPaymentPage doc={doc} surface={surface} />
        )}
      </div>
    </div>
  );
}
