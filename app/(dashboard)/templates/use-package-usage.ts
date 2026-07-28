/**
 * Conversion stats for one package: how many proposals offered it and
 * how many couples accepted it.
 *
 * Reads `proposal_options.source_package_id` (provenance set when the
 * composer applies the package: items are still snapshotted, never
 * linked live). A package counts as accepted only when the couple
 * chose THAT option — an accepted proposal where they picked a
 * different option is offered-but-not-chosen. RLS scopes the count to
 * the signed-in MC. Consumers render nothing on error or zero so a
 * package with no history stays calm.
 *
 * @module app/(dashboard)/templates/use-package-usage
 */
'use client'

import { useQuery } from '@tanstack/react-query'

import { createClient } from '@/lib/supabase/client'

export interface PackageUsage {
  /** Proposals that offered this package as an option. */
  total: number
  /** Of those, proposals where the couple accepted this option. */
  accepted: number
}

export function usePackageUsage(packageId: string | null) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['package-usage', packageId],
    enabled: !!packageId,
    queryFn: async (): Promise<PackageUsage> => {
      const { data, error } = await supabase
        .from('proposal_options')
        .select('id, proposal_id, proposals!proposal_options_proposal_id_fkey(status, accepted_option_id)')
        .eq('source_package_id', packageId!)
      if (error) throw error
      const rows = data ?? []
      // One proposal can hold the same package twice (rare); count
      // proposals, not option rows, so stats read as "sent N times".
      const proposals = new Set(rows.map((r) => r.proposal_id))
      const acceptedProposals = new Set(
        rows
          .filter((r) => {
            const p = Array.isArray(r.proposals) ? r.proposals[0] : r.proposals
            return p?.status === 'accepted' && p.accepted_option_id === r.id
          })
          .map((r) => r.proposal_id),
      )
      return { total: proposals.size, accepted: acceptedProposals.size }
    },
  })
}
