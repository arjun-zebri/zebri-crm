'use client';

/**
 * Bottom-left legend: which steps the MC does, and which Zebri does.
 *
 * A canvas of cards said nothing about the one distinction that decides
 * whether a workflow is a plan or a machine. "Send contract" and "Ring
 * the venue" looked identical, so the only way to know whether a step
 * would happen on its own was to open it.
 *
 * The badge on each card carries the answer; this says what the badge
 * means. It is deliberately the quietest thing on the canvas: a legend
 * that competes with the flow it explains has failed.
 *
 * @module app/(dashboard)/workflows/[id]/canvas-legend
 */

import { User, Zap } from 'lucide-react';

/** The two kinds of step, and the icon each card wears. */
export function CanvasLegend() {
  return (
    <div className="pointer-events-none absolute bottom-6 left-6 z-10 flex flex-col gap-1.5 rounded-control border border-border bg-card/90 px-3 py-2 shadow-sm backdrop-blur-sm">
      <LegendRow icon={<User size={11} strokeWidth={2} />} label="You do it" />
      <LegendRow icon={<Zap size={11} strokeWidth={2} />} label="Zebri does it" />
    </div>
  );
}

function LegendRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2 text-body text-text-muted">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-pill border border-border bg-surface text-text-muted">
        {icon}
      </span>
      {label}
    </span>
  );
}
