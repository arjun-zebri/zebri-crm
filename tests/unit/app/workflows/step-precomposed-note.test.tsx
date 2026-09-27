/**
 * A held pre-composed email in the step detail (Phase 5 fix wave, I3).
 *
 * Its wording is composed inside the send and not previewed yet, so the
 * MC reads what it is, who it goes to, and plainly that there is no
 * preview, instead of the action's bare label.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StepPrecomposedNote } from '@/app/(dashboard)/workflows/step-precomposed-note';
import type { SendEnvelope } from '@/lib/workflows/send-envelope';

const envelope: SendEnvelope = {
  from: 'Zebri <noreply@app.zebri.com.au>',
  fromName: 'Zebri',
  fromAddress: 'noreply@app.zebri.com.au',
  via: 'zebri',
  to: [{ name: 'Sarah', email: 'sarah@example.com', copy: false, skipped: null }],
  mcCopy: null,
  replyTo: null,
  sendAt: { kind: 'now' },
  attachments: [],
  unresolved: [],
  unresolvedHolds: false,
  settled: false,
  notice: 'Preview not available for this email type yet.',
};

describe('StepPrecomposedNote', () => {
  it('says what it sends, to whom, and that the preview is not available yet', () => {
    render(<StepPrecomposedNote sends="A link to their client portal" envelope={envelope} />);
    expect(screen.getByText('A link to their client portal')).toBeInTheDocument();
    expect(screen.getByText(/sarah@example\.com/)).toBeInTheDocument();
    expect(screen.getByText('Preview not available for this email type yet.')).toBeInTheDocument();
  });

  it('still says there is no preview when the envelope could not be read', () => {
    render(<StepPrecomposedNote sends="A link to the run sheet" envelope={null} />);
    expect(screen.getByText('A link to the run sheet')).toBeInTheDocument();
    expect(screen.getByText('Preview not available for this email type yet.')).toBeInTheDocument();
  });
});
