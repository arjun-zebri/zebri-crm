'use client';

/**
 * Confirmation before a campaign starts sending. States the audience
 * size and the pace, because activation starts real sends.
 *
 * @module features/outreach/views/campaigns/activate-confirm
 */
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { CampaignSummary } from '@/lib/outreach/services/queries';

import { activateDescription } from './activate-copy';
import { audienceOf, draftFromCampaign } from './campaign-draft';
import { useAudienceCount } from './use-audience-count';

/**
 * @param props.campaign - The campaign about to activate, or null when closed.
 * @param props.loading - True while the activation request is running.
 * @param props.onConfirm - Starts the campaign.
 * @param props.onCancel - Closes without changes.
 */
export function ActivateConfirm({
  campaign,
  loading,
  onConfirm,
  onCancel,
}: {
  campaign: CampaignSummary | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Why: the count only runs while the dialog is open for a campaign, so closing it costs nothing.
  const audience = campaign ? audienceOf(draftFromCampaign(campaign)) : {};
  const count = useAudienceCount(audience, campaign !== null);
  const description = campaign
    ? activateDescription({
        count: count.data,
        counting: count.isPending,
        failed: count.isError,
        dailyNew: campaign.daily_new_enrolments,
        sequences: campaign.arms.length,
      })
    : '';

  return (
    <ConfirmDialog
      open={campaign !== null}
      title={campaign ? `Start "${campaign.name}"?` : 'Start campaign?'}
      description={description}
      confirmLabel="Start sending"
      loadingLabel="Starting..."
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
