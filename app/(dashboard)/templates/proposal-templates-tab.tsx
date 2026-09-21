'use client'

/**
 * The Proposals tab of the /templates hub: the same proposal templates grid
 * Proposals -> Templates shows, with "New template" portaled into the hub's
 * tab-row action slot. Added because the sidebar's "Templates" led to a
 * page with no proposal templates on it while a second "Templates" tab
 * lived under Proposals (audit pass 2, sidenav naming clash).
 *
 * @module app/(dashboard)/templates/proposal-templates-tab
 */
import { Plus } from 'lucide-react'

import { TemplatesGrid } from '@/app/(dashboard)/proposals/templates/templates-grid'
import { Button } from '@/components/ui/button'

import { TemplatesActions } from './templates-actions-slot'

/** Proposal templates inside the hub. */
export function ProposalTemplatesTab() {
  return (
    <TemplatesGrid
      header={(openNew) => (
        <TemplatesActions>
          <Button onClick={openNew}>
            <Plus size={16} strokeWidth={1.5} className="mr-1.5" aria-hidden="true" />
            New template
          </Button>
        </TemplatesActions>
      )}
    />
  )
}
