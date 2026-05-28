/**
 * Type-only sidecar for the change-password server action.
 *
 * Next.js restricts `'use server'` files to async-function exports
 * only, so the `ChangePasswordResult` interface lives here.
 *
 * @module app/(dashboard)/settings/account/action-state
 */
import type { AuthActionState } from '@/app/(auth)/action-state';

export interface ChangePasswordResult extends AuthActionState {
  ok?: true;
  message?: string;
}
