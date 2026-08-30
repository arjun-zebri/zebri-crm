'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';

import { FeedbackAttachment } from './feedback-attachment';

/**
 * The Feedback form.
 *
 * Three fields and an optional screenshot. Everything else a ticket needs
 * (page, browser, viewport, build, account) is captured by the API route, so
 * the MC never has to describe their own environment.
 *
 * @module components/feedback/feedback-modal
 */

const TYPE_OPTIONS = [
  { value: 'Bug', label: 'Something is broken' },
  { value: 'Feature', label: 'An idea for something new' },
  { value: 'Improvement', label: 'Something could be better' },
];

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Renders the form. See {@link FeedbackModalProps}. */
export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reportType, setReportType] = useState('Bug');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  // Any non-empty description will do. A minimum only ever blocked someone
  // whose whole report was "it crashed", which is still worth having.
  const canSend = title.trim().length >= 3 && description.trim().length >= 1;

  function reset() {
    setTitle('');
    setDescription('');
    setReportType('Bug');
    setFile(null);
  }

  async function send() {
    setSending(true);
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('reportType', reportType);
      form.append('pageUrl', window.location.href);
      form.append('routePath', window.location.pathname);
      form.append('viewportWidth', String(window.innerWidth));
      form.append('viewportHeight', String(window.innerHeight));
      if (file) form.append('screenshot', file);

      const res = await fetch('/api/bug-reports/submit', { method: 'POST', body: form });
      if (!res.ok) {
        toast(
          res.status === 429
            ? "You've sent a few already. Try again a little later."
            : 'Could not send that. Please try again.',
          'error',
        );
        return;
      }
      // A missing ticketRef means the row saved but Notion refused it. The
      // report is safe either way, so the MC gets a thank-you regardless.
      const { ticketRef } = (await res.json()) as { ticketRef: string | null };
      toast(ticketRef ? `Thanks, logged as ${ticketRef}` : "Thanks, we've got it");
      reset();
      onClose();
    } catch {
      toast('Could not send that. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send feedback"
      size="md"
      // The one modal that is app chrome rather than page content: it is left
      // out of its own screenshot, and pressing inside it does not dismiss the
      // dropdowns and panels the MC is trying to report on.
      chrome
      // `nested`, not the default `base`: the pill stays clickable over an
      // open modal, so the form it opens has to clear that modal (panel
      // `z-[80]` beats `z-[60]`) rather than rendering behind it.
      //
      // Not `top`. That tier sits at `z-[130]`, above the popover tier the
      // Select dropdown uses (`z-[90]`), so the kind-of-feedback menu opened
      // behind the modal and looked like a dead control.
      layer="nested"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={send} loading={sending} disabled={!canSend}>
            Send
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-text-muted">
          Tell us what happened and we will pick it up. The page you are on and your browser
          details come through automatically.
        </p>

        <Select
          label="What kind of feedback is this?"
          value={reportType}
          onValueChange={setReportType}
          options={TYPE_OPTIONS}
        />

        <Input
          label="Summary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Contract emails are not sending"
          maxLength={120}
        />

        <Textarea
          label="What happened?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What you were doing, what you expected, and what happened instead."
          rows={9}
          // Fixed height on purpose: this is the field people actually write
          // in, so it starts tall enough not to need dragging, and a drag
          // handle in a modal only pushes the footer around.
          resizable={false}
          maxLength={5000}
        />

        <FeedbackAttachment file={file} onChange={setFile} disabled={sending} />
      </div>
    </Modal>
  );
}
