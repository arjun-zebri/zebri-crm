/**
 * Four stats cards at the top of /automations.
 *
 * Total · Active · In flow · Paused. Calm - bordered surface,
 * monochrome icon, label, big number. No sparkline / progress bar
 * chrome - the rest of Zebri doesn't use those.
 *
 * @module app/(dashboard)/automations/stats-cards
 */
'use client'

import { Activity, Pause, Sparkles, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { AutomationsHomePayload } from '@/types/automations'

interface Props {
  payload: AutomationsHomePayload
}

interface Card {
  label: string
  value: number | string
  icon: LucideIcon
}

export function StatsCards({ payload }: Props) {
  const { stats, upcomingForCouples } = payload
  const paused = stats.totalAutomations - stats.active

  const cards: Card[] = [
    { label: 'Total automations', value: stats.totalAutomations, icon: Sparkles },
    { label: 'Active', value: stats.active, icon: Activity },
    { label: 'Couples in flow', value: upcomingForCouples.length, icon: Users },
    { label: 'Paused', value: paused, icon: Pause },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <StatsCard key={c.label} card={c} />
      ))}
    </div>
  )
}

function StatsCard({ card }: { card: Card }) {
  const Icon = card.icon
  return (
    <div className="border border-border rounded-control bg-surface px-4 py-3 flex items-center gap-3">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-control bg-surface-muted shrink-0">
        <Icon size={16} strokeWidth={1.5} className="text-text-muted" />
      </span>
      <div className="min-w-0">
        <div className="text-body text-text-muted truncate">{card.label}</div>
        <div className="text-section font-semibold text-text leading-tight">{card.value}</div>
      </div>
    </div>
  )
}
