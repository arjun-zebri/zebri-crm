'use client'

/**
 * Global style: canvas-level styling for the whole proposal
 * (`model/theme.ts`). One button pinned to the top-left of the canvas
 * workbench (`editor-canvas-region.tsx`) that opens a popover with two
 * tabs: Page (`global-style-page-tab.tsx`: background, spacing, flow,
 * animation) and Text (`global-style-text-tab.tsx`: the four text roles).
 * A footer "Reset to default" re-seeds the whole theme from Branding. The
 * popover mirrors the section Style popover (`bars/section-style-popover.tsx`)
 * in chrome and width so the two read as one family.
 *
 * Presentation only: every change is a `setTheme` dispatch, committed as
 * one undo step, so undo/redo, autosave and the external-change rehydrate
 * all see theme edits exactly like section edits.
 *
 * @module features/proposals/editor/global-style/global-style-popover
 */
import * as Popover from '@radix-ui/react-popover'
import { Palette } from 'lucide-react'
import { useState, type RefObject } from 'react'

import { Button } from '@/components/ui/button'
import type { PublicBranding } from '@/lib/branding/public-branding'

import { defaultTheme, type ProposalTheme } from '../../model/theme'
import type { LayoutAction, ThemePatch } from '../state'
import { TabButton } from '../tab-button'

import { GlobalStylePageTab } from './global-style-page-tab'
import { GlobalStyleTextTab } from './global-style-text-tab'

type PanelTab = 'page' | 'text'

/** Props for {@link GlobalStylePopover}. */
export interface GlobalStylePopoverProps {
  theme: ProposalTheme
  /** Branding, for "Reset to default" (re-seeds via `defaultTheme`). */
  branding: PublicBranding
  dispatch: (action: LayoutAction, opts?: { commit?: boolean }) => void
  /** The canvas scroll element; the popover collides against it, never the page chrome. */
  boundsRef: RefObject<HTMLElement | null>
  /** Brand swatches offered by every colour picker. Defaults to none. */
  swatches?: readonly string[]
}

/** The Global style button and its popover. See the module doc. */
export function GlobalStylePopover({ theme, branding, dispatch, boundsRef, swatches = [] }: GlobalStylePopoverProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<PanelTab>('page')
  // Captured on open, not read during render: see `section-padding.tsx`'s
  // matching comment for why (`react-hooks/refs`).
  const [bounds, setBounds] = useState<HTMLElement | null>(null)
  const onPatch = (patch: ThemePatch) => dispatch({ type: 'setTheme', patch }, { commit: true })

  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) setBounds(boundsRef.current) }}>
      <Popover.Trigger asChild>
        <Button variant="outline" aria-label="Global style" aria-expanded={open} className="gap-1.5 shadow-sm">
          <Palette size={14} strokeWidth={1.5} />
          Global style
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          collisionBoundary={bounds}
          className="z-[60] flex max-h-[min(36rem,calc(100vh-6rem))] w-[320px] flex-col animate-modal-in rounded-control border border-border bg-surface shadow-xl"
        >
          <div role="tablist" className="flex shrink-0 gap-1 border-b border-border px-4 pb-2 pt-3">
            <TabButton active={tab === 'page'} onClick={() => setTab('page')}>Page</TabButton>
            <TabButton active={tab === 'text'} onClick={() => setTab('text')}>Text</TabButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
            {tab === 'page'
              ? <GlobalStylePageTab theme={theme} onPatch={onPatch} swatches={swatches} />
              : <GlobalStyleTextTab theme={theme} onPatch={onPatch} swatches={swatches} />}
          </div>
          <div className="shrink-0 border-t border-border px-4 py-2">
            <Button
              variant="ghost"
              className="w-full justify-center"
              onClick={() => dispatch({ type: 'setTheme', patch: defaultTheme(branding) }, { commit: true })}
            >
              Reset to default
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
