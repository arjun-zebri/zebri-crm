/**
 * Composes the two field groups inside the settings modal.
 *
 * @module app/(dashboard)/proposals/proposal-settings-form
 */
import { ProposalSettingsDefaults } from './proposal-settings-defaults';
import type { ProposalSettingsDraft } from './proposal-settings-model';
import { ProposalSettingsToggles } from './proposal-settings-toggles';

export interface ProposalSettingsFormProps {
  draft: ProposalSettingsDraft;
  onChange: (patch: Partial<ProposalSettingsDraft>) => void;
}

/** See {@link ProposalSettingsFormProps}. */
export function ProposalSettingsForm({ draft, onChange }: ProposalSettingsFormProps) {
  return (
    <div className="space-y-6">
      <ProposalSettingsToggles draft={draft} onChange={onChange} />
      <div className="border-t border-border" />
      <ProposalSettingsDefaults draft={draft} onChange={onChange} />
    </div>
  );
}
