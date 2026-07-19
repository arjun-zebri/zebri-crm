'use client'

import { LayoutTemplate, RotateCcw } from 'lucide-react'
import { useState } from 'react'

import type { SurfaceTab } from '@/types/branding-preview'

/**
 * The counterpart to the brand rail's "applies to every document" header.
 *
 * The left rail edits global brand tokens (colours, fonts, density) that
 * flow into every surface; the canvas edits the block layout + wording of
 * the *one* surface you're viewing. That split is invisible in the UI, so
 * this bar names the current surface and states that what you change here
 * stays document-scoped. It also hosts the "Clear all blocks" action so
 * the canvas has a single, calm header row.
 *
 * @module app/(dashboard)/branding/canvas-scope-bar
 */

const SURFACE_LABEL: Record<SurfaceTab, string> = {
  proposal: 'Proposal',
  invoice: 'Invoice',
  contract: 'Contract',
  portal: 'Portal',
  vendorTimeline: 'Run sheet',
  questionnaire: 'Questionnaire',
}

export interface CanvasScopeBarProps {
  surface: SurfaceTab
  /** When provided, renders the "Clear all blocks" action on the right. */
  onClearBlocks?: (() => void) | undefined
  /**
   * Restores this surface's default block layout. It lives here rather than in
   * the brand rail because it is document-scoped, exactly like the rest of this
   * bar, and it is distinct from the rail's Reset, which reverts brand-kit
   * customisations to the theme preset.
   */
  onResetLayout?: (() => void) | undefined
}

export function CanvasScopeBar({ surface, onClearBlocks, onResetLayout }: CanvasScopeBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <div className="flex items-center gap-1.5 text-[11px] min-w-0">
        <LayoutTemplate size={12} strokeWidth={1.75} className="text-gray-400 shrink-0" />
        <span className="font-medium text-gray-500 shrink-0">{SURFACE_LABEL[surface]} layout</span>
        <span className="text-gray-400 truncate">· blocks &amp; wording for this document only</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {onResetLayout && <ResetLayoutAction onReset={onResetLayout} />}
        {onClearBlocks && (
          <button
            type="button"
            onClick={onClearBlocks}
            className="text-[11px] text-gray-400 hover:text-red-500 cursor-pointer transition shrink-0"
          >
            Clear all blocks
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Two-step reset. The first click arms it and the second confirms, because
 * discarding a layout the user has built is not recoverable from here.
 */
function ResetLayoutAction({ onReset }: { onReset: () => void }) {
  const [armed, setArmed] = useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        if (armed) {
          onReset()
          setArmed(false)
        } else {
          setArmed(true)
        }
      }}
      onBlur={() => setArmed(false)}
      title="Restore this document's default layout"
      className={`inline-flex items-center gap-1 text-[11px] cursor-pointer transition shrink-0 ${
        armed ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <RotateCcw size={10} strokeWidth={1.75} />
      {armed ? 'Reset layout?' : 'Reset layout'}
    </button>
  )
}
