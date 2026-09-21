/**
 * Compact GST / weekend-loading / pricing-mode row for
 * {@link ProposalOptionCard}.
 *
 * These fields flow straight onto the public package card ("incl. GST",
 * "Includes 20% weekend loading"), so the couple sees their consequences
 * before the MC ever does if they are left at the applied package's
 * defaults. This row surfaces them here and makes them editable.
 *
 * Split out of `proposal-option-card.tsx` to keep both files under the
 * ~150-line component limit.
 *
 * @module components/builders/parts/proposal-option-terms
 */
'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import type { ProposalOptionInput } from '@/lib/proposals/types';

export interface ProposalOptionTermsProps {
  option: ProposalOptionInput;
  canEdit: boolean;
  onPatch: (patch: Partial<ProposalOptionInput>) => void;
}

/** See {@link ProposalOptionTermsProps}. */
export function ProposalOptionTerms({ option, canEdit, onPatch }: ProposalOptionTermsProps) {
  const isSingle = option.pricingMode === 'single';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Toggle
        checked={isSingle}
        onChange={(checked) =>
          onPatch({
            pricingMode: checked ? 'single' : 'itemised',
            // A fixed price only means something in single mode; clearing
            // it on the way back to itemised stops a stale number sitting
            // unseen on an option whose total no longer uses it.
            fixedPrice: checked ? (option.fixedPrice ?? 0) : null,
          })
        }
        disabled={!canEdit}
        label="Fixed price"
      />
      {isSingle ? (
        <Input
          type="number"
          inputMode="decimal"
          value={option.fixedPrice ?? 0}
          onChange={(e) => onPatch({ fixedPrice: Number(e.target.value) || 0 })}
          disabled={!canEdit}
          aria-label="Fixed price amount"
          className="w-28"
        />
      ) : null}
      <Checkbox
        checked={option.gstInclusive}
        onChange={(v) => onPatch({ gstInclusive: v })}
        disabled={!canEdit}
        label="GST inclusive"
      />
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="decimal"
          value={option.weekendLoadingPercent ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            onPatch({ weekendLoadingPercent: raw.trim() === '' ? null : Number(raw) || 0 });
          }}
          placeholder="0"
          disabled={!canEdit}
          aria-label="Weekend loading percent"
          className="w-16"
        />
        <span className="text-body text-text-muted">% weekend loading</span>
      </div>
    </div>
  );
}
