import { Check } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';

/**
 * Onboarding footer: the save status on the left; Back and Continue (or "Go to dashboard" on the last step) on the right.
 * No Skip: setup is not skippable. On phones the primary button stacks
 * on top, full width, where the thumb is. Plain Enter never continues,
 * not even on a focused Continue (Space or a click does); Cmd/Ctrl+Enter
 * does, from anywhere (see
 * use-onboarding-keys); it just isn't advertised.
 *
 * @module app/design-system/v2/pages/onboarding/onboarding-footer
 */

export interface OnboardingFooterProps {
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  /** Line shown on the left, e.g. "Saved" or "Welcome back". Empty for none. */
  status: string;
  onBack: () => void;
  onNext: () => void;
}

export function OnboardingFooter({ isFirst, isLast, busy, status, onBack, onNext }: OnboardingFooterProps) {
  return (
    <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-zebra-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      {/* Collapses when empty on phones, where it would leave a gap under
          the full-width button; from sm it holds its row. */}
      <p role="status" className="flex h-9 items-center gap-1.5 type-body text-zebra-500 max-sm:empty:hidden">
        {status ? (
          <>
            <Check aria-hidden="true" strokeWidth={1.5} className="size-4 text-grass-700" />
            {status}
          </>
        ) : null}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {isFirst ? null : (
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          loading={busy}
          onClick={onNext}
          // A button clicks on Enter natively; here that would skip a step
          // after a mouse click left focus on it. Cmd/Ctrl+Enter still works.
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) e.preventDefault();
          }}
        >
          {isLast ? 'Go to dashboard' : 'Continue'}
        </Button>
      </div>
    </footer>
  );
}
