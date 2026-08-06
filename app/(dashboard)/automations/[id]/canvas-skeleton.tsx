/**
 * Skeleton view shown while the canvas builder loads.
 *
 * Mirrors the actual layout so the page doesn't jump when the
 * real content lands: top header with name + saved indicator +
 * test/activate buttons, Zebri AI rail on the left, dotted-grid
 * canvas in the centre with a faint trigger card placeholder.
 *
 * Pure visual - no data, no handlers.
 *
 * @module app/(dashboard)/automations/[id]/canvas-skeleton
 */
'use client'

import { ArrowLeft } from 'lucide-react'

export function CanvasSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <HeaderSkeleton />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AiRailSkeleton />
        <CanvasAreaSkeleton />
      </div>
    </div>
  )
}

/* ─── Header ─────────────────────────────────────────────────── */

function HeaderSkeleton() {
  return (
    <header className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface">
      <div className="text-text-muted p-1 -ml-1">
        <ArrowLeft size={18} strokeWidth={1.5} />
      </div>
      <div className="h-5 w-40 bg-surface-emphasis rounded-control animate-pulse" />
      <div className="ml-auto flex items-center gap-3">
        <div className="h-5 w-16 bg-surface-emphasis rounded-pill animate-pulse" />
        <div className="h-4 w-24 bg-surface-emphasis rounded-control animate-pulse" />
        <div className="h-8 w-24 bg-surface-emphasis rounded-control animate-pulse" />
        <div className="h-8 w-24 bg-surface-emphasis rounded-control animate-pulse" />
      </div>
    </header>
  )
}

/* ─── Zebri AI rail ──────────────────────────────────────────── */

function AiRailSkeleton() {
  return (
    <aside className="w-[320px] shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="px-4 pt-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-control bg-surface-emphasis animate-pulse" />
          <div className="h-4 w-20 bg-surface-emphasis rounded-control animate-pulse" />
        </div>
        <div className="h-3 w-56 bg-surface-emphasis rounded-control mt-2 animate-pulse" />
      </div>
      <div className="flex-1 px-4 py-4">
        <div className="bg-surface-muted rounded-control p-3 space-y-2 animate-pulse">
          <div className="h-3 w-full bg-surface-emphasis rounded-control" />
          <div className="h-3 w-5/6 bg-surface-emphasis rounded-control" />
          <div className="h-3 w-2/3 bg-surface-emphasis rounded-control" />
        </div>
      </div>
      <div className="border-t border-border p-3">
        <div className="rounded-control border border-border bg-surface-muted/40 h-[88px] animate-pulse" />
      </div>
    </aside>
  )
}

/* ─── Canvas area with placeholder trigger card ──────────────── */

function CanvasAreaSkeleton() {
  return (
    <div
      className="flex-1 relative"
      style={{
        // Match the React Flow background dot pattern so the
        // skeleton fills in seamlessly when the canvas mounts.
        backgroundImage:
          'radial-gradient(circle, var(--color-border) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      <div className="absolute inset-0 flex items-start justify-center pt-24">
        <div className="w-[240px] rounded-control border border-border bg-surface flex items-center gap-3 px-3 py-2.5 animate-pulse">
          <div className="w-4 h-4 rounded-control bg-surface-emphasis shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-24 bg-surface-emphasis rounded-control" />
            <div className="h-2.5 w-32 bg-surface-emphasis rounded-control" />
          </div>
        </div>
      </div>
    </div>
  )
}
