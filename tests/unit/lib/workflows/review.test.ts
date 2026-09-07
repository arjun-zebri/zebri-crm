import { describe, expect, it } from 'vitest';

import { applyReviewEdits, needsReview } from '@/lib/workflows/review';
import { DEFAULT_STEP_TIMING, type WorkflowStepRow } from '@/types/workflows';

const NOW = new Date('2026-09-10T09:00:00Z');

function step(over: Partial<WorkflowStepRow> = {}): WorkflowStepRow {
  return {
    id: 's1',
    instance_id: 'i1',
    template_step_id: null,
    position: 0,
    type: 'action',
    config: { actionType: 'send_email' },
    title: 'Welcome email',
    description: null,
    timing: DEFAULT_STEP_TIMING,
    due_at: '2026-09-10T08:00:00Z',
    parent_step_id: null,
    branch_path: null,
    status: 'pending',
    requires_approval: true,
    visible_to_couple: false,
    approval_token: null,
    approval_expires_at: null,
    completed_at: null,
    error_message: null,
    output: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...over,
  };
}

describe('needsReview', () => {
  it('holds a due automated send that is flagged', () => {
    expect(needsReview(step(), NOW)).toBe(true);
  });

  it('does not surface a send that is not due yet', () => {
    // Showing it early would put the MC in front of a decision they
    // cannot usefully make, days before the message matters.
    expect(needsReview(step({ due_at: '2026-09-20T00:00:00Z' }), NOW)).toBe(false);
  });

  it('ignores a step nobody asked to review', () => {
    expect(needsReview(step({ requires_approval: false }), NOW)).toBe(false);
  });

  it('ignores manual steps, which the MC is already doing themselves', () => {
    expect(needsReview(step({ type: 'todo' }), NOW)).toBe(false);
  });

  it('ignores a step that has already run or been dealt with', () => {
    for (const status of ['done', 'skipped', 'errored', 'running', 'waiting'] as const) {
      expect(needsReview(step({ status }), NOW), status).toBe(false);
    }
  });

  it('ignores a gated step with no due date', () => {
    expect(needsReview(step({ due_at: null }), NOW)).toBe(false);
  });
});

describe('applyReviewEdits', () => {
  it('writes the edit onto the step as a rich body', () => {
    const out = applyReviewEdits(
      { actionType: 'send_email', subject: 'Old', recipients: { roles: ['primary'] } },
      { subject: 'New', body: 'Line one\n\nLine two' },
    ) as Record<string, unknown>;

    expect(out['subject']).toBe('New');
    expect(out['actionType']).toBe('send_email');
    expect(out['recipients']).toEqual({ roles: ['primary'] });
    // `content` is the field the send path renders. Writing to `body`
    // (the legacy plain string) would fail the action's own schema.
    expect(out['content']).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Line one' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Line two' }] },
      ],
    });
  });

  it('detaches the step from its saved template', () => {
    // The MC is fixing this one message for this one couple, not
    // rewriting the wording for everybody. Leaving templateId behind
    // would make the send ignore what they just typed.
    const out = applyReviewEdits(
      { actionType: 'send_email', templateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      { subject: 'New', body: 'Hi' },
    ) as Record<string, unknown>;
    expect(out['templateId']).toBeUndefined();
  });

  it('drops a stale legacy body so the send cannot pick it', () => {
    const out = applyReviewEdits(
      { actionType: 'send_email', body: 'the old plain text' },
      { subject: 'New', body: 'the new text' },
    ) as Record<string, unknown>;
    expect(out['body']).toBeUndefined();
  });
});
