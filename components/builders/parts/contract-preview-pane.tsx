/**
 * Right-pane preview for the Contract builder modal.
 *
 * Contracts don't fit the multi-tabbed PDF / Email / Link preview
 * that `builder-preview-pane.tsx` builds for Quote + Invoice —
 * there are no line items or totals to project across three
 * surfaces. A contract IS its HTML body, so the preview is simply
 * a styled card rendering that HTML.
 *
 * Two render modes follow the same lock semantics as
 * `contract-body-editor.tsx`:
 * - **Live (draft)**: the HTML the orchestrator builds from the
 *   editor's current TipTap JSON, with variables substituted
 *   against the best-available demo data (couple name from props,
 *   event date from the linked event, quote total from the linked
 *   quote — placeholders otherwise).
 * - **Locked (sent / signed / declined / expired / revoked)**: the
 *   server-rendered `locked_content_html` snapshot the couple sees.
 *
 * The "Branded as {kit}" header link mirrors the Quote/Invoice
 * preview pattern so the user has a consistent jumping-off point
 * to `/branding`.
 *
 * @module components/builders/parts/contract-preview-pane
 */
'use client';

import { ExternalLink, Palette } from 'lucide-react';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

export interface ContractPreviewPaneProps {
  /** Rendered HTML to display — built upstream from either the
   *  TipTap content (draft) or the locked snapshot. */
  html: string;
  /** Human-readable contract number / title for the header. */
  documentNumber: string;
}

export function ContractPreviewPane({
  html,
  documentNumber,
}: ContractPreviewPaneProps) {
  const [brandingLabel, setBrandingLabel] = useState<string | null>(null);

  // Resolve the "Branded as {kit name}" label same way the
  // quote/invoice preview pane does — active_kit_id → name, else
  // brand_kit_name, else business_name. See builder-preview-pane.tsx
  // for the longer rationale.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
      const activeKitId = meta.active_kit_id as string | undefined;
      const kits = (meta.brand_kits ?? []) as Array<{ id: string; name: string }>;
      const kitName = activeKitId
        ? kits.find((k) => k.id === activeKitId)?.name
        : null;
      const label =
        kitName ??
        (meta.brand_kit_name as string | undefined) ??
        (meta.business_name as string | undefined) ??
        null;
      if (!cancelled) setBrandingLabel(label);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-surface-muted/60 p-4 sm:p-5 rounded-card">
      {/* Header — matches the BuilderPreviewPane visual language. */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-caption text-text-muted">
          <Palette size={12} strokeWidth={1.5} />
          {brandingLabel ? (
            <span>
              Branded as <span className="text-text">{brandingLabel}</span>
            </span>
          ) : (
            <span>Branded preview</span>
          )}
        </div>
        <a
          href="/branding"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-caption text-text-muted hover:text-text transition-colors"
        >
          Update branding <ExternalLink size={11} strokeWidth={1.5} />
        </a>
      </div>

      {/* Body — the rendered contract HTML. The .prose styles come
          from Tailwind Typography; no further styling needed. */}
      <div className="flex-1 overflow-y-auto rounded-card border border-border bg-surface p-6 sm:p-8">
        <p className="text-caption font-medium uppercase tracking-wider text-text-muted mb-4">
          {documentNumber}
        </p>
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
