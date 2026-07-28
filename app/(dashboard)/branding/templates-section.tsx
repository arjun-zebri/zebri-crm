'use client'

import { RotateCcw } from 'lucide-react'
import { useState } from 'react'

interface ResetLayoutButtonProps {
  /**
   * Handler to reset the current surface to its default layout.
   */
  onReset: () => void
}

/**
 * Reset layout button — restores the current surface to its default block layout.
 *
 * Displays a two-step confirmation (click to arm, click again to confirm) to prevent
 * accidental data loss when the user mangled a document.
 */
export function ResetLayoutButton({ onReset }: ResetLayoutButtonProps) {
  const [armedReset, setArmedReset] = useState(false)

  const handleResetClick = () => {
    if (armedReset) {
      onReset()
      setArmedReset(false)
    } else {
      setArmedReset(true)
    }
  }

  return (
    <button
      type="button"
      onClick={handleResetClick}
      className={`w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg text-sm font-medium transition cursor-pointer ${
        armedReset
          ? 'bg-red-50 hover:bg-red-100 text-red-700'
          : 'bg-surface-muted hover:bg-surface text-text border border-border'
      }`}
      title="Reset this surface to its default layout"
    >
      <RotateCcw size={14} strokeWidth={1.5} />
      {armedReset ? 'Reset layout?' : 'Reset layout'}
    </button>
  )
}
