'use client'

/**
 * Full-page live preview of the template being edited (UX audit §3.7: the
 * header had no Preview action at all, "the one action a template author
 * needs and does not have"). Renders the same `ProposalLayoutView` the
 * couple's public page renders, fed the editor's *live, unsaved*
 * `state.layout` - that is the point of a Preview button next to an
 * editor that autosaves on a debounce: it answers "what does this look
 * like right now", not "what does the last save look like".
 *
 * Opened by the header's Preview button or Cmd/Ctrl+Shift+P
 * (`use-preview-shortcut.ts`), closed by its own Close button or Escape.
 * Sits above the dashboard sidebar and every editor chrome layer, but
 * below the shared overlay stack's `top` tier (`components/ui/use-overlay.ts`)
 * so a confirmation raised from inside it (there is none today, but the
 * ladder is shared) would still read as frontmost.
 *
 * @module features/proposals/editor/preview-overlay
 */
import { Eye, Monitor, Smartphone, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { PillToggle, type CanvasDevice } from '@/components/editor'
import { Button } from '@/components/ui/button'
import { useOverlay } from '@/components/ui/use-overlay'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { SAMPLE_PROPOSAL_DOC } from '@/lib/proposals/sample-proposal'

import type { ProposalLayout } from '../model/layout'
import { resolveTheme } from '../model/theme'
import { ProposalLayoutView } from '../render/layout'
import { pageSurfaceStyle } from '../render/page-surface'

/** Props for {@link PreviewOverlay}. */
export interface PreviewOverlayProps {
  isOpen: boolean
  onClose: () => void
  /** The editor's current (possibly unsaved) layout - rendered as-is, autosave status notwithstanding. */
  layout: ProposalLayout
  branding: PublicBranding
  /** Seeds the overlay's own device toggle. The overlay's choice never writes back to the editor's own `device` state - it is a preview, not a canvas control. */
  initialDevice: CanvasDevice
}

/** Full-page preview: a top bar (device toggle, Close) over a scrolling sheet rendering `layout` exactly as the public page would. */
export function PreviewOverlay({ isOpen, onClose, layout, branding, initialDevice }: PreviewOverlayProps) {
  const [device, setDevice] = useState<CanvasDevice>(initialDevice)
  const theme = resolveTheme(layout, branding)
  const step = theme.flow === 'step'
  // Re-seed from the editor's current device on every closed->open
  // transition (not just on first mount, since the overlay stays mounted
  // across opens/closes) - a render-phase adjustment, not an effect,
  // exactly like `editor-header-name-field.tsx`'s `NameField` adopting a
  // server-confirmed name: comparing-and-setting during render is the
  // React-endorsed way to derive state from a prop change, where an
  // effect would cause an extra, visible render.
  const [wasOpen, setWasOpen] = useState(isOpen)
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen)
    if (isOpen) setDevice(initialDevice)
  }

  const closeButtonRef = useRef<HTMLButtonElement>(null)
  useOverlay({ isOpen, onClose })

  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div role="dialog" aria-modal="true" aria-label="Preview" className="fixed inset-0 z-[70] flex flex-col bg-surface">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="flex items-center gap-1.5 text-body font-medium text-text">
          <Eye size={16} strokeWidth={1.5} />
          Preview
        </span>
        <div className="flex-1" />
        <PillToggle<CanvasDevice>
          value={device}
          onChange={setDevice}
          options={[
            { value: 'desktop', label: 'Desktop', icon: <Monitor size={13} strokeWidth={1.5} /> },
            { value: 'mobile', label: 'Mobile', icon: <Smartphone size={13} strokeWidth={1.5} /> },
          ]}
        />
        <Button ref={closeButtonRef} variant="ghost" onClick={onClose} className="gap-1.5">
          <X size={16} strokeWidth={1.5} />
          Close
        </Button>
      </div>

      {/* `data-doc-scroll` marks this as the snap container for a step-flow
          layout (`globals.css`), and `--doc-screen` tells each section how
          tall one "screen" is here: the viewport minus this overlay's own
          h-12 header, since the sections snap inside this box, not the
          window. The page padding drops to zero in step flow so the first
          screen starts exactly at the top of the box. */}
      <div
        data-doc-scroll
        className="flex-1 overflow-y-auto bg-surface-emphasis"
        style={step ? { ['--doc-screen' as string]: 'calc(100vh - 3rem)' } : undefined}
      >
        {/* `min-h-full` on both this wrapper and the sheet below: a
            percentage-based min-height only resolves against an ancestor
            with its own resolved height, so the chain has to carry it
            down from the scroll viewport (a definite `flex-1` height) to
            the sheet itself. */}
        <div className={`flex min-h-full justify-center ${step ? '' : 'px-3 py-6 sm:px-6'}`}>
          {/*
            The sheet duplicates the page background/text/font styling
            `ProposalLayoutView` already paints on its own inner div -
            intentional, same as `proposal-page.tsx`'s outer wrapper: with
            `min-h-full` this sheet extends past a layout shorter than the
            viewport, and without its own background that overflow would
            show the workbench colour instead of the page's.
          */}
          <div
            className={`min-h-full shrink-0 shadow-lg @container/doc [&_a]:[color:var(--doc-link)] ${
              device === 'mobile' ? 'w-[390px]' : 'w-full max-w-[1200px]'
            }`}
            style={pageSurfaceStyle(theme, branding)}
          >
            {/* `defaultSelection={false}`: same sample doc, no real couple choice - see `resolveSelection`'s doc comment. */}
            <ProposalLayoutView layout={layout} branding={branding} doc={SAMPLE_PROPOSAL_DOC} mode="page" defaultSelection={false} />
          </div>
        </div>
      </div>
    </div>
  )
}
