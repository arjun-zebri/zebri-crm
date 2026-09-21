/**
 * The two on/off proposal defaults: password protection and PDF download.
 *
 * @module app/(dashboard)/proposals/proposal-settings-toggles
 */
import { Toggle } from '@/components/ui/toggle';

import type { ProposalSettingsDraft } from './proposal-settings-model';

export interface ProposalSettingsTogglesProps {
  draft: Pick<ProposalSettingsDraft, 'password_enabled' | 'allow_download'>;
  onChange: (patch: Partial<ProposalSettingsDraft>) => void;
}

/** See {@link ProposalSettingsTogglesProps}. */
export function ProposalSettingsToggles({ draft, onChange }: ProposalSettingsTogglesProps) {
  return (
    <div className="space-y-4">
      <Toggle
        checked={draft.password_enabled}
        onChange={(password_enabled) => onChange({ password_enabled })}
        label="Password protection"
        description="New proposals require a password to view by default."
      />
      <Toggle
        checked={draft.allow_download}
        onChange={(allow_download) => onChange({ allow_download })}
        label="Allow PDF download"
        description="Couples can download a PDF copy of new proposals."
      />
    </div>
  );
}
