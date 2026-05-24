/**
 * Quote-template picker (Phase 2C.2).
 *
 * Two variants:
 * 1. **Empty-state** (`variant="empty-state"`): renders prominently
 *    above the items area on a brand-new quote with no items yet —
 *    "Start from template" card with template chips. Click applies
 *    items + notes.
 * 2. **Inline** (`variant="inline"`): smaller "Apply template" link
 *    button in the items section header, opens the same picker in
 *    a popover. Used once the user has already added items.
 *
 * Templates themselves are fetched + applied by the parent — this
 * component is pure presentation + selection.
 *
 * @module components/builders/parts/template-picker
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { FileText, Layers } from 'lucide-react';
import { useState } from 'react';

export interface QuoteTemplate {
  id: string;
  name: string;
  itemCount: number;
  notes: string | null;
}

export interface TemplatePickerProps {
  variant: 'empty-state' | 'inline';
  templates: QuoteTemplate[];
  /** Whether the user can apply templates (locked on accepted/expired quotes). */
  canApply: boolean;
  /** Fires when the user picks a template. The parent applies items + notes. */
  onApply: (templateId: string) => void;
}

export function TemplatePicker({
  variant,
  templates,
  canApply,
  onApply,
}: TemplatePickerProps) {
  if (variant === 'empty-state') {
    return <EmptyStateCard templates={templates} canApply={canApply} onApply={onApply} />;
  }
  return <InlinePicker templates={templates} canApply={canApply} onApply={onApply} />;
}

/* ─── Empty-state card ─────────────────────────────────────────── */

function EmptyStateCard({
  templates,
  canApply,
  onApply,
}: Omit<TemplatePickerProps, 'variant'>) {
  if (templates.length === 0) return null;

  return (
    <div className="rounded-card border border-border bg-surface-muted/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Layers size={14} strokeWidth={1.5} className="text-text-muted" />
        <p className="text-body font-medium text-text">Start from a template</p>
      </div>
      <p className="text-caption text-text-muted">
        Apply a saved set of items + notes to get going faster.
      </p>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onApply(t.id)}
            disabled={!canApply}
            className="inline-flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2 text-body text-text hover:bg-surface-emphasis transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileText size={14} strokeWidth={1.5} className="text-text-muted" />
            <span>{t.name}</span>
            <span className="text-caption text-text-muted">
              {t.itemCount} {t.itemCount === 1 ? 'item' : 'items'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Inline popover ───────────────────────────────────────────── */

function InlinePicker({
  templates,
  canApply,
  onApply,
}: Omit<TemplatePickerProps, 'variant'>) {
  const [open, setOpen] = useState(false);

  if (templates.length === 0) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={!canApply}
          className="inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Layers size={12} strokeWidth={1.5} />
          Apply template
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-[90] w-64 rounded-card border border-border bg-surface shadow-lg p-1 animate-fade-in"
        >
          <p className="px-2 py-1 text-caption font-medium uppercase tracking-wide text-text-muted">
            Templates
          </p>
          <div className="max-h-64 overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onApply(t.id);
                }}
                className="flex w-full items-center justify-between rounded-control px-2 py-1.5 text-left text-body text-text transition-colors hover:bg-surface-muted cursor-pointer"
              >
                <span className="truncate">{t.name}</span>
                <span className="ml-2 shrink-0 text-caption text-text-muted">
                  {t.itemCount}
                </span>
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
