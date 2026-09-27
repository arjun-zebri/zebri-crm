/**
 * A step action that fails shows the MC why (Task 36 fix round 1,
 * review I2).
 *
 * The checklist and the Upcoming queue ticked, skipped and un-ticked
 * with no `onError`: a failure left the checkbox as it was and said
 * nothing. Each mutation now toasts the action's own readable message.
 * And Send & complete that sent but could not finish the step says so,
 * once, without asking for a second press.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const failure = { ok: false as const, error: 'Zebri could not reach the database. Try again in a moment.' };

const actions = vi.hoisted(() => ({
  tickStepAction: vi.fn(),
  skipStepAction: vi.fn(),
  untickStepAction: vi.fn(),
  rescheduleStepAction: vi.fn(),
  retryStepAction: vi.fn(),
  approveStepAction: vi.fn(),
  countDoneAction: vi.fn(),
  loadDoneAction: vi.fn(),
  loadCoupleWorkflowsAction: vi.fn(),
  applyTemplateToCoupleAction: vi.fn(),
  addAdHocStepAction: vi.fn(),
  cancelCoupleWorkflowsAction: vi.fn(),
  cancelInstanceAction: vi.fn(),
  deleteInstanceStepAction: vi.fn(),
  renameStepAction: vi.fn(),
  saveStepMessageAction: vi.fn(),
  updateStepConfigAction: vi.fn(),
}));
vi.mock('@/app/(dashboard)/workflows/instance-actions', () => actions);

import { useCoupleWorkflows } from '@/app/(dashboard)/couples/use-couple-workflows';
import { DoneSection } from '@/app/(dashboard)/workflows/done-section';
import { useQueueStepMutations } from '@/app/(dashboard)/workflows/use-queue-step-mutations';
import { useStepDetailActions } from '@/app/(dashboard)/workflows/use-step-detail-actions';
import { ToastProvider } from '@/components/ui/toast';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.loadCoupleWorkflowsAction.mockResolvedValue({ ok: true, data: [] });
});

describe('failed step actions toast their message', () => {
  it('the Upcoming queue: tick', async () => {
    actions.tickStepAction.mockResolvedValue(failure);
    const { result } = renderHook(() => useQueueStepMutations(() => {}), { wrapper });
    act(() => result.current.tick.mutate('step-1'));
    expect(await screen.findByText(failure.error)).toBeInTheDocument();
  });

  it('the Upcoming queue: skip', async () => {
    actions.skipStepAction.mockResolvedValue(failure);
    const { result } = renderHook(() => useQueueStepMutations(() => {}), { wrapper });
    act(() => result.current.skip.mutate('step-1'));
    expect(await screen.findByText(failure.error)).toBeInTheDocument();
  });

  it('the Done strip: un-tick', async () => {
    actions.countDoneAction.mockResolvedValue({ ok: true, data: 1 });
    actions.loadDoneAction.mockResolvedValue({
      ok: true,
      data: [
        {
          stepId: 'step-1',
          instanceId: 'i1',
          instanceName: 'Enquiry',
          coupleId: null,
          coupleName: null,
          weddingDate: null,
          title: 'Call the venue',
          type: 'todo',
          status: 'done',
          dueAt: null,
          completedAt: '2026-09-25T01:00:00.000Z',
        },
      ],
    });
    actions.untickStepAction.mockResolvedValue(failure);
    render(<DoneSection timezone="Australia/Sydney" onOpen={() => {}} onRestored={() => {}} />, { wrapper });

    fireEvent.click(await screen.findByRole('button', { name: /Done \(1\)/ }));
    fireEvent.click(await screen.findByLabelText('Put "Call the venue" back on the list'));

    expect(await screen.findByText(failure.error)).toBeInTheDocument();
  });

  it('the couple checklist: tick', async () => {
    actions.tickStepAction.mockResolvedValue(failure);
    const { result } = renderHook(() => useCoupleWorkflows('couple-1'), { wrapper });
    act(() => result.current.tick('step-1'));
    expect(await screen.findByText(failure.error)).toBeInTheDocument();
  });

  it('the couple checklist: apply', async () => {
    actions.applyTemplateToCoupleAction.mockResolvedValue(failure);
    const { result } = renderHook(() => useCoupleWorkflows('couple-1'), { wrapper });
    await act(async () => {
      await result.current.applyTemplate('template-1');
    });
    expect(await screen.findByText(failure.error)).toBeInTheDocument();
  });
});

describe('Send & complete that sent but did not finish', () => {
  it('toasts the notice and still closes, so a second press is not needed', async () => {
    actions.approveStepAction.mockResolvedValue({
      ok: true,
      data: { notice: 'Sent. Finishing the step failed; it will retry.' },
    });
    const onDone = vi.fn();
    const onFail = vi.fn();
    const draft = { stepId: 'step-1', form: null, edits: undefined, manual: { title: '', description: '', due: '' }, config: {} };
    const { result } = renderHook(() => useStepDetailActions(draft, onDone, onFail), { wrapper });

    act(() => result.current.act.mutate('send'));

    expect(await screen.findByText('Sent. Finishing the step failed; it will retry.')).toBeInTheDocument();
    expect(onDone).toHaveBeenCalled();
    expect(onFail).not.toHaveBeenCalled();
  });
});
