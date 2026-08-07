/**
 * Master-detail layout shell for the Templates tabs.
 *
 * A dumb, responsive layout primitive: a narrow master **list** on the
 * left and a **detail/preview** pane on the right. It holds no data and no
 * selection state — each tab manager owns its `selectedId` and passes the
 * rendered list + detail in.
 *
 * - Desktop (`lg+`): both panes side by side, each with its own scroll.
 * - Mobile (`< lg`): one pane at a time. With nothing selected the list
 *   fills the screen; selecting an item swaps to a full-screen detail with
 *   a back bar that clears the selection.
 *
 * @module app/(dashboard)/templates/templates-two-pane
 */
'use client'

import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface TemplatesTwoPaneProps {
  /** Left master list (grouped or flat — the tab decides). */
  list: ReactNode
  /** Right detail/preview for the selected item, or a placeholder. */
  detail: ReactNode
  /** True when an item is selected — drives the mobile full-screen switch. */
  selected: boolean
  /** Clears the selection; wired to the mobile back arrow. */
  onBack: () => void
}

export function TemplatesTwoPane({ list, detail, selected, onBack }: TemplatesTwoPaneProps) {
  return (
    <div className="flex h-full min-h-0">
      {/* Master list: full width on mobile (hidden once an item is picked),
          fixed-width rail on desktop. */}
      <div
        className={`${selected ? 'hidden lg:flex' : 'flex'} h-full w-full min-w-0 flex-col overflow-y-auto lg:w-[340px] lg:shrink-0 lg:border-r lg:border-border lg:pr-4`}
      >
        {list}
      </div>

      {/* Detail: hidden on mobile until something is selected. */}
      <div
        className={`${selected ? 'flex' : 'hidden lg:flex'} h-full min-w-0 flex-1 flex-col overflow-y-auto lg:pl-6`}
      >
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 mb-2 flex cursor-pointer items-center gap-1.5 self-start text-body text-text-muted transition hover:text-text lg:hidden"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back
        </button>
        {detail}
      </div>
    </div>
  )
}
