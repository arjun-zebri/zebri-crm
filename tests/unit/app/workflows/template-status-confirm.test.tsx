/**
 * Both workflow on/off switches confirm before they touch live couples
 * (Phase 3, Task 17).
 *
 * Turning a workflow off pauses every couple running it, so the canvas
 * button and the library card switch both ask first, naming the number
 * of couples the server counted. At zero there is nothing to warn about
 * and the change goes straight through. Turning on offers to resume the
 * couples the switch paused, and resumes nothing unless the MC ticks it.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasStatusToggle } from '@/app/(dashboard)/workflows/[id]/canvas-status-toggle';
import type { TemplateListRow } from '@/app/(dashboard)/workflows/actions';
import type { WorkflowLibrary } from '@/app/(dashboard)/workflows/use-workflow-library';
import { WorkflowsTemplates } from '@/app/(dashboard)/workflows/workflows-templates';
import { ToastProvider } from '@/components/ui/toast';

const countMock = vi.fn();
const setStatusMock = vi.fn();

vi.mock('@/app/(dashboard)/workflows/actions', () => ({
  countTemplateEnrolmentsAction: (...args: unknown[]) => countMock(...args),
  setTemplateStatusAction: (...args: unknown[]) => setStatusMock(...args),
  // Every workflow here is finished: the Task 34 pre-flight gate has its
  // own cases in template-preflight-gate.test.tsx.
  templatePreflightAction: async () => ({ ok: true, data: { problems: [] } }),
}));

// The library's other children reach for these; none matter here.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/(dashboard)/workflows/describe-workflow', () => ({ DescribeWorkflow: () => null }));

function counts(running: number, pausedByToggle: number, live = running) {
  countMock.mockResolvedValue({ ok: true, data: { running, pausedByToggle, live } });
}

beforeEach(() => {
  countMock.mockReset();
  setStatusMock.mockReset();
  setStatusMock.mockResolvedValue({ ok: true, data: { paused: 0, resumed: 0, stillPaused: 0 } });
});

describe('the canvas Turn on / Turn off button', () => {
  it('names the server count before turning off, then pauses on confirm', async () => {
    counts(2, 0);
    const onChanged = vi.fn();
    render(<CanvasStatusToggle templateId="t1" status="active" onChanged={onChanged} />);

    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Pause this workflow for 2 couples?');
    expect(countMock).toHaveBeenCalledWith({ templateId: 't1' });
    expect(setStatusMock).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('draft'));
    expect(setStatusMock).toHaveBeenCalledWith({
      templateId: 't1',
      status: 'draft',
      resumePaused: false,
    });
  });

  it('says honestly what stops: new steps, not one already running', async () => {
    counts(2, 0);
    render(<CanvasStatusToggle templateId="t1" status="active" onChanged={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleDescription(
      expect.stringContaining('no new steps will run for the couples running it'),
    );
    expect(dialog).toHaveAccessibleDescription(
      expect.stringContaining('A step already running finishes'),
    );
  });

  it('is busy while the couples are counted, so it cannot be pressed twice', async () => {
    let release: (v: unknown) => void = () => {};
    countMock.mockReturnValue(new Promise((r) => (release = r)));
    render(<CanvasStatusToggle templateId="t1" status="active" onChanged={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Turn off' });
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();

    release({ ok: true, data: { running: 2, pausedByToggle: 0, live: 2 } });
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
  });

  it('reports couples a resume left paused', async () => {
    counts(0, 2);
    setStatusMock.mockResolvedValue({
      ok: true,
      data: { paused: 0, resumed: 1, stillPaused: 1 },
    });
    render(
      <ToastProvider>
        <CanvasStatusToggle templateId="t1" status="draft" onChanged={vi.fn()} />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('checkbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn on' }));

    expect(
      await screen.findByText(
        '1 couple could not be resumed and is still paused. Turn it on again to retry.',
      ),
    ).toBeInTheDocument();
  });

  it('turns off with no dialog when no couple is running it', async () => {
    counts(0, 0);
    const onChanged = vi.fn();
    render(<CanvasStatusToggle templateId="t1" status="active" onChanged={onChanged} />);

    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('draft'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers to resume the couples the switch paused, and resumes only if ticked', async () => {
    counts(0, 3);
    const onChanged = vi.fn();
    render(<CanvasStatusToggle templateId="t1" status="draft" onChanged={onChanged} />);

    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));

    const dialog = await screen.findByRole('dialog');
    const offer = within(dialog).getByRole('checkbox', {
      name: 'Resume the 3 couples paused when this was turned off',
    });
    expect(offer).toHaveAttribute('aria-checked', 'false');
    expect(dialog).toHaveTextContent(
      'Steps that fell due while it was off will be skipped, not sent.',
    );

    await userEvent.click(offer);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn on' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('active'));
    expect(setStatusMock).toHaveBeenCalledWith({
      templateId: 't1',
      status: 'active',
      resumePaused: true,
    });
  });

  it('turns on with no dialog when the switch paused nobody', async () => {
    counts(0, 0);
    const onChanged = vi.fn();
    render(<CanvasStatusToggle templateId="t1" status="draft" onChanged={onChanged} />);

    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('active'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('the library card switch', () => {
  const template = {
    id: 't1',
    name: 'Booking flow',
    status: 'active',
    description: null,
    apply_rule_type: 'manual',
    apply_rule_config: {},
    tagIds: [],
    // Deliberately different from the server count: the dialog must
    // quote the server, not this cached row.
    activeInstances: 9,
    stepCount: 3,
  } as unknown as TemplateListRow;

  function library(setStatus: WorkflowLibrary['setStatus']): WorkflowLibrary {
    return {
      templates: [template],
      tags: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      createTemplate: vi.fn(),
      duplicateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      setStatus,
      setTags: vi.fn(),
      createTag: vi.fn(),
      updateTag: vi.fn(),
      deleteTag: vi.fn(),
    };
  }

  it('names the server count before turning off, then pauses on confirm', async () => {
    counts(4, 0);
    const setStatus = vi.fn().mockResolvedValue(undefined);
    render(<WorkflowsTemplates library={library(setStatus)} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Turn off Booking flow' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Pause this workflow for 4 couples?');
    expect(setStatus).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('t1', 'draft', false));
  });

  it('turns off with no dialog when no couple is running it', async () => {
    counts(0, 0);
    const setStatus = vi.fn().mockResolvedValue(undefined);
    render(<WorkflowsTemplates library={library(setStatus)} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Turn off Booking flow' }));

    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('t1', 'draft', false));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('counts once when the switch is flipped twice in quick succession', async () => {
    // The card switch has no busy state of its own, so the hook's
    // in-flight guard is what stops a second dialog.
    let release: (v: unknown) => void = () => {};
    countMock.mockReturnValue(new Promise((r) => (release = r)));
    render(<WorkflowsTemplates library={library(vi.fn())} />);

    const toggle = screen.getByRole('switch', { name: 'Turn off Booking flow' });
    await userEvent.click(toggle);
    await userEvent.click(toggle);
    expect(countMock).toHaveBeenCalledTimes(1);

    release({ ok: true, data: { running: 2, pausedByToggle: 0, live: 2 } });
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
  });

  it('names the couples a delete will stop, counted on the server', async () => {
    counts(1, 0, 3);
    const deleteTemplate = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkflowsTemplates
        library={{ ...library(vi.fn()), deleteTemplate } as WorkflowLibrary}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Delete this workflow and stop it for 3 couples?');
    expect(deleteTemplate).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteTemplate).toHaveBeenCalledWith('t1'));
  });

});
