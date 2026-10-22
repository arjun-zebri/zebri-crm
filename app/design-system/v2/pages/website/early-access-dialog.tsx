'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChipGroup } from '@/components/ui-v2/chip-group';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { UserIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { useDemoSubmit } from '../use-demo-submit';

import { WaitlistDone } from './waitlist-done';

/**
 * The second step of the waitlist sign-up: the email is in, so it asks
 * the two things the founder needs to let someone in, name and what they
 * do, then ends on their place in line and the link that moves them up
 * (`WaitlistDone`). A plan picked on a pricing card rides along hidden.
 *
 * Opens on Your name (`data-autofocus`), not on Close: landing on Close
 * after pressing Enter in the email field showed its tooltip, and the
 * visitor's next keystroke belongs in the name (2026-10-19 review). A
 * demo: nothing is sent.
 *
 * @module app/design-system/v2/pages/website/early-access-dialog
 */

export const TRADES = ['MC', 'Celebrant', 'Both'] as const;

export interface EarlyAccessDialogProps {
  /** The email given on the page; null keeps the dialog shut. */
  email: string | null;
  /** The plan picked on a pricing card ("Max"), if any. */
  plan?: string | null | undefined;
  onClose: () => void;
}

/** The dialog. See {@link EarlyAccessDialogProps}. */
export function EarlyAccessDialog({ email, plan = null, onClose }: EarlyAccessDialogProps) {
  const [trade, setTrade] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const { errors, loading, onSubmit } = useDemoSubmit(
    (v) => ({
      name: v.name ? undefined : 'Enter your name.',
      trade: v.trade ? undefined : 'Pick what you do.',
    }),
    () => setSent(true),
  );
  const close = () => {
    onClose();
    setSent(false);
    setTrade([]);
  };
  return (
    <Dialog open={email !== null} onClose={close} size="sm" aria-labelledby="early-access-title">
      <DialogHeader id="early-access-title" title={sent ? 'You’re on the list' : 'Join the waitlist'} />
      {sent && email ? (
        <DialogBody>
          <WaitlistDone email={email} />
        </DialogBody>
      ) : (
        <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-5">
            <p className="type-body text-zebra-500">
              Two more things and you&rsquo;re on the list. We&rsquo;ll write to {email}.
              {plan ? <> You picked {plan}.</> : null}
            </p>
            <Input boxed data-autofocus icon={UserIcon} label="Your name" placeholder="Jess Taylor" name="name" autoComplete="name" error={errors.name} />
            <input type="hidden" name="trade" value={trade.join(',')} />
            {plan ? <input type="hidden" name="plan" value={plan} /> : null}
            <div data-field="trade" className="space-y-1">
              <ChipGroup label="What do you do?" options={TRADES} value={trade} onChange={setTrade} />
              {errors.trade ? (
                <p role="alert" className="type-body text-danger">
                  {errors.trade}
                </p>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="submit" loading={loading}>
              Join the waitlist
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
