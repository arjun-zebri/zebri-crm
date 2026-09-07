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
};

const loadMock = vi.fn(async () => ({ ok: true as const, data: detail }));
const updateConfigMock = vi.fn(async () => ({ ok: true as const, data: null }));

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
});
