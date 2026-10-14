/**
 * Success toast copy for a campaign status change. Kept as data so the
 * wording is one place and testable without rendering the campaigns view.
 *
 * @module features/outreach/views/campaigns/campaign-status-line
 */

/** The statuses a campaign can be moved to from the Campaigns list. */
export type CampaignNextStatus = 'active' | 'paused' | 'finished';

/** The line shown after a status change succeeds. */
export function campaignStatusLine(next: CampaignNextStatus): string {
  switch (next) {
    case 'active':
      return 'Campaign is live';
    case 'paused':
      return 'Campaign paused. Scheduled follow-ups wait until you resume.';
    case 'finished':
      return 'Campaign finished';
  }
}
