'use client'

import { useEffect, useRef } from 'react'

import type { OnboardingWizardProps } from './onboarding-wizard'
import { OnboardingWizard } from './onboarding-wizard'

/**
 * Props for the onboarding modal wrapper.
 * @internal
 */
interface OnboardingModalProps extends OnboardingWizardProps {
  /** Whether the modal is open. When false, returns nothing. */
  isOpen: boolean
  /** Callback to return focus after modal closes. */
  onRestoreFocus?: () => void
}

/**
 * OnboardingModal — Modal wrapper for branding onboarding wizard.
 *
 * Renders a centered max-w-lg card with backdrop blur, smooth fade/scale entry,
 * and crossfade step transitions. Closes only via Skip or Finish; no Escape or
 * outside-click close.
 *
 * Focus is trapped inside the modal while open and restored on close.
 * Respects prefers-reduced-motion for accessibility.
 *
 * @internal
 */
export function OnboardingModal({
  isOpen,
  onRestoreFocus,
  ...wizardProps
}: OnboardingModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const initialFocusRef = useRef<HTMLDivElement>(null)

  // Focus management: trap focus inside modal while open.
  useEffect(() => {
    if (!isOpen) return

    const modal = modalRef.current
    if (!modal) return

    // Move focus into modal card on open (into the first heading or interactive element).
    initialFocusRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      // No Escape close for onboarding wizard.
      if (e.key === 'Escape') {
        e.preventDefault()
        return
      }

      // Tab trap: keep focus inside modal.
      if (e.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusableElements.length === 0) return

        const first = focusableElements[0] as HTMLElement
        const last = focusableElements[focusableElements.length - 1] as HTMLElement
        const active = document.activeElement as HTMLElement

        if (e.shiftKey) {
          // Shift+Tab on first element: wrap to last
          if (active === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          // Tab on last element: wrap to first
          if (active === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus after modal closes.
      onRestoreFocus?.()
    }
  }, [isOpen, onRestoreFocus])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay backdrop: fixed full screen, non-dismissible backdrop. */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-fade-in"
        aria-hidden="true"
      />

      {/* Modal container: centers the card. */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Modal card: centered, max-w-lg, with smooth entry transition. */}
        <div
          ref={initialFocusRef}
          tabIndex={-1}
          className="w-full max-w-lg bg-surface rounded-xl shadow-lg animate-modal-in onboarding-modal-card"
          style={{ maxHeight: '85vh', overflowY: 'auto' }}
        >
          <OnboardingWizard {...wizardProps} />
        </div>
      </div>

      <style>{`
        /* Override wizard's full-page layout when inside modal. */
        .onboarding-modal-card > div:first-child {
          min-height: auto;
          background: transparent;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .onboarding-modal-card > div:first-child > div:first-child {
          min-height: auto;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in,
          .animate-modal-in {
            animation: none !important;
          }
        }
      `}</style>
    </>
  )
}
