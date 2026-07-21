'use client'

import { Users, FileText, Workflow } from 'lucide-react'
import type { ReactNode } from 'react'

/** Sidebar destinations a preview can navigate to. */
export type NavKey = 'couples' | 'templates' | 'automations'

/** Props implemented by every preview script. */
export interface PreviewScriptProps {
  /** True when this preview's step is on screen. */
  active: boolean
  reducedMotion: boolean
}

/** Props for {@link PreviewFrame}. */
export interface PreviewFrameProps {
  activeNav: NavKey
  /** True once the sidebar click beat has landed. */
  navClicked: boolean
  children: ReactNode
}

const NAV = [
  { key: 'couples' as const, label: 'Couples', Icon: Users },
  { key: 'templates' as const, label: 'Templates', Icon: FileText },
  { key: 'automations' as const, label: 'Automations', Icon: Workflow },
]

/**
 * A miniature Zebri window: sidebar rail on the left, content on the right.
 *
 * All four previews share this chassis so the set reads as one product
 * rather than four unrelated cartoons. On phones the rail collapses to
 * icons, because three labels plus a content area at 393px is mush.
 */
export function PreviewFrame({ activeNav, navClicked, children }: PreviewFrameProps) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex h-[260px] sm:h-[320px] shadow-sm">
      <nav className="w-14 sm:w-36 shrink-0 border-r border-border bg-surface-muted py-3 px-2 flex flex-col gap-1">
        {NAV.map(({ key, label, Icon }) => {
          const on = navClicked && key === activeNav
          return (
            <span
              key={key}
              data-active={on ? 'true' : 'false'}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors duration-300 ${
                on ? 'bg-card text-text font-medium' : 'text-text-subtle'
              }`}
            >
              <Icon size={14} strokeWidth={1.5} className="shrink-0" />
              <span data-active={on ? 'true' : 'false'} className="hidden sm:inline truncate">{label}</span>
            </span>
          )
        })}
      </nav>
      <div className="flex-1 min-w-0 p-3 sm:p-4 relative overflow-hidden">{children}</div>
    </div>
  )
}
