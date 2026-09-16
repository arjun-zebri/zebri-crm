'use client';

/**
 * The stepper's first pane: the same package cards the page shows, plus a
 * live total/deposit summary and the "Continue to sign" action.
 *
 * @module app/proposal/[token]/_components/steps/choose-step
 */
import { resolveTextStyle } from '@/app/(dashboard)/branding/blocks/text-style';
import { BusyLabel } from '@/components/ui/busy-label';
import { getTextColor } from '@/lib/branding/contrast';
import { PackageCard, priced } from '@/lib/branding/public-blocks/proposal/package-card';
import { fmt } from '@/lib/branding/public-blocks/shared';
import { roleDefaults } from '@/lib/branding/type-defaults';
import { depositAmount, optionTotal } from '@/lib/proposals/pricing';
import type { PublicProposal } from '@/lib/proposals/public-types';

/** Props for {@link ChooseStep}: the shared package/add-on selection plus the accept request's busy and error state. */
export interface ChooseStepProps {
  proposal: PublicProposal;
  selectedOptionId: string | null;
  selectedAddonIds: readonly string[];
  onSelectOption: (id: string) => void;
  onToggleAddon: (id: string) => void;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
}

/** See {@link ChooseStepProps}. */
export function ChooseStep({ proposal, selectedOptionId, selectedAddonIds, onSelectOption, onToggleAddon, busy, error, onContinue }: ChooseStepProps) {
  const options = [...proposal.options].sort((a, b) => a.position - b.position);
  const selectedOption = options.find((o) => o.id === selectedOptionId);
  const total = selectedOption ? optionTotal(priced(selectedOption), selectedAddonIds) : 0;
  const deposit = depositAmount(total, proposal.deposit_percent);
  const bodyStyle = resolveTextStyle(undefined, roleDefaults(proposal, 'body'));
  const totalStyle = resolveTextStyle(undefined, roleDefaults(proposal, 'total'));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        {options.map((option) => {
          const isSelected = option.id === selectedOptionId;
          const cardAddonIds = isSelected ? selectedAddonIds : option.items.filter((i) => i.is_addon && i.default_included).map((i) => i.id);
          return (
            <PackageCard
              key={option.id}
              option={option}
              branding={proposal}
              selected={isSelected}
              locked={false}
              showInclusions
              ctaLabel="Choose this package"
              addonIds={cardAddonIds}
              onSelect={() => onSelectOption(option.id)}
              onToggleAddon={onToggleAddon}
            />
          );
        })}
      </div>
      <div>
        <p className="m-0" style={totalStyle}>
          Total {fmt(total)}
        </p>
        {proposal.deposit_percent ? (
          <p className="m-0" style={{ ...bodyStyle, color: proposal.muted_color }}>
            Deposit today {fmt(deposit)} ({proposal.deposit_percent}%)
          </p>
        ) : null}
      </div>
      {/* Public pages style only from PublicBranding, which carries no
          danger colour: an inline error reads as the muted body text,
          announced through role="alert" for assistive tech. */}
      {error ? (
        <p className="m-0" role="alert" style={{ ...bodyStyle, color: proposal.muted_color }}>
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onContinue}
        disabled={busy || !selectedOptionId}
        aria-busy={busy || undefined}
        className="w-full px-4 py-2 disabled:opacity-50"
        style={{ background: proposal.brand_color, color: getTextColor(proposal.brand_color), borderRadius: proposal.button_radius }}
      >
        <BusyLabel busy={busy}>Continue to sign</BusyLabel>
      </button>
    </div>
  );
}
