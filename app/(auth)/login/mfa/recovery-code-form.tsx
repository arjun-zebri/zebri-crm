/**
 * Recovery-code form on the second-factor screen. Posts to
 * {@link redeemRecoveryCodeAction}, which spends the code, switches
 * two-factor sign-in off and sends the MC back to the password screen.
 * The callout says so up front: using a code is not a normal sign-in.
 *
 * @module app/(auth)/login/mfa/recovery-code-form
 */
'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Input } from '@/components/ui/input';

import { emptyAuthState } from '../../action-state';

import { redeemRecoveryCodeAction } from './actions';

/** Recovery-code entry. */
export function RecoveryCodeForm() {
  const [state, formAction, pending] = useActionState(redeemRecoveryCodeAction, emptyAuthState);
  const fieldError = state.fieldErrors?.code;
  const formError = !fieldError ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <Callout tone="warning">
        A recovery code turns two-factor sign-in off. You will sign in again with your password,
        then you can turn it back on in Settings.
      </Callout>
      {formError ? (
        <Callout tone="danger">
          <span role="alert">{formError}</span>
        </Callout>
      ) : null}
      <Input
        label="Recovery code"
        name="code"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        placeholder="xxxxx-xxxxx"
        {...(fieldError ? { error: fieldError } : {})}
      />
      <Button type="submit" loading={pending} className="w-full">
        Use recovery code
      </Button>
    </form>
  );
}
