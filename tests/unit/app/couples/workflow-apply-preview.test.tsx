/**
 * The couple tab's Start dialog shows the calendar first (Phase 3, Task 20).
 *
 * Start no longer applies on the spot: it opens a preview of when each
 * step will run for this couple, with the steps whose date has already
 * passed flagged as skipped, and only "Start workflow" applies. The
 * server actions are stubbed; the projection itself is pinned in
 * `tests/unit/lib/workflows/apply-projection.test.ts`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const COUPLE_ID = '22222222-2222-4222-8222-222222222222';

let preview: ApplyPreview;
type PreviewResult = { ok: true; data: ApplyPreview } | { ok: false; error: string };
const previewApplyAction = vi.fn(async (): Promise<PreviewResult> => ({ ok: true, data: preview }));

vi.mock('@/app/(dashboard)/workflows/instance-actions', () => ({
  loadApplicableTemplatesAction: vi.fn(async () => ({
    ok: true,
    data: [{ id: TEMPLATE_ID, name: 'Wedding countdown', description: null, tagIds: [] }],
  })),
  previewApplyAction: (...args: unknown[]) => previewApplyAction(...(args as [])),
}));

import { WorkflowApplyPicker } from '@/app/(dashboard)/couples/workflow-apply-picker';
import type { ApplyPreview } from '@/lib/workflows/apply-projection';

const threeWeeksOut: ApplyPreview = {
  templateName: 'Wedding countdown',
  weddingDate: '2026-10-15',
  rows: [
    { id: 'a', title: 'Six months out', type: 'action', date: '2026-04-15', timing: '6 months before the wedding', flag: 'skipped_past', depth: 0 },
    { id: 'b', title: 'Three months out', type: 'action', date: '2026-07-15', timing: '3 months before the wedding', flag: 'skipped_past', depth: 0 },
    { id: 'c', title: 'Ring the venue', type: 'todo', date: '2026-09-30', timing: 'Straight after the step above', flag: 'manual', depth: 0 },
    { id: 'd', title: 'A week out', type: 'action', date: '2026-10-08', timing: '1 week before the wedding', flag: 'scheduled', depth: 0 },
  ],
};

function renderPicker(appliedTemplateIds: string[] = []) {
  const onApply = vi.fn(async () => 'instance-1');
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WorkflowApplyPicker
        isOpen
        onClose={onClose}
        coupleId={COUPLE_ID}
        appliedTemplateIds={appliedTemplateIds}
        onApply={onApply}
      />
    </QueryClientProvider>,
  );
  return { onApply, onClose };
}

async function openPreview(label = 'Start') {
  fireEvent.click(await screen.findByRole('button', { name: label }));
  await screen.findByText('Six months out');
}

describe('WorkflowApplyPicker preview', () => {
  beforeEach(() => {
    preview = threeWeeksOut;
    previewApplyAction.mockClear();
  });

  it('opens the preview on Start and applies nothing until "Start workflow"', async () => {
    const { onApply, onClose } = renderPicker();
    await openPreview();

    expect(previewApplyAction).toHaveBeenCalledWith({ templateId: TEMPLATE_ID, coupleId: COUPLE_ID });
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText('2026-10-08')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(TEMPLATE_ID, false));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('flags each past step with the reason, and says how many up top', async () => {
    renderPicker();
    await openPreview();

    expect(screen.getAllByText('Date already passed, will be skipped')).toHaveLength(2);
    expect(
      screen.getByText('2 steps will be skipped because their dates have passed.'),
    ).toBeInTheDocument();
  });

  it('goes back to the list on Back, having applied nothing', async () => {
    const { onApply } = renderPicker();
    await openPreview();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.queryByText('Six months out')).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('warns that wedding-dated steps wait when the couple has no wedding date', async () => {
    preview = {
      templateName: 'Wedding countdown',
      weddingDate: null,
      rows: [
        { id: 'a', title: 'Six months out', type: 'action', date: null, timing: '6 months before the wedding', flag: 'needs_wedding_date', depth: 0 },
      ],
    };
    renderPicker();
    await openPreview();

    expect(
      screen.getByText(
        'This couple has no wedding date yet. Steps timed from the wedding will wait until one is set.',
      ),
    ).toBeInTheDocument();
  });

  it('shows an error with a retry when the preview cannot load, and will not start', async () => {
    previewApplyAction.mockResolvedValueOnce({ ok: false, error: 'Workflow not found.' });
    const { onApply } = renderPicker();
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));

    expect(await screen.findByText('Could not preview this workflow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start workflow' })).toBeDisabled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('says so when the workflow has no steps', async () => {
    preview = { templateName: 'Wedding countdown', weddingDate: '2026-10-15', rows: [] };
    renderPicker();
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));

    expect(await screen.findByText('This workflow has no steps yet')).toBeInTheDocument();
  });

  it('keeps the second-copy warning for Start again', async () => {
    const { onApply } = renderPicker([TEMPLATE_ID]);
    await openPreview('Start again');

    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));
    expect(await screen.findByText('Start this workflow again?')).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Start again' }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(TEMPLATE_ID, true));
  });
});
