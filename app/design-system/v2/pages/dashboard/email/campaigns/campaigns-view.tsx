import { Button } from '@/components/ui-v2/button';
import { EmptyState } from '@/components/ui-v2/empty-state';
import { SearchIcon } from '@/components/ui-v2/icons';
import { Panel } from '@/components/ui-v2/panel';
import { RowSections } from '@/components/ui-v2/row-sections';

import { money } from '../../payments/payments-data';
import { CAMPAIGN_GROUPS, bookedValue, listById } from '../campaigns-data';
import type { EmailState } from '../use-email-state';

import { CampaignRow } from './campaign-row';

/**
 * The Campaigns tab: every campaign in sections by where it stands
 * (Scheduled, Drafts, Sent), newest first inside each. The Sent heading
 * carries the total booked from email, so the tab leads with the money.
 * Search matches the campaign's name and its list's.
 *
 * @module app/design-system/v2/pages/dashboard/email/campaigns/campaigns-view
 */

export interface CampaignsViewProps {
  state: EmailState;
  /** Lower-cased, trimmed search text. */
  query: string;
  onOpen: (id: string) => void;
  onClearQuery: () => void;
}

/** The Campaigns tab. See {@link CampaignsViewProps}. */
export function CampaignsView({ state, query, onOpen, onClearQuery }: CampaignsViewProps) {
  const rows = state.campaigns
    .filter((c) => query === '' || `${c.name} ${listById(c.list).name}`.toLowerCase().includes(query))
    .sort((a, b) => (b.on ?? '').localeCompare(a.on ?? ''));
  if (rows.length === 0)
    return (
      <Panel>
        <EmptyState
          compact
          icon={SearchIcon}
          title="Nothing matches that search"
          body="Search looks through campaign names and the lists they went to."
          action={
            <Button variant="secondary" onClick={onClearQuery}>
              Clear search
            </Button>
          }
        />
      </Panel>
    );
  return (
    <RowSections
      sections={CAMPAIGN_GROUPS}
      items={rows}
      sectionOf={(c) => c.group}
      note={(xs) => (xs[0]?.group === 'sent' ? `${money(xs.reduce((s, c) => s + bookedValue(c), 0))} booked` : '')}
      renderRow={(c) => <CampaignRow key={c.id} campaign={c} onOpen={() => onOpen(c.id)} />}
    />
  );
}
