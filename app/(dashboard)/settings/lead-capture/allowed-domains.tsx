/**
 * Editable list of browser origins allowed to post to the lead API. Each
 * change saves immediately through `onChange`, matching the autosave feel of
 * the toggle and status select above it; `onChange` resolves to an error
 * message or null.
 *
 * @module app/(dashboard)/settings/lead-capture/allowed-domains
 */
'use client';

import { Info, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { parseAllowedOrigin } from '@/lib/lead-capture/cors';

export interface AllowedDomainsProps {
  origins: string[];
  onChange: (next: string[]) => Promise<string | null>;
}

export function AllowedDomains({ origins, onChange }: AllowedDomainsProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    // Both operations share `busy`: overlapping calls would each compute
    // `next` from the same stale `origins` prop and the later save would
    // silently clobber the earlier one, so a second call while one is
    // already in flight is ignored rather than raced.
    if (busy) return;
    const parsed = parseAllowedOrigin(draft);
    if (!parsed.ok) return setError(parsed.error);
    if (origins.includes(parsed.origin)) return setError('That domain is already listed');
    setBusy(true);
    try {
      const err = await onChange([...origins, parsed.origin]);
      if (err) return setError(err);
      setDraft('');
      setError(null);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (origin: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const err = await onChange(origins.filter((o) => o !== origin));
      setError(err ?? null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <p className="text-body font-medium text-text">Allowed domains</p>
        <Tooltip
          label={
            'The sites allowed to post your form from a browser.\n' +
            'Your website from Personal Info is added automatically.\n' +
            'A form that posts from your own server needs nothing here.'
          }
          side="top"
          multiline
        >
          <Info size={12} strokeWidth={1.5} className="text-text-subtle cursor-help" />
        </Tooltip>
      </div>
      {origins.length === 0 ? (
        <p className="mb-2 text-body text-text-subtle">
          None yet, so a form on your own site cannot post from a browser.
        </p>
      ) : (
        <ul className="mb-2 space-y-2">
          {origins.map((origin) => (
            <li key={origin} className="flex items-center gap-2">
              <Input aria-label={origin} readOnly value={origin} className="min-w-0 flex-1 font-mono" />
              <Button
                variant="ghost"
                iconOnly
                aria-label={`Remove ${origin}`}
                disabled={busy}
                onClick={() => void remove(origin)}
              >
                <X size={16} strokeWidth={1.5} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
        className="flex items-start gap-2"
      >
        <Input
          aria-label="Add domain"
          placeholder="https://www.yoursite.com"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          {...(error ? { error } : {})}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="outline" loading={busy} className="shrink-0">
          Add domain
        </Button>
      </form>
    </div>
  );
}
