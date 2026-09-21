/**
 * Pure conversion between {@link ProposalSettings} (the server shape) and
 * the settings modal's editable draft (flat string fields for the link
 * preview, so two text inputs can stay controlled without juggling
 * `undefined`). Kept separate from any component so both directions are
 * unit-testable without rendering anything.
 *
 * @module app/(dashboard)/proposals/proposal-settings-model
 */
import type { ProposalSettings, UpdateProposalSettingsInput } from '@/features/proposals';

export interface ProposalSettingsDraft {
  password_enabled: boolean;
  allow_download: boolean;
  expiry_days: number;
  deposit_percent: number;
  linkPreviewTitle: string;
  linkPreviewImageUrl: string;
}

/** Server settings → editable draft. */
export function toDraft(settings: ProposalSettings): ProposalSettingsDraft {
  return {
    password_enabled: settings.password_enabled,
    allow_download: settings.allow_download,
    expiry_days: settings.expiry_days,
    deposit_percent: settings.deposit_percent,
    linkPreviewTitle: settings.link_preview?.title ?? '',
    linkPreviewImageUrl: settings.link_preview?.imageUrl ?? '',
  };
}

/** Editable draft → the server action's input. Blank title/image fields collapse to `link_preview: null`. */
export function fromDraft(draft: ProposalSettingsDraft): UpdateProposalSettingsInput {
  const title = draft.linkPreviewTitle.trim();
  const imageUrl = draft.linkPreviewImageUrl.trim();
  return {
    password_enabled: draft.password_enabled,
    allow_download: draft.allow_download,
    expiry_days: draft.expiry_days,
    deposit_percent: draft.deposit_percent,
    link_preview: title || imageUrl ? { ...(title ? { title } : {}), ...(imageUrl ? { imageUrl } : {}) } : null,
  };
}
