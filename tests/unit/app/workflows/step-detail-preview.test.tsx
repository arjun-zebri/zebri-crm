/**
 * The step detail modal's email preview and edits (Task 28, Phase 5 live
 * check B1 and B2).
 *
 * A held send shows the email the couple receives, rendered on the
 * server by the send's own chain, under an editor holding the message as
 * written. Pinned here:
 * - an untouched message is approved WITHOUT edits;
 * - edits are per field: a subject edit sends only the subject, so the
 *   stored rich body is never rewritten (B2), and a body edit sends the
 *   editor's own TipTap doc as plain JSON;
 * - "edited" is measured against the editor's own form of the message,
 *   so an edit then undo is clean;
 * - the frame never goes blank while an edited render is on its way, and
 *   is never captioned "exactly" unless it shows the current render (B1).
 *
 * The rich editor is replaced by a textarea stand-in: jsdom cannot type
 * into ProseMirror. Like the real editor it reports its opening document
 * through `onReady` with a default attribute filled in, which the stored
 * doc lacks, so a raw comparison against the stored doc would read an
 * undo as an edit.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StepDetailModal } from '@/app/(dashboard)/workflows/step-detail-modal';

/** Stored docs: paragraphs of text, no attrs. */
function stored(text: string) {
  return { type: 'doc', content: text.split('\n').map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })) };
}

/** The editor's form of the same text: every paragraph carries its default attrs. */
function editorForm(text: string) {
  return {
    type: 'doc',
    content: text.split('\n').map((line) => ({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{ type: 'text', text: line }],
    })),
  };
}

function docText(doc: { content?: { content?: { text?: string }[] }[] }): string {
  return (doc.content ?? []).map((p) => (p.content ?? []).map((t) => t.text ?? '').join('')).join('\n');
}

vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: ({
    value,
    onChange,
    onReady,
  }: {
    value: { content?: { content?: { text?: string }[] }[] };
    onChange: (doc: unknown) => void;
    onReady?: (doc: unknown) => void;
  }) => {
    useEffect(() => {
      onReady?.(editorForm(docText(value)));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <textarea
        aria-label="Message"
        defaultValue={docText(value)}
        onChange={(e) => onChange(editorForm(e.currentTarget.value))}
      />
    );
  },
}));

const SAVED_HTML =
  '<!DOCTYPE html>\n<html><head></head><body><p><strong>Saved</strong> body</p></body></html>';
const EDITED_HTML = '<html><body><p>Edited</p></body></html>';

const detail = {
  stepId: 'step-1',
  title: 'Send an email',
  description: null,
  type: 'action',
  actionType: 'send_email',
  config: { actionType: 'send_email' },
  status: 'pending',
  errorMessage: null,
  sendWarning: null,
  dueAt: null,
  requiresApproval: true,
  instanceName: 'Booking flow',
  coupleId: 'couple-1',
  coupleName: 'Sam & Priya',
  weddingDate: null,
  stepIndex: 1,
  stepTotal: 3,
  preview: {
    kind: 'email',
    summary: 'Send an email',
    subject: 'Hello Sam',
    source: { subject: 'Hello {{couple.primary_name}}', content: stored('Saved body'), legacyText: false },
    html: SAVED_HTML,
  },
};

type Done = { ok: true; data: null };
const approveMock = vi.fn<(input: unknown) => Promise<Done>>(async () => ({ ok: true, data: null }));
const saveMock = vi.fn<(input: unknown) => Promise<Done>>(async () => ({ ok: true, data: null }));
const editedRender = () => ({ ok: true, data: { ...detail.preview, subject: 'Edited', html: EDITED_HTML } });
const previewMock = vi.fn<(input: unknown) => Promise<unknown>>(async () => editedRender());

/** What the server returns for the step now; a test changes it, then refetches. */
let served: typeof detail = detail;

vi.mock('@/app/(dashboard)/workflows/instance-actions', () => ({
  loadStepDetailAction: async () => ({ ok: true, data: served }),
  previewStepAction: (input: unknown) => previewMock(input),
  approveStepAction: (input: unknown) => approveMock(input),
  saveStepMessageAction: (input: unknown) => saveMock(input),
  updateStepConfigAction: vi.fn(async () => ({ ok: true, data: null })),
  renameStepAction: vi.fn(async () => ({ ok: true, data: null })),
  rescheduleStepAction: vi.fn(async () => ({ ok: true, data: null })),
  retryStepAction: vi.fn(async () => ({ ok: true, data: null })),
  tickStepAction: vi.fn(async () => ({ ok: true, data: null })),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/app/(dashboard)/workflows/account-pause-actions', () => ({
  getAccountPauseAction: async () => ({ ok: true, data: { paused: false, pausedAt: null } }),
  pauseAccountWorkflowsAction: async () => ({ ok: true, data: null }),
  resumeAccountWorkflowsAction: async () => ({ ok: true, data: null }),
}));

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderModal() {
  const onClose = vi.fn();
  render(<StepDetailModal stepId="step-1" onClose={onClose} onSettled={vi.fn()} />, { wrapper });
  return { onClose };
}

/** The saved step's words moved on in another tab, and the query refetches. */
async function refetchWithNewBody() {
  served = {
    ...detail,
    preview: {
      ...detail.preview,
      source: { ...detail.preview.source, content: stored('Saved body, reworded') },
      html: SAVED_HTML.replace('body', 'body, reworded'),
    },
  };
  await act(async () => {
    await client.refetchQueries({ queryKey: ['step-detail', 'step-1'] });
  });
}

/** Send & complete, and return what approve was called with. */
async function approve() {
  fireEvent.click(screen.getByRole('button', { name: /Send & complete/ }));
  await waitFor(() => expect(approveMock).toHaveBeenCalled());
  return approveMock.mock.calls[0]![0];
}

describe('StepDetailModal email preview', () => {
  beforeEach(() => {
    served = detail;
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    previewMock.mockImplementation(async () => editedRender());
    approveMock.mockClear();
    saveMock.mockClear();
    previewMock.mockClear();
  });

  it('shows the message as written and the rendered email under it', async () => {
    renderModal();
    expect(await screen.findByTitle('Email preview')).toBeInTheDocument();
    // The subject field holds the subject as written, variable and all.
    expect(screen.getByLabelText('Subject')).toHaveValue('Hello {{couple.primary_name}}');
    expect(screen.getByLabelText('Message')).toHaveValue('Saved body');
    expect(screen.getByText('Hello Sam', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(/Exactly what Sam & Priya receives/)).toBeInTheDocument();
    expect(previewMock).not.toHaveBeenCalled();
  });

  it('approves an untouched message without edits', async () => {
    renderModal();
    await screen.findByLabelText('Message');
    expect(await approve()).toEqual({ stepId: 'step-1' });
  });

  it('does not rewrite an untouched message on Save', async () => {
    const { onClose } = renderModal();
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saveMock).not.toHaveBeenCalled();
  });

  // B2: a subject edit never touches the body.
  it('sends a subject-only edit as the subject alone', async () => {
    renderModal();
    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'Hello {{couple.primary_name}}!' } });

    await waitFor(() => expect(previewMock).toHaveBeenCalled(), { timeout: 2000 });
    expect(previewMock.mock.calls.at(-1)![0]).toEqual({
      stepId: 'step-1',
      edits: { subject: 'Hello {{couple.primary_name}}!' },
    });
    expect(await approve()).toEqual({ stepId: 'step-1', edits: { subject: 'Hello {{couple.primary_name}}!' } });
  });

  it('sends a body edit as the editor doc alone, in plain JSON', async () => {
    renderModal();
    const message = await screen.findByLabelText('Message');
    fireEvent.change(message, { target: { value: 'Edited body' } });

    await waitFor(() => expect(previewMock).toHaveBeenCalled(), { timeout: 2000 });
    const call = previewMock.mock.calls.at(-1)![0] as { edits: { content: unknown; subject?: string } };
    expect(call.edits).toEqual({ content: editorForm('Edited body') });
    expect(await screen.findByText(/With your edits/)).toBeInTheDocument();
    expect(await approve()).toEqual({ stepId: 'step-1', edits: { content: editorForm('Edited body') } });
  });

  it('keeps an edit on Save, per field', async () => {
    const { onClose } = renderModal();
    const message = await screen.findByLabelText('Message');
    fireEvent.change(message, { target: { value: 'Kept for later' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saveMock.mock.calls[0]![0]).toEqual({ stepId: 'step-1', edits: { content: editorForm('Kept for later') } });
  });

  it('counts a body edit then undo as untouched', async () => {
    renderModal();
    const message = await screen.findByLabelText('Message');
    fireEvent.change(message, { target: { value: 'Something else' } });
    fireEvent.change(message, { target: { value: 'Saved body' } });
    expect(await approve()).toEqual({ stepId: 'step-1' });
  });

  it('follows a refetch while untouched, and still sends no edits', async () => {
    renderModal();
    await screen.findByLabelText('Message');
    await refetchWithNewBody();
    await waitFor(() => expect(screen.getByLabelText('Message')).toHaveValue('Saved body, reworded'));
    expect(screen.queryByText(/With your edits/)).toBeNull();
    expect(await approve()).toEqual({ stepId: 'step-1' });
  });

  it('keeps an edit across a refetch', async () => {
    renderModal();
    const message = await screen.findByLabelText('Message');
    fireEvent.change(message, { target: { value: 'Mine now' } });
    await refetchWithNewBody();
    expect(screen.getByLabelText('Message')).toHaveValue('Mine now');
    expect(await approve()).toEqual({ stepId: 'step-1', edits: { content: editorForm('Mine now') } });
  });

  // B1: the frame stays up, dimmed, while the first edited render is on
  // its way, and is not captioned "exactly" until it lands.
  it('keeps the email in the frame while the first edited render is pending', async () => {
    let release: (() => void) | null = null;
    previewMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(editedRender());
        }),
    );
    renderModal();
    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'New subject' } });

    expect(await screen.findByText(/Updating the preview/)).toBeInTheDocument();
    expect(screen.queryByText(/Exactly what/)).toBeNull();
    // Still the saved render, dimmed: never an empty frame.
    expect(screen.getByTitle('Email preview')).toBeInTheDocument();
    expect(screen.getByText('Hello Sam', { selector: 'p' })).toBeInTheDocument();

    await waitFor(() => expect(release).not.toBeNull(), { timeout: 2000 });
    act(() => release!());
    expect(await screen.findByText(/With your edits\. Exactly what Sam & Priya receives/)).toBeInTheDocument();
    expect(screen.getByTitle('Email preview')).toBeInTheDocument();
  });

  it('never captions an empty render "exactly"', async () => {
    previewMock.mockImplementation(async () => ({ ok: true, data: { ...detail.preview, html: '' } }));
    renderModal();
    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'New subject' } });
    await waitFor(() => expect(previewMock).toHaveBeenCalled(), { timeout: 2000 });
    await act(async () => {});
    expect(screen.queryByText(/Exactly what/)).toBeNull();
  });

  it('offers Try again over a dimmed edited render when a later refresh fails', async () => {
    previewMock.mockResolvedValueOnce(editedRender());
    renderModal();
    const message = await screen.findByLabelText('Message');
    fireEvent.change(message, { target: { value: 'Edited body' } });
    expect(await screen.findByText(/With your edits/, undefined, { timeout: 2000 })).toBeInTheDocument();

    previewMock.mockResolvedValueOnce({ ok: false, error: 'Too many previews. Try again in a minute.' });
    fireEvent.change(message, { target: { value: 'Edited body, again' } });
    const retry = await screen.findByRole('button', { name: 'Try again' }, { timeout: 2000 });
    expect(screen.getByTitle('Email preview')).toBeInTheDocument();

    previewMock.mockResolvedValueOnce({ ok: true, data: { ...detail.preview, html: '<html><body><p>Again</p></body></html>' } });
    fireEvent.click(retry);
    expect(await screen.findByText(/With your edits/, undefined, { timeout: 2000 })).toBeInTheDocument();
  });

  it("never shows an earlier edit's render after the edits were reverted", async () => {
    renderModal();
    const message = await screen.findByLabelText('Message');
    fireEvent.change(message, { target: { value: 'First edit' } });
    expect(await screen.findByText('Edited', { selector: 'p' }, { timeout: 2000 })).toBeInTheDocument();

    fireEvent.change(message, { target: { value: 'Saved body' } });
    expect(await screen.findByText('Hello Sam', { selector: 'p' })).toBeInTheDocument();

    previewMock.mockImplementation(() => new Promise(() => {}));
    fireEvent.change(message, { target: { value: 'Second edit' } });
    expect(screen.queryByText('Edited', { selector: 'p' })).toBeNull();
    expect(screen.getByText(/Updating the preview/)).toBeInTheDocument();
    expect(screen.queryByText(/Exactly what/)).toBeNull();
  });
});
