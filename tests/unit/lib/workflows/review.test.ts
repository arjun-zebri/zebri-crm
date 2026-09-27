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
    attempt_count: 0,
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

/** A rich body with a link variable, bold and a list, as the composer stores it. */
const RICH = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Your portal: ' },
        { type: 'mention', attrs: { id: 'portal.link', label: null } },
        { type: 'text', marks: [{ type: 'bold' }], text: ' see you soon' },
      ],
    },
    {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] }],
    },
  ],
};

/**
 * Per-field edits (Phase 5 live check B2). Before, every edit rewrote the
 * body from the rendered text, one plain paragraph per line: formatting,
 * list structure, the signature and the variables were all lost.
 */
describe('applyReviewEdits', () => {
  it('writes a subject-only edit and leaves the stored body exactly as it was', () => {
    const out = applyReviewEdits(
      { actionType: 'send_email', subject: 'Old', content: RICH, recipients: { roles: ['primary'] } },
      { subject: 'New' },
      null,
    ) as Record<string, unknown>;
    expect(out['subject']).toBe('New');
    expect(out['content']).toEqual(RICH);
    expect(out['actionType']).toBe('send_email');
    expect(out['recipients']).toEqual({ roles: ['primary'] });
  });

  it('writes a body edit as the editor doc, variables and marks intact', () => {
    const out = applyReviewEdits(
      { actionType: 'send_email', subject: 'Keep me', content: { type: 'doc', content: [] } },
      { content: RICH },
      null,
    ) as Record<string, unknown>;
    expect(out['subject']).toBe('Keep me');
    // The link variable is still a variable, not its URL flattened to text.
    expect(out['content']).toEqual(RICH);
  });

  it('changes nothing with no edits', () => {
    const config = { actionType: 'send_email', subject: 'S', content: RICH };
    expect(applyReviewEdits(config, {}, null)).toBe(config);
  });

  it('detaches a template step, copying its words under the edit', () => {
    // The send prefers a template over the step's words, so leaving
    // templateId would ignore the edit; the template's body is copied so a
    // subject edit still sends it.
    const out = applyReviewEdits(
      { actionType: 'send_email', templateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      { subject: 'New' },
      { subject: 'Template subject', content: RICH },
    ) as Record<string, unknown>;
    expect(out['templateId']).toBeUndefined();
    expect(out['subject']).toBe('New');
    expect(out['content']).toEqual(RICH);
  });

  it('keeps a legacy plain-text body on a subject-only edit', () => {
    const out = applyReviewEdits(
      { actionType: 'send_email', subject: 'Old', body: 'the old plain text' },
      { subject: 'New' },
      null,
    ) as Record<string, unknown>;
    expect(out['body']).toBe('the old plain text');
    expect(out['content']).toBeUndefined();
  });

  it('drops a stale legacy body once the body is edited, so the send cannot pick it', () => {
    const out = applyReviewEdits(
      { actionType: 'send_email', body: 'the old plain text' },
      { content: RICH },
      null,
    ) as Record<string, unknown>;
    expect(out['body']).toBeUndefined();
    expect(out['content']).toEqual(RICH);
  });
});
