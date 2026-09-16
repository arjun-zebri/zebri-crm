/**
 * Pure pricing maths for a proposal option. Dollars in, dollars out,
 * rounded to cents. Shared by the builder totals, the list column, the
 * public chooser (Phase C), and invoice generation (Phase C), so the
 * couple, the MC, and the invoice always agree.
 *
 * Uses `roundCents` and `PackagePricingMode` from `lib/payments/package-math`
 * so the two primitives cannot drift.
 *
 * @module lib/proposals/pricing
 */
import { roundCents, type PackagePricingMode } from '@/lib/payments/package-math';

/** The subset of an item the maths needs. */
export interface PricedItem {
  id: string;
  amount: number;
  quantity: number;
  isAddon: boolean;
}

/** The subset of an option the maths needs. */
export interface PricedOption {
  pricingMode: PackagePricingMode;
  fixedPrice: number | null;
  weekendLoadingPercent: number | null;
  items: PricedItem[];
}

/** Sum of the non add-on lines (amount x quantity). */
export function optionBaseSubtotal(items: PricedItem[]): number {
  return roundCents(items.filter((i) => !i.isAddon).reduce((sum, i) => sum + i.amount * i.quantity, 0));
}

/** Weekend loading applied to the base only, never to add-ons. */
export function weekendLoadingAmount(base: number, percent: number | null): number {
  if (!percent) return 0;
  return roundCents(base * (percent / 100));
}

/**
 * Total for an option with the given add-ons ticked.
 * A `single` option prices as its fixed price; its items are inclusions.
 */
export function optionTotal(option: PricedOption, selectedAddonIds: readonly string[]): number {
  const base = option.pricingMode === 'single' ? (option.fixedPrice ?? 0) : optionBaseSubtotal(option.items);
  const addons = option.items
    .filter((i) => i.isAddon && selectedAddonIds.includes(i.id))
    .reduce((sum, i) => sum + i.amount * i.quantity, 0);
  return roundCents(base + weekendLoadingAmount(base, option.weekendLoadingPercent) + addons);
}

/** Deposit owed on a total. Null percent means no deposit terms yet. */
export function depositAmount(total: number, depositPercent: number | null): number {
  if (!depositPercent) return 0;
  return roundCents(total * (depositPercent / 100));
}
