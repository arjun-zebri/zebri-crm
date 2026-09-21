/**
 * The accepted option's totals for the contract's merge fields, read with
 * the admin client by the anonymous accept route. Split out of the route so
 * it stays under its line budget.
 *
 * @module lib/proposals/accepted-totals
 */
import type { createAdminClient } from '@/lib/supabase/admin';

import { depositAmount, optionTotal } from './pricing';

/**
 * The accepted option's total and deposit, for the contract's merge fields.
 *
 * The deposit follows ruling W1: an explicit `payment_schedule_id` makes the
 * invoice carry that schedule's stages, so `deposit_percent` is ignored and
 * the contract's `deposit_amount` renders empty rather than a figure the
 * invoice will not match.
 */
export async function acceptedTotals(
  admin: ReturnType<typeof createAdminClient>,
  contractId: string,
  optionId: string,
  addonIds: string[],
): Promise<{ packageName: string; total: number; deposit: number } | null> {
  const { data } = await admin
    .from('proposals')
    .select(
      'title, deposit_percent, payment_schedule_id, proposal_options!proposal_options_proposal_id_fkey(id, title, pricing_mode, fixed_price, weekend_loading_percent, proposal_option_items(id, amount, quantity, is_addon))',
    )
    .eq('contract_id', contractId)
    .maybeSingle();
  const option = data?.proposal_options.find((o) => o.id === optionId);
  if (!option) return null;
  const total = optionTotal(
    {
      pricingMode: option.pricing_mode as 'itemised' | 'single',
      fixedPrice: option.fixed_price,
      weekendLoadingPercent: option.weekend_loading_percent,
      items: option.proposal_option_items.map((i) => ({
        id: i.id,
        amount: i.amount,
        quantity: i.quantity,
        isAddon: i.is_addon,
      })),
    },
    addonIds,
  );
  const deposit = data?.payment_schedule_id
    ? 0
    : depositAmount(total, data?.deposit_percent ?? null);
  return { packageName: option.title, total, deposit };
}
