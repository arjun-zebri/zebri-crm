/**
 * Role chooser shown the first time an MC opens the proposal surface: pick
 * MC, Celebrant, or both. The choice applies the starter block design for
 * that role and (via `chooseProposalRoleAction`) seeds two sample packages.
 *
 * @module app/(dashboard)/branding/proposal-role-chooser
 */
'use client'

import { useState } from 'react'

import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { PROPOSAL_ROLES, PROPOSAL_ROLE_LABELS, type ProposalRole } from '@/lib/proposals/types'

import { chooseProposalRoleAction } from './proposal-role-actions'

/** Props for {@link ProposalRoleChooser}. */
interface ProposalRoleChooserProps {
  /** Whether the modal is shown. False once a role has already been chosen. */
  open: boolean
  /** Called with the chosen role after the action succeeds. */
  onChosen: (role: ProposalRole) => void
}

/**
 * ProposalRoleChooser: the forced first choice for the proposal surface.
 *
 * No dismiss without choosing: `onClose` is a no-op, matching the onboarding
 * wizard's "no Escape or outside-click close" pattern, because a role is
 * required before there is anything meaningful to design.
 */
export function ProposalRoleChooser({ open, onChosen }: ProposalRoleChooserProps) {
  const { toast } = useToast()
  const [pending, setPending] = useState<ProposalRole | null>(null)

  const choose = async (role: ProposalRole) => {
    setPending(role)
    try {
      const result = await chooseProposalRoleAction(role)
      if (!result.ok) {
        toast(result.error, 'error')
        return
      }
      const suffix = result.data.packagesAdded > 0 ? `, ${result.data.packagesAdded} packages added` : ''
      toast(`Starter design applied${suffix}`, 'success')
      onChosen(role)
    } finally {
      setPending(null)
    }
  }

  return (
    <Modal isOpen={open} onClose={() => {}} dismissible={false} title="What do you offer?">
      <div className="flex flex-col gap-4">
        <p className="text-body text-text-muted">
          Pick one to start from. You can change every block afterwards.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PROPOSAL_ROLES.map((role) => {
            const info = PROPOSAL_ROLE_LABELS[role]
            const descriptionId = `proposal-role-${role}-description`
            return (
              <button
                key={role}
                type="button"
                aria-label={info.label}
                aria-describedby={descriptionId}
                aria-busy={pending === role}
                disabled={pending !== null}
                onClick={() => choose(role)}
                className="flex flex-col gap-1 rounded-control border border-border bg-card p-4 text-left cursor-pointer transition hover:border-border-strong disabled:cursor-default disabled:opacity-60"
              >
                <span className="text-body font-medium text-text">{info.label}</span>
                <span id={descriptionId} className="text-body text-text-muted">
                  {pending === role ? 'Applying…' : info.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
