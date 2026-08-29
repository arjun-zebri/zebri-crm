'use client';

import { Camera, Paperclip, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { captureViewport } from '@/lib/feedback/capture-screenshot';

/**
 * Screenshot row of the feedback form.
 *
 * Two ways in: capture the page behind the form, or attach an image the MC
 * already has. Either way the result is one optional `File` the parent owns,
 * shown back as a thumbnail so nobody sends a screenshot of something they
 * did not mean to.
 *
 * @module components/feedback/feedback-attachment
 */

/** Matches the cap enforced by the API route and by Notion. */
const MAX_BYTES = 5 * 1024 * 1024;

export interface FeedbackAttachmentProps {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

/** Renders the screenshot controls. See {@link FeedbackAttachmentProps}. */
export function FeedbackAttachment({ file, onChange, disabled }: FeedbackAttachmentProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    // Object URLs pin the blob in memory until revoked, and this component
    // can swap files several times before the form is sent.
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function accept(picked: File | undefined) {
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      toast('That image is over 5MB. Try a smaller one.', 'error');
      return;
    }
    onChange(picked);
  }

  async function capture() {
    setCapturing(true);
    try {
      // The form stays on screen: it is a `Modal chrome`, which the capture
      // filters out, so there is nothing to hide and restore.
      onChange(await captureViewport());
    } catch {
      toast('Could not capture the page. Try attaching an image instead.', 'error');
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Matches the label the Input and Textarea primitives render, so the
          row reads as one more field rather than a pair of loose buttons. */}
      <span className="block text-body font-medium text-text">Screenshot (optional)</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            accept(e.target.files?.[0]);
            if (inputRef.current) inputRef.current.value = '';
          }}
        />

        <Button variant="outline" onClick={capture} loading={capturing} disabled={disabled}>
          <Camera size={14} strokeWidth={1.5} className="mr-1.5" />
          Take screenshot
        </Button>

        <Button variant="ghost" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <Paperclip size={14} strokeWidth={1.5} className="mr-1.5" />
          Attach an image
        </Button>

        {file && (
          <span className="flex items-center gap-2">
            {preview && (
              // Opens full size on click. A capture pulls whatever couple names
              // and amounts were on screen into a Notion ticket, so the MC gets
              // a way to check what they are actually sending; at 32px the
              // thumbnail alone settles nothing.
              <a
                href={preview}
                target="_blank"
                rel="noreferrer"
                title="Open the screenshot full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, never fetched over the network and never the LCP element */}
                <img
                  src={preview}
                  alt="Screenshot preview"
                  className="h-8 w-12 rounded-control border border-border object-cover object-left-top"
                />
              </a>
            )}
            <span className="max-w-40 truncate text-body text-text-muted">{file.name}</span>
            <Button
              variant="ghost"
              iconOnly
              aria-label="Remove screenshot"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              <X size={14} strokeWidth={1.5} />
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}
