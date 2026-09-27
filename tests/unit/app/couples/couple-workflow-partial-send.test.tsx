/**
 * A send that reached only some recipients, on the couple's Workflow tab
 * (Task 31 fix round 1, review I1). The step is done, so it sits in the
 * collapsed Done strip; the strip header has to say so without the MC
 * opening it. It is NOT moved into "Needs you now": Try again would
 * re-send to the recipients who got it.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';


vi.mock('@/app/(dashboard)/workflows/instance-actions', () => ({
  pauseInstanceAction: vi.fn(),
  resumeInstanceAction: vi.fn(),
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

describe('a partly failed send in the Done strip', () => {
  it('shows a warning count on the closed strip, without expanding it', () => {
    renderWork([
      instance('i1', 'Booking flow', {
        steps: [
          step('s1', 'i1', {
            type: 'action',
            status: 'done',
            title: 'Send welcome email',
            output: { recipients: 2, sent: 1, failed: 1, last_error: 'mailbox full' },
          }),
          step('s2', 'i1', { status: 'done', title: 'Call the venue' }),
        ],
      }),
    ]);
    const strip = screen.getByRole('button', { name: /Done \(2\)/ });
    expect(strip).toHaveAttribute('aria-expanded', 'false');
    expect(strip).toHaveTextContent('1 partly failed');
    expect(screen.queryByText('Needs you now')).toBeNull();
  });

  it('says nothing extra when every done send reached everyone', () => {
    renderWork([
      instance('i1', 'Booking flow', {
        steps: [step('s1', 'i1', { type: 'action', status: 'done', output: { sent: 2, failed: 0 } })],
      }),
    ]);
    expect(screen.getByRole('button', { name: /Done \(1\)/ })).not.toHaveTextContent('failed');
  });
});
