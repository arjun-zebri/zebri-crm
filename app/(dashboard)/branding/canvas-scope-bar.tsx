'use client'

import { LayoutTemplate } from 'lucide-react'

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
}

export interface CanvasScopeBarProps {
  surface: SurfaceTab
  /** When provided, renders the "Clear all blocks" action on the right. */
  onClearBlocks?: (() => void) | undefined
}

export function CanvasScopeBar({ surface, onClearBlocks }: CanvasScopeBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <div className="flex items-center gap-1.5 text-[11px] min-w-0">
        <LayoutTemplate size={12} strokeWidth={1.75} className="text-gray-400 shrink-0" />
        <span className="font-medium text-gray-500 shrink-0">{SURFACE_LABEL[surface]} layout</span>
        <span className="text-gray-400 truncate">· blocks &amp; wording for this document only</span>
      </div>
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
  )
}
