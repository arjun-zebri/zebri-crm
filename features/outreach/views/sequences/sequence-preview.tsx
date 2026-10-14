'use client';

/**
 * Live preview of one variant, filled with the sample celebrant.
 *
 * @module features/outreach/views/sequences/sequence-preview
 */
import { PREVIEW_NOTE } from './merge-fields';
import type { Channel } from './sequence-draft';
import { previewVariant } from './variant-preview';

interface SequencePreviewProps {
  channel: Channel;
  subject: string;
  body: string;
  /** Names the message being previewed, e.g. "Step 2, variant B". */
  caption: string;
}

/** Shows the message as the recipient would read it. */
export function SequencePreview({ channel, subject, body, caption }: SequencePreviewProps) {
  const preview = previewVariant(channel, subject, body);
  return (
    <section aria-label="Preview" className="space-y-3 rounded-control bg-surface-muted p-4">
      <p className="text-body text-text-muted">{caption}</p>
      {/* Drawn as the message itself, so it reads like what lands in the inbox. */}
      <div className="rounded-control border border-border bg-card shadow-sm">
        {channel === 'email' && (
          <p className="border-b border-border px-5 py-3 text-body text-text">
            <span className="text-text-muted">Subject: </span>
            <span className="font-medium">{preview.subject || 'No subject'}</span>
          </p>
        )}
        <p className="whitespace-pre-wrap px-5 py-4 text-body text-text">
          {preview.body.trim() || 'Start typing to see the message.'}
        </p>
      </div>
      {preview.missing.length > 0 && (
        <p className="text-body text-warning">
          Some fields have no value: {preview.missing.join(', ')}. Add a fallback like {'{{first_name|there}}'}.
        </p>
      )}
      <p className="text-body text-text-subtle">{PREVIEW_NOTE}</p>
    </section>
  );
}
