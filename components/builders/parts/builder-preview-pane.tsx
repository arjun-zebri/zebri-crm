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

import { ExternalLink, FileText, Globe, Mail, Palette } from 'lucide-react';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import { PreviewEmail } from './preview-email';
import { PreviewPaymentPage } from './preview-payment-page';
import { PreviewPdf } from './preview-pdf';
import type { PreviewDoc } from './preview-shared';

export type PreviewTab = 'pdf' | 'email' | 'payment_page';

export interface BuilderPreviewPaneProps {
  doc: PreviewDoc;
  /** Used by the payment-page tab to load the right block tree +
   *  default fonts. Quote builder passes 'quote'; invoice 'invoice'. */
  surface: 'quote' | 'invoice';
  /** Couple's email for the "To:" line of the email preview.
   *  Optional — when missing the preview shows a placeholder. */
  coupleEmail?: string | null | undefined;
}

const TABS: { id: PreviewTab; label: string; icon: typeof FileText }[] = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'email', label: 'Email', icon: Mail },
  // The "Link" tab is the branded public-page preview — what the
  // couple sees when they click the share link from the email.
  { id: 'payment_page', label: 'Link', icon: Globe },
];

export function BuilderPreviewPane({ doc, surface, coupleEmail }: BuilderPreviewPaneProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('payment_page');
  const [brandingLabel, setBrandingLabel] = useState<string | null>(null);

  // Resolve the active brand-kit name for the "Branded as …" link.
  // Preference order:
  //   1. `active_kit_id` → match in `brand_kits[]` by id → kit.name
  //   2. `brand_kit_name` (legacy default-kit field)
  //   3. `business_name` (fallback while a kit isn't named)
  // Null when none of these are set — the label renders as
  // "Using default branding".
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const meta = (data.user?.user_metadata ?? {}) as {
        active_kit_id?: string | null;
        brand_kits?: { id: string; name?: string }[];
        brand_kit_name?: string;
        business_name?: string;
      };
      const kit = meta.active_kit_id
        ? meta.brand_kits?.find((k) => k.id === meta.active_kit_id)
        : undefined;
      const label =
        kit?.name?.trim() ||
        meta.brand_kit_name?.trim() ||
        meta.business_name?.trim() ||
        null;
      setBrandingLabel(label);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    // Bordless tonal wrapper — the bg-surface-muted is enough to
    // separate the preview pane from the editor without a border.
    // Padding grows on lg so the inner preview card has breathing
    // room.
    <div className="flex h-full flex-col gap-3 rounded-card bg-surface-muted/60 p-4 sm:p-5">
      {/* Header: Preview label + tabs */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <h2 className="text-section font-semibold text-text">Preview</h2>

        <div className="ml-auto flex items-center gap-1 rounded-card border border-border bg-surface p-1">
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
          {brandingLabel ? (
            <>
              Branded as <span className="text-text">{brandingLabel}</span>
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
