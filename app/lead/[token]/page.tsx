/**
 * Public lead-capture page - orchestrator.
 *
 * Reached via the capture-token URL (`/lead/<token>`). Loads the
 * `get_lead_form(token)` RPC payload, applies the MC's branding, and renders
 * the form, an unavailable card, or a loading state. `?embed=1` strips the
 * page chrome for iframe use and reports the content height to the host so
 * `lead-embed.js` can auto-resize.
 *
 * Client component (like the other public surfaces): the immediate-render then
 * RPC-fetch UX would change shape as a server component.
 *
 * @module app/lead/[token]/page
 */
'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  bodyFontFamily,
  DENSITY_PAD,
  useBrandingHead,
} from '@/lib/branding/public-surface';
import { createClient } from '@/lib/supabase/client';

import { LeadForm } from './_components/lead-form';
import { LeadFormUnavailable } from './_components/lead-form-unavailable';
import type { PageState, PublicLeadForm } from './_components/public-lead-form';

export default function PublicLeadPage() {
  const params = useParams<{ token: string }>();
  const embed = useSearchParams().get('embed') === '1';
  const supabase = createClient();

  const [form, setForm] = useState<PublicLeadForm | null>(null);
  const [state, setState] = useState<PageState>('loading');

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.rpc('get_lead_form', {
        token: params.token,
      });
      if (error || !data) {
        // Single-string warn (not console.error, which trips the dev overlay).
        console.warn(
          `[public-lead] unavailable token=${params.token ?? '(none)'} err=${error?.message ?? 'none'}`,
        );
        setState('unavailable');
        return;
      }
      setForm(data as unknown as PublicLeadForm);
      setState('ready');
    };
    void load();
  }, [params.token, supabase]);
  useBrandingHead(form);

  // Report height to a host page when embedded, so lead-embed.js can resize.
  useEffect(() => {
    if (!embed) return;
    const report = () =>
      window.parent?.postMessage(
        { type: 'zebri-lead-height', height: document.documentElement.scrollHeight },
        '*',
      );
    report();
    const ro = new ResizeObserver(report);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [embed, state]);

  const pageBg = form?.surface_color || '#fafafa';
  const textColor = form?.text_color || '#111827';
  const bodyStack = form ? bodyFontFamily(form) : undefined;
  const pad = DENSITY_PAD[form?.density ?? 'cozy'];

  return (
    <div
      className={embed ? 'px-4 py-6' : `min-h-screen ${pad.page} px-4`}
      style={{
        background: embed ? 'transparent' : pageBg,
        color: textColor,
        fontFamily: bodyStack,
      }}
    >
      <div className="max-w-lg mx-auto">
        {state === 'loading' && (
          <p className="text-sm text-text-muted py-10 text-center">Loading...</p>
        )}
        {state === 'unavailable' && <LeadFormUnavailable />}
        {state === 'ready' && form && (
          <>
            {!embed && (
              <h1 className="text-2xl font-semibold mb-6">
                {form.business_name || 'Enquire'}
              </h1>
            )}
            <LeadForm token={params.token} businessName={form.business_name || 'us'} />
          </>
        )}
      </div>
    </div>
  );
}
