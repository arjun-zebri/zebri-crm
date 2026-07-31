/**
 * Public lead-capture form. Controlled fields, a hidden honeypot + render
 * timestamp for bot defence, and explicit submitting/success/error states.
 * Branding is applied by the page wrapper, so this stays layout-focused.
 *
 * @module app/lead/[token]/_components/lead-form
 */
'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface LeadFormProps {
  token: string;
  businessName: string;
}

type SubmitState = 'ready' | 'submitting' | 'success' | 'error';

const EMPTY = {
  name: '',
  partner_name: '',
  email: '',
  phone: '',
  wedding_date: '',
  venue: '',
  referral_source: '',
  message: '',
};

/** The branded enquiry form rendered on `/lead/[token]`. */
export function LeadForm({ token, businessName }: LeadFormProps) {
  const [state, setState] = useState<SubmitState>('ready');
  // Stamped on mount (client only) so the submit route can measure fill time.
  // Date.now() during render trips the react-hooks purity rule.
  const renderedAt = useRef(0);
  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);
  const [fields, setFields] = useState({ ...EMPTY });
  const [hp, setHp] = useState(''); // honeypot

  const set =
    (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((f) => ({ ...f, [k]: e.target.value }));

  const canSubmit =
    fields.name.trim() !== '' &&
    fields.email.trim() !== '' &&
    state !== 'submitting';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setState('submitting');
    try {
      const res = await fetch('/api/lead/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, ...fields, hp, rendered_at: renderedAt.current }),
      });
      setState(res.ok ? 'success' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold text-text">Thank you</h2>
        <p className="text-sm text-text-muted mt-2">
          Your enquiry has been sent to {businessName}. They will be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {/* Honeypot: hidden from humans, catnip for bots. Uses the primitive
          inside a hidden wrapper so no raw form control is introduced. */}
      <div className="hidden" aria-hidden="true">
        <Input
          label=""
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
      </div>

      <Input label="Your name" required value={fields.name} onChange={set('name')} />
      <Input label="Partner's name" value={fields.partner_name} onChange={set('partner_name')} />
      <Input label="Email" type="email" required value={fields.email} onChange={set('email')} />
      <Input label="Phone" type="tel" value={fields.phone} onChange={set('phone')} />
      <Input label="Wedding date" type="date" value={fields.wedding_date} onChange={set('wedding_date')} />
      <Input label="Venue" value={fields.venue} onChange={set('venue')} />
      <Input label="How did you hear about me?" value={fields.referral_source} onChange={set('referral_source')} />
      <Input label="Message" value={fields.message} onChange={set('message')} />

      {state === 'error' && (
        <p role="alert" className="text-sm text-danger">
          Something went wrong. Please try again.
        </p>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        loading={state === 'submitting'}
        className="w-full"
      >
        Send enquiry
      </Button>
    </form>
  );
}
