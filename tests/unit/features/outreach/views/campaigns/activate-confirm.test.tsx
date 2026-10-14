/**
 * Activate must not start sends on the first click. The confirmation
 * shows the live audience size and the pace before anything is activated.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivateConfirm } from '@/features/outreach/views/campaigns/activate-confirm';
import type { CampaignSummary } from '@/lib/outreach/services/queries';

const countAudienceAction = vi.fn(async (audience: unknown) => {
  void audience;
  return { ok: true as const, data: 37 };
});
vi.mock('@/features/outreach/actions', () => ({
  countAudienceAction: (audience: unknown) => countAudienceAction(audience),
}));

const campaign = {
  id: 'c1',
  name: 'NSW October',
  status: 'draft',
  audience: { states: ['NSW'], minScore: 40 },
  daily_new_enrolments: 15,
  arms: [
    { sequence_id: 's1', weight: 1 },
    { sequence_id: 's2', weight: 1 },
  ],
  enrolled: 0,
  active: 0,
} as unknown as CampaignSummary;

function renderConfirm(onConfirm = vi.fn(), onCancel = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ActivateConfirm campaign={campaign} loading={false} onConfirm={onConfirm} onCancel={onCancel} />
    </QueryClientProvider>,
  );
  return { onConfirm, onCancel };
}

describe('ActivateConfirm', () => {
  beforeEach(() => countAudienceAction.mockClear());

  it('states the audience size and the daily pace once counted', async () => {
    renderConfirm();
    expect(await screen.findByText('Start sending to up to 37 celebrants, 15 new per day across 2 sequences?')).toBeInTheDocument();
  });

  it('counts the campaign audience, not an unfiltered one', async () => {
    renderConfirm();
    await waitFor(() => expect(countAudienceAction).toHaveBeenCalled());
    expect(countAudienceAction).toHaveBeenCalledWith({ states: ['NSW'], minScore: 40 });
  });

  it('calls onConfirm only when the founder presses Start sending', async () => {
    const { onConfirm } = renderConfirm();
    await screen.findByText(/Start sending to up to 37/);
    expect(onConfirm).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Start sending' }).click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
