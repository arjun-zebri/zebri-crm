/**
 * @module tests/unit/app/proposals/proposals-stats
 */
import { describe, expect, it } from 'vitest';

import { computeProposalStats } from '@/app/(dashboard)/proposals/proposals-stats';
import type { ProposalListRow } from '@/app/(dashboard)/proposals/use-proposals';

const row = (over: Partial<ProposalListRow> = {}): ProposalListRow => ({
  id: 'p1',
  proposal_number: 'PR-001',
  title: 'Anna & Jake',
  status: 'draft',
  expires_at: null,
  email_sent_at: null,
  last_viewed_at: null,
  view_count: 0,
  created_at: '2026-09-01T00:00:00Z',
  couple: { id: 'c1', name: 'Anna & Jake' },
  proposal_options: [],
  ...over,
});

describe('computeProposalStats', () => {
  it('counts total and each status bucket', () => {
    const rows = [
      row({ id: '1', status: 'draft' }),
      row({ id: '2', status: 'sent' }),
      row({ id: '3', status: 'sent' }),
      row({ id: '4', status: 'viewed' }),
      row({ id: '5', status: 'accepted' }),
      row({ id: '6', status: 'declined' }),
      row({ id: '7', status: 'expired' }),
    ];
    expect(computeProposalStats(rows)).toEqual({ total: 7, sent: 2, viewed: 1, accepted: 1 });
  });

  it('returns all zeros for an empty list', () => {
    expect(computeProposalStats([])).toEqual({ total: 0, sent: 0, viewed: 0, accepted: 0 });
  });
});
