import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProposalEngagement } from '@/app/(dashboard)/proposals/[id]/proposal-engagement';
import type { ProposalDetailRow } from '@/app/(dashboard)/proposals/use-proposals';
import { doc, paragraph } from '@/features/proposals';
import type { EngagementRow } from '@/lib/proposals/engagement';

const useProposalEvents = vi.fn();
vi.mock('@/app/(dashboard)/proposals/use-proposal-events', () => ({
  useProposalEvents: (id: string) => useProposalEvents(id),
}));

const proposal: ProposalDetailRow = {
  id: 'p1', proposal_number: 'PR-001', title: 'Anna & Jake', status: 'viewed', version: 2,
  expires_at: null, email_sent_at: null, first_viewed_at: null, last_viewed_at: null,
  view_count: 2, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
  share_token: 'tok', share_token_enabled: true,
  declined_reason: null, declined_message: null, contract_id: null, invoice_id: null, template_id: null,
  couple: { id: 'c1', name: 'Anna & Jake' },
  proposal_options: [{ id: 'opt1', subtotal: 1500, is_popular: true, position: 1, title: 'Full Day MC' }],
  layout: null,
  accepted_option_id: null,
};

const style = { height: 'fit' as const };
// A v2 layout: the page break must not appear in the report.
const v2Layout = {
  version: 2,
  sections: [
    { id: 's1', kind: 'content', name: 'Cover', style, content: doc(paragraph()) },
    { id: 's2', kind: 'packages', name: 'Your options', style, data: { kind: 'packages', packages: {} } },
    { id: 's3', kind: 'pageBreak', style },
    { id: 's4', kind: 'faq', name: 'FAQ', style, data: { kind: 'faq', faq: {} } },
  ],
};
const v2Proposal: ProposalDetailRow = {
  ...proposal,
  layout: v2Layout,
  accepted_option_id: 'opt1',
  proposal_options: [
    { id: 'opt1', subtotal: 1500, is_popular: true, position: 1, title: 'Full Day MC' },
    { id: 'opt2', subtotal: 900, is_popular: false, position: 2, title: 'Reception MC' },
  ],
};
const v2Rows: EngagementRow[] = [
  { session_id: 'a', type: 'opened', payload: { device: 'phone' }, created_at: '2026-09-14T10:00:00Z' },
  { session_id: 'a', type: 'section_viewed', payload: { sectionId: 's1', seconds: 10 }, created_at: '2026-09-14T10:01:00Z' },
  { session_id: 'a', type: 'section_viewed', payload: { sectionId: 's2', seconds: 30 }, created_at: '2026-09-14T10:02:00Z' },
  { session_id: 'a', type: 'package_viewed', payload: { optionId: 'opt1', seconds: 20 }, created_at: '2026-09-14T10:02:00Z' },
  { session_id: 'b', type: 'opened', payload: { device: 'desktop' }, created_at: '2026-09-15T10:00:00Z' },
  { session_id: 'b', type: 'section_viewed', payload: { sectionId: 's1', seconds: 5 }, created_at: '2026-09-15T10:01:00Z' },
  { session_id: 'b', type: 'section_viewed', payload: { sectionId: 's4', seconds: 12 }, created_at: '2026-09-15T10:02:00Z' },
];

// Two sessions: the older one only viewed a section and glanced at the
// package; the newer one selected the package, walked every step, and
// accepted. Between them: 2 distinct "opened" sessions, 40s total on the
// `packages` section, 25s lingered on the one option, furthest step
// `done`, outcome `accepted`.
const rows: EngagementRow[] = [
  { session_id: 'sess-a', type: 'opened', payload: {}, created_at: '2026-09-14T10:00:00Z' },
  { session_id: 'sess-a', type: 'section_viewed', payload: { blockId: 'b1', blockType: 'packages', seconds: 25 }, created_at: '2026-09-14T10:01:00Z' },
  { session_id: 'sess-a', type: 'package_viewed', payload: { optionId: 'opt1', seconds: 25 }, created_at: '2026-09-14T10:01:00Z' },
  { session_id: 'sess-a', type: 'step_reached', payload: { step: 'choose' }, created_at: '2026-09-14T10:02:00Z' },
  { session_id: 'sess-b', type: 'opened', payload: {}, created_at: '2026-09-15T10:30:00Z' },
  { session_id: 'sess-b', type: 'section_viewed', payload: { blockId: 'b1', blockType: 'packages', seconds: 15 }, created_at: '2026-09-15T10:31:00Z' },
  { session_id: 'sess-b', type: 'package_selected', payload: { optionId: 'opt1' }, created_at: '2026-09-15T10:32:00Z' },
  { session_id: 'sess-b', type: 'step_reached', payload: { step: 'choose' }, created_at: '2026-09-15T10:33:00Z' },
  { session_id: 'sess-b', type: 'step_reached', payload: { step: 'sign' }, created_at: '2026-09-15T10:34:00Z' },
  { session_id: 'sess-b', type: 'step_reached', payload: { step: 'pay' }, created_at: '2026-09-15T10:35:00Z' },
  { session_id: 'sess-b', type: 'step_reached', payload: { step: 'done' }, created_at: '2026-09-15T10:36:00Z' },
  { session_id: 'sess-b', type: 'accepted', payload: {}, created_at: '2026-09-15T10:37:00Z' },
];

describe('ProposalEngagement', () => {
  describe('Layout v2 proposals', () => {
    it('reads by section in layout order, without the page break or a sample pill', () => {
      useProposalEvents.mockReturnValue({ data: v2Rows, isLoading: false, error: null });
      render(<ProposalEngagement proposal={v2Proposal} />);
      expect(screen.getByRole('heading', { name: 'Reading by section' })).toBeInTheDocument();
      const labels = ['Cover', 'Your options', 'FAQ'].map((l) => screen.getAllByText(l)[0] as HTMLElement);
      expect(labels[0]!.compareDocumentPosition(labels[1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(labels[1]!.compareDocumentPosition(labels[2]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.queryByText('Page break')).not.toBeInTheDocument();
      expect(screen.getAllByText('100% reached')).toHaveLength(2);
      expect(screen.getByText('50% reached')).toBeInTheDocument();
      expect(screen.getAllByText('30s').length).toBeGreaterThan(0);
      expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
    });

    it('lists the proposal option titles and marks the accepted one Chosen', () => {
      useProposalEvents.mockReturnValue({ data: v2Rows, isLoading: false, error: null });
      render(<ProposalEngagement proposal={v2Proposal} />);
      expect(screen.getByRole('heading', { name: 'Packages' })).toBeInTheDocument();
      expect(screen.getAllByText('Full Day MC').length).toBeGreaterThan(0);
      expect(screen.getByText('Reception MC')).toBeInTheDocument();
      expect(screen.getAllByText('Chosen')).toHaveLength(1);
      expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
    });

    it('shows the device line, omitting zero buckets', () => {
      useProposalEvents.mockReturnValue({ data: v2Rows, isLoading: false, error: null });
      render(<ProposalEngagement proposal={v2Proposal} />);
      expect(screen.getByRole('heading', { name: 'Devices' })).toBeInTheDocument();
      expect(screen.getByText('2 sessions: 1 phone, 1 desktop')).toBeInTheDocument();
    });

    it('shows only the empty state when nobody has opened it', () => {
      useProposalEvents.mockReturnValue({ data: [], isLoading: false, error: null });
      render(<ProposalEngagement proposal={v2Proposal} />);
      expect(screen.getByText('No opens yet')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Reading by section' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Packages' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Devices' })).not.toBeInTheDocument();
    });

    it('F3: hides Reading by section when no row matches a layout section (pre-R4 visits)', () => {
      const legacy: EngagementRow[] = [
        { session_id: 'a', type: 'opened', payload: {}, created_at: '2026-09-14T10:00:00Z' },
        { session_id: 'a', type: 'section_viewed', payload: { blockId: 'b1', blockType: 'hero', seconds: 9 }, created_at: '2026-09-14T10:01:00Z' },
        { session_id: 'a', type: 'package_viewed', payload: { optionId: 'opt1', seconds: 4 }, created_at: '2026-09-14T10:01:00Z' },
      ];
      useProposalEvents.mockReturnValue({ data: legacy, isLoading: false, error: null });
      render(<ProposalEngagement proposal={v2Proposal} />);
      expect(screen.queryByRole('heading', { name: 'Reading by section' })).not.toBeInTheDocument();
      expect(screen.queryByText(/% reached/)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Packages' })).toBeInTheDocument();
    });

    it('F7: does not repeat the Lingered on line under the v2 Packages block', () => {
      useProposalEvents.mockReturnValue({ data: v2Rows, isLoading: false, error: null });
      render(<ProposalEngagement proposal={v2Proposal} />);
      expect(screen.queryByText(/^Lingered on .*\(/)).not.toBeInTheDocument();
    });

    it('treats a layout that fails to parse like a v1 proposal', () => {
      useProposalEvents.mockReturnValue({ data: rows, isLoading: false, error: null });
      render(<ProposalEngagement proposal={{ ...proposal, layout: { version: 2, sections: 'nope' } }} />);
      expect(screen.queryByRole('heading', { name: 'Reading by section' })).not.toBeInTheDocument();
      expect(screen.getByText('40s')).toBeInTheDocument();
    });
  });

  it('keeps the top-section bars and no v2 blocks for a v1 proposal', () => {
    useProposalEvents.mockReturnValue({ data: rows, isLoading: false, error: null });
    render(<ProposalEngagement proposal={proposal} />);
    expect(screen.queryByRole('heading', { name: 'Reading by section' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Devices' })).not.toBeInTheDocument();
  });

  it('shows the error state with a retry when the query fails', () => {
    const refetch = vi.fn()
    useProposalEvents.mockReturnValue({ data: undefined, isLoading: false, error: new Error('nope'), refetch })
    render(<ProposalEngagement proposal={proposal} />)
    expect(screen.getByText('Could not load engagement')).toBeInTheDocument()
    screen.getByRole('button', { name: /try again/i }).click()
    expect(refetch).toHaveBeenCalled()
  })

  it('shows the Loading primitive while fetching', () => {
    useProposalEvents.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<ProposalEngagement proposal={proposal} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows "No opens yet" when there are no rows', () => {
    useProposalEvents.mockReturnValue({ data: [], isLoading: false, error: null });
    render(<ProposalEngagement proposal={proposal} />);
    expect(screen.getByText('No opens yet')).toBeInTheDocument();
  });

  it('summarises two sessions: facts, top section bar, lingered package, furthest step, outcome', () => {
    useProposalEvents.mockReturnValue({ data: rows, isLoading: false, error: null });
    render(<ProposalEngagement proposal={proposal} />);
    // M6: "sessions"/"first opened"/"last active", not "views"/"last seen"
    // -- distinct wording from the facts line's own view_count/last_viewed
    // above it, which count something different (every RPC read).
    expect(screen.getByText(/2 sessions/)).toBeInTheDocument();
    expect(screen.getByText(/first opened/)).toBeInTheDocument();
    expect(screen.getByText(/last active/)).toBeInTheDocument();
    // "Packages" also appears under each timeline session below, so the
    // section bar's own row is found via its unique "40s" total and
    // checked from there rather than a plain (ambiguous) text query.
    const barRow = screen.getByText('40s').parentElement as HTMLElement;
    expect(within(barRow).getByText('Packages')).toBeInTheDocument();
    expect(screen.getByText('Lingered on Full Day MC (25s)')).toBeInTheDocument();
    expect(screen.getByText(/Got as far as: Done/)).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
  });

  it('F9: says "1 session", not "1 sessions", for a single visit', () => {
    useProposalEvents.mockReturnValue({ data: rows.filter((r) => r.session_id === 'sess-a'), isLoading: false, error: null });
    render(<ProposalEngagement proposal={proposal} />);
    expect(screen.getByText(/^1 session ·/)).toBeInTheDocument();
    expect(screen.queryByText(/1 sessions/)).not.toBeInTheDocument();
  });

  it('lists the newest session first in the timeline', () => {
    useProposalEvents.mockReturnValue({ data: rows, isLoading: false, error: null });
    render(<ProposalEngagement proposal={proposal} />);
    const [first] = screen.getAllByRole('listitem');
    if (!first) throw new Error('expected at least one timeline entry');
    expect(within(first).getByText(/Chose Full Day MC/)).toBeInTheDocument();
  });

  it('M7: shows the outcome pill and furthest step even with no section rows', () => {
    // Old browser with no IntersectionObserver, or a flush that dropped
    // the section rows while 'accepted' survived on a later one: the
    // outcome must not be nested inside a `topSections.length > 0` check.
    const noSections: EngagementRow[] = [
      { session_id: 'sess-a', type: 'opened', payload: {}, created_at: '2026-09-14T10:00:00Z' },
      { session_id: 'sess-a', type: 'step_reached', payload: { step: 'done' }, created_at: '2026-09-14T10:02:00Z' },
      { session_id: 'sess-a', type: 'accepted', payload: {}, created_at: '2026-09-14T10:03:00Z' },
    ];
    useProposalEvents.mockReturnValue({ data: noSections, isLoading: false, error: null });
    render(<ProposalEngagement proposal={proposal} />);
    expect(screen.getByText(/Got as far as: Done/)).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
  });

  it('m2: an all-zero-seconds section set renders a bar instead of NaN%', () => {
    const zeroSeconds: EngagementRow[] = [
      { session_id: 'sess-a', type: 'opened', payload: {}, created_at: '2026-09-14T10:00:00Z' },
      { session_id: 'sess-a', type: 'section_viewed', payload: { blockId: 'b1', blockType: 'hero', seconds: 0 }, created_at: '2026-09-14T10:01:00Z' },
    ];
    useProposalEvents.mockReturnValue({ data: zeroSeconds, isLoading: false, error: null });
    const { container } = render(<ProposalEngagement proposal={proposal} />);
    const bar = container.querySelector('.bg-brand-fg') as HTMLElement;
    expect(bar.style.width).not.toBe('NaN%');
    expect(bar.style.width).toBe('0%');
  });

  it('m5: loading, error and empty states all render inside the Engagement heading', () => {
    useProposalEvents.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { rerender } = render(<ProposalEngagement proposal={proposal} />);
    expect(screen.getByRole('heading', { name: 'Engagement' })).toBeInTheDocument();

    useProposalEvents.mockReturnValue({ data: [], isLoading: false, error: null });
    rerender(<ProposalEngagement proposal={proposal} />);
    expect(screen.getByRole('heading', { name: 'Engagement' })).toBeInTheDocument();
    expect(screen.getByText('No opens yet')).toBeInTheDocument();
  });
});
