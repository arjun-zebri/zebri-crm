'use client';

/**
 * The public proposal's dialog shell: a fixed bottom sheet below `sm`, a
 * centred card from `sm` up. Shared by the accept stepper and the decline
 * form so the two feel like one surface.
 *
 * Escape-to-close and the page's scroll lock come from the app's shared
 * overlay hook (`components/ui/use-overlay`) rather than a bespoke
 * `keydown` listener: it is behaviour, not styling, so reusing it here
 * does not pull an app design token onto this branded surface, and it
 * already gets right what a hand-rolled listener would have to
 * re-solve (a nested overlay swallowing Escape, a text-drag release
 * outside the panel firing a stray backdrop click).
 *
 * A public surface, so every colour comes from `PublicBranding`, never an
 * app design token.
 *
 * @module app/proposal/[token]/_components/proposal-sheet
 */
import { X } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style';
import { useBackdropDismiss, useOverlay } from '@/components/ui/use-overlay';
import type { PublicBranding } from '@/lib/branding/public-surface';
import { roleDefaults } from '@/lib/branding/type-defaults';

const SIZE_CLASS: Record<'md' | 'lg', string> = {
  md: 'sm:w-[420px]',
  lg: 'sm:w-[560px]',
};

/** Props for {@link ProposalSheet}: a branded dialog shell for the public proposal's accept and decline flows. */
export interface ProposalSheetProps {
  /** Whether the sheet is showing. */
  open: boolean;
  /** Called on Close, Escape (when this is the topmost overlay), and a backdrop click. */
  onClose: () => void;
  /** The dialog's accessible name, and its visible heading. */
  title: string;
  /** The proposal's own branding, for colours, corner radius and typography. */
  branding: PublicBranding;
  children: ReactNode;
  /** Panel width from `sm` up. Defaults to `'md'`. */
  size?: 'md' | 'lg';
}

/** See {@link ProposalSheetProps}. */
export function ProposalSheet({ open, onClose, title, branding, children, size = 'md' }: ProposalSheetProps) {
  const headingId = useId();
  useOverlay({ isOpen: open, onClose });
  const dismiss = useBackdropDismiss(onClose);

  if (!open) return null;

  const headingStyle = resolveTextStyle(undefined, roleDefaults(branding, 'sectionHeading'));

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" {...dismiss} />
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" {...dismiss}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          className={`relative flex max-h-[90vh] w-full flex-col gap-4 overflow-y-auto p-6 ${SIZE_CLASS[size]}`}
          style={{ background: branding.surface_color, color: branding.text_color, borderRadius: branding.corner_radius }}
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id={headingId} className="m-0" style={headingStyle}>
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="shrink-0" style={{ color: branding.muted_color }}>
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
