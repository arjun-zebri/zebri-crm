/**
 * Both Turn on switches show what is unfinished instead of turning on
 * (Task 34, audit M7).
 *
 * The server refuses an unfinished workflow whatever the client does
 * (tests/integration/workflows/preflight-gate.test.ts). These cases pin
 * the part the MC sees: the canvas button and the library card read the
 * pre-flight at click time, list every problem, and never call the switch;
 * a finished workflow turns on as before, and turning off is never gated.
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
const preflightMock = vi.fn();

vi.mock('@/app/(dashboard)/workflows/actions', () => ({
  countTemplateEnrolmentsAction: (...args: unknown[]) => countMock(...args),
  setTemplateStatusAction: (...args: unknown[]) => setStatusMock(...args),
  templatePreflightAction: (...args: unknown[]) => preflightMock(...args),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/(dashboard)/workflows/describe-workflow', () => ({ DescribeWorkflow: () => null }));

const PROBLEMS = [
  { stepId: 's1', kind: 'config', title: 'Send email', message: 'Subject is required.' },
  { stepId: 's2', kind: 'config', title: 'Branch', message: 'No condition chosen.' },
];

function problems(list: typeof PROBLEMS) {
  preflightMock.mockResolvedValue({ ok: true, data: { problems: list } });
}

beforeEach(() => {
  countMock.mockReset();
  setStatusMock.mockReset();
  preflightMock.mockReset();
  countMock.mockResolvedValue({ ok: true, data: { running: 0, pausedByToggle: 0, live: 0 } });
  setStatusMock.mockResolvedValue({ ok: true, data: { paused: 0, resumed: 0, stillPaused: 0 } });
});

describe('the canvas Turn on button', () => {
  it('lists every unfinished step and does not turn on', async () => {
    problems(PROBLEMS);
    const onChanged = vi.fn();
    render(<CanvasStatusToggle templateId="t1" status="draft" onChanged={onChanged} />);

    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));

    const dialog = await screen.findByRole('dialog', { name: 'Finish these steps first' });
    expect(preflightMock).toHaveBeenCalledWith({ templateId: 't1' });
    expect(within(dialog).getByText('Send email')).toBeInTheDocument();
    expect(within(dialog).getByText('Subject is required.')).toBeInTheDocument();
    expect(within(dialog).getByText('Branch')).toBeInTheDocument();
    expect(within(dialog).getByText('No condition chosen.')).toBeInTheDocument();
    // The MC turns it on; it never switches itself on once finished.
    expect(dialog).toHaveTextContent('Finish these, then turn it on.');
    expect(dialog).not.toHaveTextContent('It turns on once');

    await userEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setStatusMock).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('turns a finished workflow on', async () => {
    problems([]);
    const onChanged = vi.fn();
    render(<CanvasStatusToggle templateId="t1" status="draft" onChanged={onChanged} />);

    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('active'));
    expect(setStatusMock).toHaveBeenCalledWith({ templateId: 't1', status: 'active', resumePaused: false });
  });

  it('says so, and stays usable, when the check itself throws', async () => {
    preflightMock.mockRejectedValue(new Error('network down'));
    render(
      <ToastProvider>
        <CanvasStatusToggle templateId="t1" status="draft" onChanged={vi.fn()} />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));

    expect(await screen.findByText('Could not check this workflow. Try again.')).toBeInTheDocument();
    expect(setStatusMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Turn on' })).not.toBeDisabled();
  });

  it('never checks before turning off: an unfinished workflow must be stoppable', async () => {
    problems(PROBLEMS);
    const onChanged = vi.fn();
    render(<CanvasStatusToggle templateId="t1" status="active" onChanged={onChanged} />);

    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('draft'));
    expect(preflightMock).not.toHaveBeenCalled();
  });
});

describe('the library card switch', () => {
  const template = {
    id: 't1',
    name: 'Booking flow',
    status: 'draft',
    description: null,
    apply_rule_type: 'manual',
    apply_rule_config: {},
    tagIds: [],
    activeInstances: 0,
    stepCount: 2,
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

  it('lists the unfinished steps and does not turn on', async () => {
    problems(PROBLEMS.slice(0, 1));
    const setStatus = vi.fn().mockResolvedValue(undefined);
    render(<WorkflowsTemplates library={library(setStatus)} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Turn on Booking flow' }));

    const dialog = await screen.findByRole('dialog', { name: 'Finish this step first' });
    expect(within(dialog).getByText('Subject is required.')).toBeInTheDocument();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it('turns a finished workflow on', async () => {
    problems([]);
    const setStatus = vi.fn().mockResolvedValue(undefined);
    render(<WorkflowsTemplates library={library(setStatus)} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Turn on Booking flow' }));

    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('t1', 'active', false));
  });
});

describe('the pre-flight dialog copy (Task 34 re-review Minor 6)', () => {
  it('says "this" for one unfinished step', async () => {
    problems([PROBLEMS[0]!]);
    render(<CanvasStatusToggle templateId="t1" status="draft" onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    const dialog = await screen.findByRole('dialog', { name: 'Finish this step first' });
    expect(dialog).toHaveTextContent('Finish this, then turn it on.');
  });
});
