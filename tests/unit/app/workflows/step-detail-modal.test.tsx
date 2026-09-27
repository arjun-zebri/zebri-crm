/**
 * The step detail modal.
 *
 * It is the only place a held send can be authorised, and the only
 * place an already-applied step can be corrected: the builder edits the
 * template every future couple gets, this edits the copy taken for this
 * one. It opens as a form with the step's own words already in it -
 * there is no Edit button to find first - and the action's own slug is
 * not editable here, so both are pinned.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StepDetailModal } from '@/app/(dashboard)/workflows/step-detail-modal';

const detail = {
  stepId: 'step-1',
  title: 'Add note · Rang the venue',
  description: null,
  type: 'action',
  actionType: 'add_note',
  config: { actionType: 'add_note', text: 'Old note' },
  status: 'pending',
  errorMessage: null,
  dueAt: null,
  requiresApproval: false,
  instanceName: 'Booking flow',
  coupleId: 'couple-1',
  coupleName: 'Sam & Priya',
  weddingDate: null,
  stepIndex: 2,
  stepTotal: 4,
  preview: null,
  blockedReason: null,
};

const loadMock = vi.fn(async () => ({ ok: true as const, data: detail }));
const updateConfigMock = vi.fn<() => Promise<{ ok: true; data: null } | { ok: false; error: string }>>(
  async () => ({ ok: true as const, data: null }),
);

vi.mock('@/app/(dashboard)/workflows/instance-actions', () => ({
  loadStepDetailAction: (...args: unknown[]) => loadMock(...(args as [])),
  updateStepConfigAction: (...args: unknown[]) => updateConfigMock(...(args as [])),
  approveStepAction: vi.fn(async () => ({ ok: true, data: null })),
  renameStepAction: vi.fn(async () => ({ ok: true, data: null })),
  rescheduleStepAction: vi.fn(async () => ({ ok: true, data: null })),
  retryStepAction: vi.fn(async () => ({ ok: true, data: null })),
  saveStepMessageAction: vi.fn(async () => ({ ok: true, data: null })),
  tickStepAction: vi.fn(async () => ({ ok: true, data: null })),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

// The account-wide workflow stop (Task 18). Running unless a case says
// otherwise.
const stopState = { paused: false };
vi.mock('@/app/(dashboard)/workflows/account-pause-actions', () => ({
  getAccountPauseAction: async () => ({
    ok: true,
    data: { paused: stopState.paused, pausedAt: stopState.paused ? '2026-09-24T01:00:00.000Z' : null },
  }),
  pauseAccountWorkflowsAction: async () => ({ ok: true, data: null }),
  resumeAccountWorkflowsAction: async () => ({ ok: true, data: null }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderModal() {
  const onSettled = vi.fn();
  render(
    <StepDetailModal stepId="step-1" onClose={vi.fn()} onSettled={onSettled} />,
    { wrapper },
  );
  return { onSettled };
}

describe('StepDetailModal', () => {
  beforeEach(() => {
    loadMock.mockClear();
    updateConfigMock.mockClear();
    stopState.paused = false;
  });

  it('says, next to Send, that the account stop does not hold back a send the MC presses', async () => {
    stopState.paused = true;
    renderModal();
    expect(
      await screen.findByText(/All workflows are paused\. Pressing Send & complete still runs this step/),
    ).toBeInTheDocument();
  });

  it('says nothing about the stop while the account is running', async () => {
    renderModal();
    await screen.findByRole('button', { name: /Send & complete/ });
    expect(screen.queryByText(/All workflows are paused/)).not.toBeInTheDocument();
  });

  it('names the step in the header rather than in an empty body', async () => {
    renderModal();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Add note · Rang the venue' }),
      ).toBeInTheDocument(),
    );
  });

  it('drops the keyboard cheat sheet', async () => {
    renderModal();
    await screen.findByText(/Sam & Priya/);
    expect(screen.queryByText(/to complete/)).toBeNull();
  });

  it('opens on the step\'s own fields, with its words already in them', async () => {
    renderModal();
    // No Edit button to find first: the step is the form.
    expect(await screen.findByLabelText('Note text')).toHaveValue('Old note');
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it("saves an applied step's own fields, keeping the action it is", async () => {
    renderModal();

    const note = await screen.findByLabelText('Note text');
    fireEvent.change(note, { target: { value: 'Rang them, all sorted' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateConfigMock).toHaveBeenCalled());
    const [input] = updateConfigMock.mock.calls[0] as unknown as [
      { stepId: string; config: Record<string, unknown> },
    ];
    expect(input.stepId).toBe('step-1');
    expect(input.config['text']).toBe('Rang them, all sorted');
    // Changing what a step *is* stays a builder decision.
    expect(input.config['actionType']).toBe('add_note');
  });

  it('shows a refused save inline and stays open, so the draft is not lost (Task 33)', async () => {
    const refusal = 'The "Add note" step has invalid settings: Text is required. Fix this before saving.';
    updateConfigMock.mockResolvedValueOnce({ ok: false, error: refusal });
    const { onSettled } = renderModal();

    const note = await screen.findByLabelText('Note text');
    fireEvent.change(note, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(refusal)).toBeInTheDocument();
    expect(onSettled).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Note text')).toHaveValue('');
  });

  it('brings a refused save into view and focuses it, every time Save is refused (live check B3)', async () => {
    // The message sits under the preview, far below the fold of a long
    // step: without this, pressing Save changed nothing on screen.
    const scrolled = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrolled;
    try {
      const refusal = 'The "Add note" step has invalid settings: Text is required. Fix this before saving.';
      updateConfigMock.mockResolvedValueOnce({ ok: false, error: refusal });
      updateConfigMock.mockResolvedValueOnce({ ok: false, error: refusal });
      renderModal();

      const note = await screen.findByLabelText('Note text');
      fireEvent.change(note, { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(refusal);
      await waitFor(() => expect(alert).toHaveFocus());
      expect(scrolled).toHaveBeenCalledTimes(1);

      // The same refusal again still scrolls: the MC may have scrolled away.
      screen.getByLabelText('Note text').focus();
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(scrolled).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus());
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
