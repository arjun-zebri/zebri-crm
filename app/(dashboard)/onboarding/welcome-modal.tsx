'use client'

import { Modal } from '@/components/ui/modal'

import type { WelcomeProfile } from './steps/step-details'
import { WelcomeWizard, type SaveResult } from './welcome-wizard'

/** localStorage hint that stops the modal flashing on a slow hydrate. */
export const WELCOME_CACHE_KEY = 'zebri:welcome-onboarded'

/**
 * Window event that replays the wizard on demand, bypassing the gate.
 *
 * Temporary testing hook (2026-07-23) fired by the sidebar's "Welcome
 * tour" control. Remove both together before production release.
 */
export const WELCOME_REPLAY_EVENT = 'zebri:welcome-replay'

/** Props for {@link WelcomeModal}. */
export interface WelcomeModalProps {
  isOpen: boolean
  initial: WelcomeProfile
  email: string
  onSaveProfile: (profile: WelcomeProfile) => Promise<SaveResult>
  /** Fires on every exit path: Finish, Escape, close control, backdrop. */
  onDismiss: () => void
}

/**
 * The welcome wizard's shell.
 *
 * Unlike the branding wizard this modal is dismissible. These are paying
 * users who signed up on purpose and will mostly finish it anyway, and a
 * hard gate would turn any one broken step into a lockout from a product
 * they just paid for.
 *
 * The fixed height lives on this inner wrapper rather than the Modal,
 * which hard-caps itself at max-h-[85vh]. Without it the frame would jump
 * between a short form step and a tall preview step.
 */
export function WelcomeModal({
  isOpen,
  initial,
  email,
  onSaveProfile,
  onDismiss,
}: WelcomeModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onDismiss} size="xl">
      {/* The cap subtracts the Modal's ~4rem close-button header from its
          85vh panel limit. Without it, short viewports clip the top of the
          wizard (the step title) instead of shrinking the frame. */}
      <div className="h-[560px] sm:h-[680px] max-h-[calc(85vh-4rem)] flex flex-col">
        <WelcomeWizard
          initial={initial}
          email={email}
          onSaveProfile={onSaveProfile}
          onExit={onDismiss}
        />
      </div>
    </Modal>
  )
}
