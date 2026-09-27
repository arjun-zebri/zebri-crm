/**
 * Pause, Resume and the stopped strip on the couple's Workflow tab
 * (Phase 3, Task 22).
 *
 * The server has supported pause and resume since Task 16, but nothing
 * on screen offered them, so a workflow the MC stopped could only be
 * started again from scratch. These pin what the tab now offers:
 * - Pause on a running workflow, beside Stop;
 * - Resume on a paused one, only after a confirm that says overdue
 *   steps are skipped, not sent;
 * - a collapsed strip of stopped workflows, each with Resume, or the
 *   reason it cannot be resumed and no button.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pauseMock = vi.fn();
const resumeMock = vi.fn();

vi.mock('@/app/(dashboard)/workflows/instance-actions', () => ({
  pauseInstanceAction: (...args: unknown[]) => pauseMock(...args),
  resumeInstanceAction: (...args: unknown[]) => resumeMock(...args),
}));

import { CoupleWorkflowWork } from '@/app/(dashboard)/couples/couple-workflow-work';
import type { CoupleWorkflows } from '@/app/(dashboard)/couples/use-couple-workflows';
import { ToastProvider } from '@/components/ui/toast';
import type {
  WorkflowInstanceWithSteps,
  WorkflowStepRow,
} from '@/types/workflows';

const FUTURE = '2099-01-01T00:00:00Z';

function step(id: string, instanceId: string, over: Partial<WorkflowStepRow> = {}): WorkflowStepRow {
  return {
    id,
    instance_id: instanceId,
    template_step_id: null,
    position: 0,
    type: 'todo',
    config: {},
    title: `Step ${id}`,
    description: null,
    timing: { mode: 'after_previous', delayAmount: 0, unit: 'days' },
    due_at: FUTURE,
    parent_step_id: null,
    branch_path: null,
    status: 'pending',
    requires_approval: false,
    visible_to_couple: false,
    approval_token: null,
    approval_expires_at: null,
    completed_at: null,
    error_message: null,
    output: null,
    attempt_count: 0,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...over,
  };
}

function instance(
  id: string,
  name: string,
  over: Partial<WorkflowInstanceWithSteps> = {},
): WorkflowInstanceWithSteps {
  return {
    id,
    user_id: 'user-1',
    couple_id: 'couple-1',
    template_id: `tpl-${id}`,
    name,
    template_version: 1,
    status: 'active',
    paused_reason: null,
    cancelled_reason: null,
    dedupe_key: null,
    template_status: 'active',
    is_default: false,
    is_personal: false,
    trigger_event_id: null,
    context: {},
    applied_at: '2026-09-01T00:00:00Z',
    completed_at: null,
    error_message: null,
    needs_recompute_at: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    steps: [step(`${id}-s`, id)],
    ...over,
  };
}

function workflows(): CoupleWorkflows {
  return {
    instances: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    tick: vi.fn(),
    untick: vi.fn(),
    skip: vi.fn(),
    retry: vi.fn(),
    removeStep: vi.fn(),
    addStep: vi.fn(),
    applyTemplate: vi.fn(),
    cancelInstance: vi.fn(),
    cancelAll: vi.fn(),
    reschedule: vi.fn(),
    rename: vi.fn(),
    isMutating: false,
  };
}

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

function renderWork(instances: WorkflowInstanceWithSteps[]) {
  return render(
    wrap(
      <CoupleWorkflowWork
        coupleId="couple-1"
        instances={instances}
        timezone="Australia/Sydney"
        dueLabel={() => ''}
        onOpen={vi.fn()}
        workflows={workflows()}
      />,
    ),
  );
}

/** Open the row menu on the row showing `title`. */
async function openRowMenu(title: string) {
  const row = screen.getByText(title).closest('[role="button"]') as HTMLElement;
  await userEvent.click(within(row).getByRole('button', { name: 'Row actions' }));
}

beforeEach(() => {
  pauseMock.mockReset();
  resumeMock.mockReset();
  pauseMock.mockResolvedValue({ ok: true, data: null });
  resumeMock.mockResolvedValue({ ok: true, data: null });
});

describe('a running workflow', () => {
  it('offers Pause beside Stop, and pauses that workflow', async () => {
    renderWork([instance('i1', 'Booking flow')]);
    await openRowMenu('Step i1-s');

    expect(screen.getByRole('button', { name: 'Stop this workflow' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pause this workflow' }));

    await waitFor(() => expect(pauseMock).toHaveBeenCalledWith({ instanceId: 'i1' }));
  });

  it('says so when the pause is refused', async () => {
    pauseMock.mockResolvedValue({ ok: false, error: 'Only a running workflow you started can be paused.' });
    renderWork([instance('i1', 'Booking flow')]);
    await openRowMenu('Step i1-s');
    await userEvent.click(screen.getByRole('button', { name: 'Pause this workflow' }));

    expect(await screen.findByText('Only a running workflow you started can be paused.')).toBeInTheDocument();
  });
});

describe('a paused workflow', () => {
  it('resumes only after a confirm that says overdue steps are skipped, not sent', async () => {
    renderWork([instance('i1', 'Booking flow', { status: 'paused', paused_reason: 'manual' })]);
    await openRowMenu('Step i1-s');
    expect(screen.queryByRole('button', { name: 'Pause this workflow' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Resume this workflow' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Resume Booking flow?');
    expect(dialog).toHaveAccessibleDescription(/fell due while it was paused will be skipped, not sent/);
    expect(resumeMock).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(resumeMock).toHaveBeenCalledWith({ instanceId: 'i1' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows the server\'s refusal in its own words', async () => {
    resumeMock.mockResolvedValue({ ok: false, error: 'That workflow changed while resuming.' });
    renderWork([instance('i1', 'Booking flow', { status: 'paused', paused_reason: 'manual' })]);
    await openRowMenu('Step i1-s');
    await userEvent.click(screen.getByRole('button', { name: 'Resume this workflow' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Resume' }));

    expect(await screen.findByText('That workflow changed while resuming.')).toBeInTheDocument();
  });
});

describe('the stopped strip', () => {
  const stopped = [
    instance('i2', 'Enquiry flow', {
      status: 'cancelled',
      cancelled_reason: 'manual',
      completed_at: '2026-09-20T02:00:00Z',
      steps: [step('i2-s', 'i2', { status: 'cancelled' })],
    }),
    instance('i3', 'Wedding week', {
      status: 'cancelled',
      cancelled_reason: 'setup_interrupted',
      completed_at: '2026-09-21T02:00:00Z',
      steps: [],
    }),
  ];

  it('is collapsed, lists each stopped workflow when opened, and never shows its steps as work', async () => {
    renderWork([instance('i1', 'Booking flow'), ...stopped]);

    const toggle = screen.getByRole('button', { name: 'Stopped (2)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Enquiry flow')).toBeNull();
    // The stopped workflow's cancelled step is not in the working list.
    expect(screen.queryByText('Step i2-s')).toBeNull();

    await userEvent.click(toggle);
    expect(screen.getByText('Enquiry flow')).toBeInTheDocument();
    expect(screen.getByText('Wedding week')).toBeInTheDocument();
  });

  it('resumes a workflow the MC stopped, after the confirm', async () => {
    renderWork(stopped);
    await userEvent.click(screen.getByRole('button', { name: 'Stopped (2)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Resume Enquiry flow' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleDescription(/fell due while it was stopped will be skipped, not sent/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(resumeMock).toHaveBeenCalledWith({ instanceId: 'i2' }));
  });

  it('shows why a refused one cannot be resumed, with no Resume button', async () => {
    renderWork(stopped);
    await userEvent.click(screen.getByRole('button', { name: 'Stopped (2)' }));

    expect(
      screen.getByText('Its setup did not finish, so some steps may be missing. Start it again instead.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume Wedding week' })).toBeNull();
  });

  it('is not there when nothing was stopped', () => {
    renderWork([instance('i1', 'Booking flow')]);
    expect(screen.queryByRole('button', { name: /Stopped/ })).toBeNull();
  });
});

describe('fix round 1', () => {
  it('tells the MC to turn the workflow on first, with no Resume, while it is off', async () => {
    renderWork([
      instance('i1', 'Booking flow', {
        status: 'paused',
        paused_reason: 'template_off',
        template_status: 'draft',
      }),
      instance('i2', 'Enquiry flow', {
        status: 'cancelled',
        cancelled_reason: 'manual',
        template_status: 'draft',
        steps: [],
      }),
    ]);
    await openRowMenu('Step i1-s');
    expect(screen.queryByRole('button', { name: 'Resume this workflow' })).toBeNull();
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', { name: 'Stopped (1)' }));
    expect(screen.getByText(/Turn this workflow on first/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume Enquiry flow' })).toBeNull();
  });

  it('says "Running again" instead of Resume when the same workflow was started again', async () => {
    renderWork([
      instance('i1', 'Enquiry flow', { dedupe_key: 'tpl-x' }),
      instance('i2', 'Enquiry flow', {
        status: 'cancelled',
        cancelled_reason: 'manual',
        dedupe_key: 'tpl-x',
        steps: [],
      }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Stopped (1)' }));
    expect(screen.getByText('Running again')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume Enquiry flow' })).toBeNull();
  });

  it('tells the MC a stopped workflow is re-dated and its waits start again', async () => {
    renderWork([
      instance('i2', 'Enquiry flow', { status: 'cancelled', cancelled_reason: 'manual', steps: [] }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Stopped (1)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Resume Enquiry flow' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleDescription(/re-dated from today/);
    expect(dialog).toHaveAccessibleDescription(/wait starts again/);
  });

  it('pauses once, however often Pause is chosen while the first is in flight', async () => {
    let release: (v: unknown) => void = () => {};
    pauseMock.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    renderWork([instance('i1', 'Booking flow')]);

    await openRowMenu('Step i1-s');
    await userEvent.click(screen.getByRole('button', { name: 'Pause this workflow' }));
    await openRowMenu('Step i1-s');
    await userEvent.click(screen.getByRole('button', { name: 'Pause this workflow' }));

    expect(pauseMock).toHaveBeenCalledTimes(1);
    release({ ok: true, data: null });
  });
});
