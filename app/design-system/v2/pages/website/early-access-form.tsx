'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CheckIcon, EmailIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { isEmail, useDemoSubmit } from '../use-demo-submit';

import { EarlyAccessDialog } from './early-access-dialog';
import { useWaitlistPlan } from './waitlist-plan';

/**
 * The waitlist sign-up, as Stripe and Notion close a page (founder,
 * 2026-10-19): one email field and its button, at the app's own control
 * size (a `raised` `Input` beside a `Button`, one height, 13px text).
 * The rest, name and what they do, is asked in a small dialog after
 * (`EarlyAccessDialog`), so the page itself asks for one thing. A plan
 * picked on a pricing card shows above the field, so the visitor sees
 * the choice was kept.
 *
 * A demo: nothing is sent.
 *
 * @module app/design-system/v2/pages/website/early-access-form
 */

/** The email capture and its follow-up dialog. */
export function EarlyAccessForm() {
  // What was typed, and the dialog's email once the button's beat is over.
  const [typed, setTyped] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const { plan } = useWaitlistPlan();
  const { errors, loading, onSubmit } = useDemoSubmit(
    (v) => ({ email: isEmail(v.email) ? undefined : 'Enter a valid email address.' }),
    () => setEmail(typed.trim()),
  );
  return (
    <>
      {plan ? (
        <p className="mb-3 flex items-center gap-2 type-body text-zebra-700">
          <CheckIcon aria-hidden="true" className="size-3.5 text-grass-700" />
          Joining with {plan}
        </p>
      ) : null}
      <form
        noValidate
        onSubmit={onSubmit}
        className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-start"
      >
        {/* The app's toolbar pair, a raised field beside its button at one height: the
            48px box with the button inside, typed at 16px, was larger than every other control.
            Phones stack them, the button full width under the field: side by side the field
            was too narrow to type in (founder, 2026-10-19). */}
        <div className="min-w-0 sm:flex-1">
          <Input
            raised
            icon={EmailIcon}
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            error={errors.email}
          />
        </div>
        <Button type="submit" loading={loading}>
          Join the waitlist
        </Button>
      </form>
      <EarlyAccessDialog email={email} plan={plan} onClose={() => setEmail(null)} />
    </>
  );
}
