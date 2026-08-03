/**
 * "Lead Capture" settings section. Surfaces the MC's embeddable enquiry form:
 * an enable toggle, the landing-status selector, and three copy-paste blocks
 * (hosted link, iframe embed, JS snippet). The form row is created lazily on
 * first open via {@link ensureLeadForm}; changes autosave.
 *
 * @module app/(dashboard)/settings/lead-capture-section
 */
'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  buildHostedUrl,
  buildIframeSnippet,
  buildScriptSnippet,
} from '@/lib/lead-capture/snippets';
import { createClient } from '@/lib/supabase/client';

import { ensureLeadForm, saveLeadCaptureSettings } from './lead-capture/actions';
import { LeadCaptureSkeleton } from './lead-capture-skeleton';

/** Sentinel for "let leads land in the first pipeline status". */
const DEFAULT_STATUS = '__default__';

interface StatusOption {
  slug: string;
  name: string;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
        enabled ? 'bg-black' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      {/* The label is rendered here rather than passed to `Input` so the
          monospace treatment applies to the snippet only, not the label. */}
      <p className="mb-1 text-caption font-medium text-text">{label}</p>
      <div className="flex items-center gap-2">
        <Input
          aria-label={label}
          readOnly
          value={value}
          size="sm"
          className="min-w-0 flex-1 font-mono"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="shrink-0 cursor-pointer"
        >
          {copied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>
    </div>
  );
}

export function LeadCaptureSection() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [targetSlug, setTargetSlug] = useState<string>(DEFAULT_STATUS);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    const load = async () => {
      setOrigin(window.location.origin);
      const [form, statusRows] = await Promise.all([
        ensureLeadForm(),
        supabase.from('couple_statuses').select('slug, name').order('position'),
      ]);
      setToken(form.token);
      setEnabled(form.enabled);
      setTargetSlug(form.targetStatusSlug ?? DEFAULT_STATUS);
      setStatuses(statusRows.data ?? []);
      setLoading(false);
    };
    void load();
  }, [supabase]);

  const persist = (next: { enabled: boolean; targetSlug: string }) => {
    void saveLeadCaptureSettings({
      enabled: next.enabled,
      targetStatusSlug: next.targetSlug === DEFAULT_STATUS ? null : next.targetSlug,
    });
  };

  const options = [
    { value: DEFAULT_STATUS, label: 'Top of pipeline (default)' },
    ...statuses.map((s) => ({ value: s.slug, label: s.name })),
  ];

  // The heading is static copy, so it stays mounted through the fetch and
  // only the data-bound body below it swaps for the skeleton.
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Lead capture</h2>
        <p className="mt-1 text-sm text-gray-500">
          Embed an enquiry form on your website. Submissions arrive as new couples.
        </p>
      </div>

      {loading || !token ? (
        <LeadCaptureSkeleton />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Form enabled</p>
              <p className="text-xs text-gray-400">Turn off to stop accepting new enquiries.</p>
            </div>
            <Toggle
              enabled={enabled}
              onChange={(v) => {
                setEnabled(v);
                persist({ enabled: v, targetSlug });
              }}
            />
          </div>

          {/* Narrower than the snippet fields: status names are short, so a
              full-width trigger leaves a long empty run before the chevron. */}
          <Select
            label="New leads land in"
            value={targetSlug}
            size="sm"
            onValueChange={(v) => {
              setTargetSlug(v);
              persist({ enabled, targetSlug: v });
            }}
            options={options}
            contentClassName="z-[90]"
            className="max-w-xs"
          />

          <div className="space-y-4">
            <CopyField label="Hosted link" value={buildHostedUrl(origin, token)} />
            <CopyField label="Embed (iframe)" value={buildIframeSnippet(origin, token)} />
            <CopyField label="Embed (script)" value={buildScriptSnippet(origin, token)} />
          </div>
        </>
      )}
    </div>
  );
}
