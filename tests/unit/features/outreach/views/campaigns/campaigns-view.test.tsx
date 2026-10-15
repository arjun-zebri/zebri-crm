// tests/unit/features/outreach/views/campaigns/campaigns-view.test.tsx
/**
 * Campaigns tab: the empty state holds "New campaign" (the header hides it),
 * the full Ready to send card is gone, and `?new=1` opens the editor.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const search = { current: new URLSearchParams() };
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => search.current,
  useRouter: () => ({ replace, push: vi.fn() }),
}));

const campaignsState = { data: [] as unknown[], isPending: false, isError: false, refetch: vi.fn() };
const readinessState = { data: { sendingPaused: false, pausedReason: null, items: [] } as unknown };
vi.mock('@/features/outreach/hooks', () => ({
  OUTREACH_KEY: 'outreach',
  useCampaigns: () => campaignsState,
  useSequences: () => ({ data: [{ id: 's1', name: 'Intro' }], isPending: false }),
  useReadiness: () => readinessState,
  useOutreachMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/outreach/actions', () => ({ setCampaignStatusAction: vi.fn(), deleteCampaignAction: vi.fn(), resumeSendingAction: vi.fn() }));
// The activate confirm runs an audience count query; it is not under test here.
vi.mock('@/features/outreach/views/campaigns/activate-confirm', () => ({ ActivateConfirm: () => null }));
vi.mock('@/features/outreach/views/readiness/setup-summary-link', () => ({
  SetupSummaryLink: () => <p>3 things to set up before campaigns can send</p>,
}));

vi.mock('@/features/outreach/views/campaigns/campaign-editor', () => ({
  CampaignEditor: ({ initial, onClose }: { initial: { name: string }; onClose: () => void }) => (
    <div role="dialog" aria-label="Campaign editor">
      <p>draft name: {initial.name}</p>
      <button type="button" onClick={onClose}>
        Close editor
      </button>
    </div>
  ),
}));

import { CampaignsView } from '@/features/outreach/views/campaigns-view';

beforeEach(() => {
  replace.mockClear();
  campaignsState.data = [];
  search.current = new URLSearchParams();
  readinessState.data = { sendingPaused: false, pausedReason: null, items: [] };
});

describe('Campaigns empty state', () => {
  it('holds the New campaign primary action once, and hides the header button', () => {
    render(<CampaignsView />);
    expect(screen.getAllByRole('button', { name: 'New campaign' })).toHaveLength(1);
  });

  it('opens the editor from the empty-state action', () => {
    render(<CampaignsView />);
    fireEvent.click(screen.getByRole('button', { name: 'New campaign' }));
    expect(screen.getByRole('dialog', { name: 'Campaign editor' })).toBeInTheDocument();
  });

  it('renders the setup summary link instead of the full checklist', () => {
    render(<CampaignsView />);
    expect(screen.getByText('3 things to set up before campaigns can send')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ready to send' })).not.toBeInTheDocument();
  });

  it('keeps the sending-paused banner when sending is paused', () => {
    readinessState.data = { sendingPaused: true, pausedReason: 'Gmail disconnected', items: [] };
    render(<CampaignsView />);
    expect(screen.getByText('Gmail disconnected')).toBeInTheDocument();
  });
});

describe('Campaigns ?new=1 URL param', () => {
  it('opens a blank editor and strips the param on close', () => {
    search.current = new URLSearchParams('view=campaigns&new=1');
    render(<CampaignsView />);
    expect(screen.getByText('draft name:')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
    expect(replace).toHaveBeenCalledWith('/admin/outreach?view=campaigns');
  });
});
