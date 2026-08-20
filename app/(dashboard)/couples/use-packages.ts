/**
 * The MC's packages, shaped for the couple-facing choosers.
 *
 * Shared by the Overview Package row and the Add/Edit Couple modal so both
 * show the same list and the same prices.
 *
 * @module app/(dashboard)/couples/use-packages
 */
import { useQuery } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'

/**
 * Package row with calculated total (sum of required items).
 */
export interface PackageOption {
  id: string
  name: string
  description: string | null
  gst_inclusive: boolean
  total_amount: number
}

/**
 * Fetch the MC's non-archived packages with calculated totals.
 *
 * Used by CouplePackageSelector (Overview inline editor) and
 * CoupleModal (add/edit couple flow) to populate the package chooser.
 * Totals are calculated by summing required items (optional=false)
 * amount*quantity per package.
 *
 * @param userId The owner's user_id
 * @param enabled Whether to run the query (default true)
 * @returns useQuery result with packages list
 */
export function usePackages(userId: string, enabled: boolean = true) {
  const supabase = createClient()

  return useQuery<PackageOption[]>({
    queryKey: ['packages', userId],
    queryFn: async () => {
      // Items come back embedded rather than per-package: one round trip
      // instead of one query per package. RLS scopes the embedded rows.
      const { data, error } = await supabase
        .from('packages')
        .select('id, name, description, gst_inclusive, package_items(amount, quantity, optional)')
        .eq('user_id', userId)
        .is('archived_at', null)
        .order('position', { ascending: true })

      if (error) throw error

      // Headline price counts required items only, so optional add-ons never
      // inflate what the couple is quoted. `amount` is the per-unit price.
      return (data ?? []).map(({ package_items: items, ...pkg }) => ({
        ...pkg,
        total_amount: (items ?? [])
          .filter((item) => !item.optional)
          .reduce((sum, item) => sum + item.amount * item.quantity, 0),
      }))
    },
    enabled,
  })
}

/**
 * Format a numeric price as AUD.
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount)
}
