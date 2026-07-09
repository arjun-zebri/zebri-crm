/**
 * Conversion stats for one package: how many quotes were started from
 * it and how many of those were accepted.
 *
 * Reads `quotes.source_package_id` (provenance set when a builder
 * applies the package: items are still snapshotted, never linked
 * live). RLS scopes the count to the signed-in MC. Consumers render
 * nothing on error or zero so a package with no history stays calm.
 *
 * @module app/(dashboard)/templates/use-package-usage
 */
'use client'

import { useQuery } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'

export interface PackageUsage {
  /** Quotes created with this package applied. */
  total: number
  /** Of those, quotes the couple accepted. */
  accepted: number
}

export function usePackageUsage(packageId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['package-usage', packageId],
    enabled: !!packageId,
    queryFn: async (): Promise<PackageUsage> => {
      const { data, error } = await supabase
        .from('quotes')
        .select('status')
        .eq('source_package_id', packageId!)
      if (error) throw error
      const rows = data ?? []
      return {
        total: rows.length,
        accepted: rows.filter((q) => q.status === 'accepted').length,
      }
    },
  })
}
