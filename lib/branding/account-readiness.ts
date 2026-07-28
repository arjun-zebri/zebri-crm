/**
 * Account-wide readiness signals for gating public surfaces: Stripe Connect status,
 * bank details, and contract template availability.
 *
 * Used by the branding editor and public invoice/contract pages to determine
 * whether an MC is ready to send payment/e-sign documents.
 *
 * @module lib/branding/account-readiness
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { stripeConnectEnabled } from '@/lib/auth/entitlements'
import type { EntitlementSource } from '@/lib/auth/entitlements'
import type { AccountReadiness } from '@/lib/branding/readiness'
import type { Database } from '@/types/database'

/**
 * Evaluate the MC's account readiness: Stripe Connect status, bank details completion,
 * and whether a contract template exists.
 *
 * @param supabase - RLS-scoped Supabase client (enforces user_id = auth.uid()).
 * @param user - Supabase auth user (or auth user shape). Entitlements read from app_metadata.
 * @returns Promise resolving to { stripeConnected, bankDetailsFilled, contractTemplateExists }.
 */
export async function getAccountReadiness(
  supabase: SupabaseClient<Database>,
  user: EntitlementSource | null | undefined,
): Promise<AccountReadiness> {
  // Stripe Connect status: read via entitlements helper, never directly from metadata.
  const stripeConnected = stripeConnectEnabled(user)

  // Bank details filled: ALL THREE fields must be present and non-empty.
  // Display fields in user_metadata are acceptable to read (non-trust per the brief).
  // Any single missing field fails the readiness check.
  const bankAccountName = user?.user_metadata?.bank_account_name
  const bankBsb = user?.user_metadata?.bank_bsb
  const bankAccountNumber = user?.user_metadata?.bank_account_number
  const bankDetailsFilled =
    Boolean(bankAccountName) && Boolean(bankBsb) && Boolean(bankAccountNumber)

  // Contract template exists: count > 0 in contract_templates (RLS filters to owned rows).
  const { count } = await supabase
    .from('contract_templates')
    .select('*', { count: 'exact', head: true })

  const contractTemplateExists = Boolean(count && count > 0)

  return {
    stripeConnected,
    bankDetailsFilled,
    contractTemplateExists,
  }
}
