/**
 * The numeric/text proposal defaults: expiry, deposit, and the link
 * preview title shown when a shared proposal URL is pasted elsewhere. The
 * preview image is no longer editable here (removed 2026-09-20); a stored
 * `imageUrl` still round-trips through the draft so saving never wipes it.
 *
 * @module app/(dashboard)/proposals/proposal-settings-defaults
 */
import { Input } from '@/components/ui/input';

import type { ProposalSettingsDraft } from './proposal-settings-model';

export interface ProposalSettingsDefaultsProps {
  draft: Pick<ProposalSettingsDraft, 'expiry_days' | 'deposit_percent' | 'linkPreviewTitle'>;
  onChange: (patch: Partial<ProposalSettingsDraft>) => void;
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** See {@link ProposalSettingsDefaultsProps}. */
export function ProposalSettingsDefaults({ draft, onChange }: ProposalSettingsDefaultsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          type="number"
          label="Expiry (days)"
          min={1}
          max={365}
          value={draft.expiry_days}
          onChange={(e) => onChange({ expiry_days: clamp(Number(e.target.value), 1, 365) })}
          help="How long a new proposal stays open before it expires."
        />
        <Input
          type="number"
          label="Deposit (%)"
          min={0}
          max={100}
          value={draft.deposit_percent}
          onChange={(e) => onChange({ deposit_percent: clamp(Number(e.target.value), 0, 100) })}
          help="Default deposit percentage for new proposals."
        />
      </div>
      <Input
        label="Link preview title"
        value={draft.linkPreviewTitle}
        onChange={(e) => onChange({ linkPreviewTitle: e.target.value })}
        help="Shown when a shared proposal link is pasted into chat or email."
      />
    </div>
  );
}
