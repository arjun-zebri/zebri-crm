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
 * Tabs persist their active selection while the modal is open (each
 * builder modal owns the state so it survives form re-renders).
 *
 * Includes a "Branded as {Business Name} · Update branding ↗" link
 * in the header. The link opens `/branding` in a new tab so the
 * user can adjust + come back without losing the modal.
 *
 * On screens < `lg` (1024px) the pane collapses by default — the
 * user can expand it via the `>` arrow next to "Preview".
 *
 * @module components/builders/parts/builder-preview-pane
 */
'use client';

import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Info,
  Mail,
  Palette,
} from 'lucide-react';
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
  coupleEmail?: string | null;
  /** When true, the pane is collapsed to a slim toggle (mobile +
   *  hide-preview affordance). */
  collapsed: boolean;
  onToggleCollapsed: (next: boolean) => void;
}

const TABS: { id: PreviewTab; label: string; icon: typeof FileText }[] = [
  { id: 'pdf', label: 'PDF', icon: FileText },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'payment_page', label: 'Payment page', icon: Globe },
];

export function BuilderPreviewPane({
  doc,
  surface,
  coupleEmail,
  collapsed,
  onToggleCollapsed,
}: BuilderPreviewPaneProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('payment_page');
  const [brandingLabel, setBrandingLabel] = useState<string | null>(null);

  // Fetch the user's business name for the "Branded as …" header
  // link. Cheap (single auth call) + cached by Supabase under the
  // hood, so this only hits once per session.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const meta = (data.user?.user_metadata ?? {}) as { business_name?: string };
      setBrandingLabel(meta.business_name?.trim() || null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Collapsed view — slim vertical bar with the expand chevron.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => onToggleCollapsed(false)}
        className="hidden lg:flex h-full w-10 items-center justify-center rounded-card border border-border bg-surface-muted/40 hover:bg-surface-muted transition-colors cursor-pointer"
        aria-label="Show preview"
      >
        <ChevronLeft size={16} strokeWidth={1.5} className="text-text-muted" />
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-card border border-border bg-surface-muted/40 p-3">
      {/* Header: collapse chevron + Preview label + tabs */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => onToggleCollapsed(true)}
          className="hidden lg:inline-flex h-7 w-7 items-center justify-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text transition-colors cursor-pointer"
          aria-label="Hide preview"
        >
          <ChevronRight size={14} strokeWidth={1.5} />
        </button>

        <div className="inline-flex items-center gap-1.5">
          <h2 className="text-section font-semibold text-text">Preview</h2>
          <span title="Preview reflects unsaved changes" className="inline-flex">
            <Info size={14} strokeWidth={1.5} className="text-text-subtle" />
          </span>
        </div>

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
          Update branding ↗
        </a>
      </div>

      {/* Preview surface */}
      <div className="flex-1 min-h-0">
        {activeTab === 'pdf' ? (
          <PreviewPdf doc={doc} />
        ) : activeTab === 'email' ? (
          <PreviewEmail doc={doc} coupleEmail={coupleEmail} />
        ) : (
          <PreviewPaymentPage doc={doc} surface={surface} />
        )}
      </div>
    </div>
  );
}
