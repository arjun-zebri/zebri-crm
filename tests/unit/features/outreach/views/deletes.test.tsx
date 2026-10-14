/**
 * Where Delete is offered for campaigns, sequences and prospects, and that
 * the prospect delete asks first and closes the modal once it is done.
 * The server's refusals are covered in tests/integration/outreach/deletes.test.ts.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mutate = vi.fn();
vi.mock('@/features/outreach/hooks', () => ({
  useOutreachMutation: () => ({ mutate, isPending: false }),
}));
vi.mock('@/features/outreach/actions', () => ({ deleteProspectAction: vi.fn() }));
vi.mock('@/features/outreach/views/prospects/drawer-action-dialogs', () => ({
  LinkUserDialog: () => null, LogContactDialog: () => null, MarkRepliedDialog: () => null,
}));

import { CampaignList } from '@/features/outreach/views/campaigns/campaign-list';
import { DrawerActions } from '@/features/outreach/views/prospects/drawer-actions';
import { SequenceList } from '@/features/outreach/views/sequences/sequence-list';
import type { CampaignSummary, SequenceWithSteps } from '@/lib/outreach/services/queries';

function campaign(status: string): CampaignSummary {
  return {
    id: `c-${status}`, name: `Spring ${status}`, status, audience: {}, daily_new_enrolments: 5,
    created_at: '2026-10-01T00:00:00Z', activated_at: null, arms: [], enrolled: 0, active: 0,
  } as CampaignSummary;
}

function renderCampaigns(status: string, onDelete = vi.fn()) {
  render(
    <CampaignList
      campaigns={[campaign(status)]} sequenceNames={new Map()} pending={false}
      onEdit={vi.fn()} onStatus={vi.fn()} onActivate={vi.fn()} onFinish={vi.fn()} onDelete={onDelete}
    />,
  );
  return onDelete;
}

const menuFor = (name: string) => screen.queryByRole('button', { name: `More actions for ${name}` });

describe('CampaignList delete', () => {
  it('offers Delete on a paused campaign and passes the campaign on', () => {
    const onDelete = renderCampaigns('paused');
    fireEvent.click(menuFor('Spring paused')!);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'c-paused' }));
  });

  it('does not offer Delete while the campaign is active', () => {
    renderCampaigns('active');
    fireEvent.click(menuFor('Spring active')!);
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('offers Delete, not Finish, on a finished campaign', () => {
    renderCampaigns('finished');
    fireEvent.click(menuFor('Spring finished')!);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument();
  });
});

describe('SequenceList delete', () => {
  const seq = (campaign_count: number) =>
    ({ id: 's1', name: 'Intro', steps: [], campaign_count, archived_at: null }) as unknown as SequenceWithSteps;

  it('offers Delete next to Archive on an unused sequence', () => {
    const onDelete = vi.fn();
    render(<SequenceList sequences={[seq(0)]} onEdit={vi.fn()} onArchive={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(menuFor('Intro')!);
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
  });

  it('withholds both while a campaign uses it, and says why', () => {
    render(<SequenceList sequences={[seq(2)]} onEdit={vi.fn()} onArchive={vi.fn()} onDelete={vi.fn()} />);
    expect(menuFor('Intro')).not.toBeInTheDocument();
    expect(screen.getByText(/before you can archive or delete it/)).toBeInTheDocument();
  });
});

describe('DrawerActions delete', () => {
  it('asks first, deletes the prospect, then closes the modal', () => {
    mutate.mockReset();
    const onDeleted = vi.fn();
    render(<DrawerActions prospectId="p1" name="Jo Smith" onDeleted={onDeleted} />);
    fireEvent.click(menuFor('Jo Smith')!);
    fireEvent.click(screen.getByRole('button', { name: 'Delete prospect' }));
    expect(mutate).not.toHaveBeenCalled();

    expect(screen.getByText('Delete this prospect?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mutate).toHaveBeenCalledWith('p1', expect.anything());
    const opts = mutate.mock.calls[0]![1] as { onSuccess: () => void };
    opts.onSuccess();
    expect(onDeleted).toHaveBeenCalled();
  });
});
