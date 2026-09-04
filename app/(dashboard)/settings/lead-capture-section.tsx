/**
 * "Lead Capture" settings section. Surfaces the MC's embeddable enquiry form:
 * an enable toggle, the landing-status selector, and three copy-paste blocks
 * (hosted link, iframe embed, JS snippet). The form row is created lazily on
 * first open via {@link ensureLeadForm}; changes autosave.
 *
 * @module app/(dashboard)/settings/lead-capture-section
 */
'use client';

import { useEffect, useState } from 'react';

import { Select } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import {
  buildHostedUrl,
  buildIframeSnippet,
  buildScriptSnippet,
} from '@/lib/lead-capture/snippets';
import { createClient } from '@/lib/supabase/client';

import { ensureLeadForm, saveAllowedOrigins, saveLeadCaptureSettings } from './lead-capture/actions';
import { ApiAccessSection } from './lead-capture/api-access-section';
import { CopyField } from './lead-capture/copy-field';
import { LeadCaptureSkeleton } from './lead-capture-skeleton';

/** Sentinel for "let leads land in the first pipeline status". */
const DEFAULT_STATUS = '__default__';

interface StatusOption {
  slug: string;
  name: string;
}

export function LeadCaptureSection() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [targetSlug, setTargetSlug] = useState<string>(DEFAULT_STATUS);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [origin, setOrigin] = useState('');
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>([]);

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
      setAllowedOrigins(form.allowedOrigins);
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

  const changeAllowedOrigins = async (next: string[]) => {
    const res = await saveAllowedOrigins(next);
    if (!res.ok) return res.error;
    setAllowedOrigins(res.origins);
    return null;
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
        <h2 className="text-section font-semibold text-text">Lead capture</h2>
        <p className="mt-1 text-body text-text-muted">
          Embed an enquiry form on your website. Submissions arrive as new couples.
        </p>
      </div>

      {loading || !token ? (
        <LeadCaptureSkeleton />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-body font-medium text-gray-700">Form enabled</p>
              <p className="text-body text-text-subtle">Turn off to stop accepting new enquiries.</p>
            </div>
            <Toggle
              checked={enabled}
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
            onValueChange={(v) => {
              setTargetSlug(v);
              persist({ enabled, targetSlug: v });
            }}
            options={options}
            contentClassName="z-[90]"
            className="max-w-xs"
          />

          {/* Three ways to publish the same form. They looked like three
              things to do rather than a choice, so the heading says pick one
              and each row explains who it is for on hover. */}
          <div className="space-y-4">
            <div>
              <h3 className="text-body font-semibold text-text">Share your form</h3>
              <p className="mt-1 text-body text-text-muted">
                Pick whichever suits your site. They all lead to the same form.
              </p>
            </div>
            <CopyField
              label="Hosted link"
              value={buildHostedUrl(origin, token)}
              tooltip={
                'A ready-made page on Zebri.\nSend it to couples, or link to it from your site. Nothing to install.'
              }
            />
            <CopyField
              label="Embed (iframe)"
              value={buildIframeSnippet(origin, token)}
              tooltip={
                'Paste into your own page to show the form inside it.\nUse this if your site builder accepts HTML.'
              }
            />
            <CopyField
              label="Embed (script)"
              value={buildScriptSnippet(origin, token)}
              tooltip={
                'Same form as the iframe, but it resizes itself to fit your page.\nUse this if you can add a script tag.'
              }
            />
          </div>

          <ApiAccessSection
            origin={origin}
            token={token}
            allowedOrigins={allowedOrigins}
            onAllowedOriginsChange={changeAllowedOrigins}
          />
        </>
      )}
    </div>
  );
}
