'use client'

/**
 * The add-section palette's actual content (Task 8, split out for the
 * final review's Finding 4): the Sections/Presets tab strip plus the
 * matching list of `MenuItem`s. `add-palette.tsx` renders this bare
 * inside `Modal` (no `MenuPanel` around it there - see that file's module
 * doc for why) and inside `MenuPanel` for the Popover branch, so the two
 * presentations never drift out of sync with each other.
 *
 * @module features/proposals/editor/palette-body
 */
import {
  CircleCheck, FileText, HelpCircle, ImageIcon, MessageSquareQuote, Package, Video, type LucideIcon,
} from 'lucide-react'

import { MenuItem, MenuSeparator } from '@/components/ui/menu'
import type { ProposalRole } from '@/lib/proposals/types'

import type { Section, SectionKind } from '../model/layout'
import { PRESET_IDS, PRESET_LABELS, presetSection } from '../model/presets'

import { newSectionFor } from './state'

/** Which tab of the palette is showing. */
export type PaletteTab = 'sections' | 'presets'

/** One row of the Sections tab. */
interface SectionItem {
  kind: SectionKind
  label: string
  icon: LucideIcon
}

/** The seven `SectionKind`s, in the order the tab lists them. */
const SECTION_ITEMS: readonly SectionItem[] = [
  { kind: 'content', label: 'Text', icon: FileText },
  { kind: 'packages', label: 'Packages', icon: Package },
  { kind: 'gallery', label: 'Gallery', icon: ImageIcon },
  { kind: 'video', label: 'Video', icon: Video },
  { kind: 'testimonials', label: 'Testimonials', icon: MessageSquareQuote },
  { kind: 'faq', label: 'FAQ', icon: HelpCircle },
  { kind: 'accept', label: 'Accept', icon: CircleCheck },
]

/** One tab button in the palette's `role="tablist"` strip. */
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-control px-2.5 py-1 text-body transition-colors ${
        active ? 'bg-surface-emphasis font-medium text-text' : 'text-text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

/** Props for {@link PaletteBody}. */
export interface PaletteBodyProps {
  tab: PaletteTab
  onTabChange: (tab: PaletteTab) => void
  /** Flavours preset copy (`presetSection`'s `role` param) and the about/how-it-works section starters. */
  role: ProposalRole
  onChoose: (section: Section) => void
}

/** Two-tab section/preset list. Presentation only: never dispatches, just hands the chosen section to `onChoose`. */
export function PaletteBody({ tab, onTabChange, role, onChoose }: PaletteBodyProps) {
  return (
    <>
      <div role="tablist" className="flex gap-1 px-1 pb-1">
        <TabButton active={tab === 'sections'} onClick={() => onTabChange('sections')}>Sections</TabButton>
        <TabButton active={tab === 'presets'} onClick={() => onTabChange('presets')}>Presets</TabButton>
      </div>
      <MenuSeparator />
      <div role="tabpanel">
        {tab === 'sections'
          ? SECTION_ITEMS.map(({ kind, label, icon: Icon }) => (
              <MenuItem key={kind} onClick={() => onChoose(newSectionFor(kind, role))}>
                <span className="flex items-center gap-2">
                  <Icon size={14} strokeWidth={1.5} />
                  {label}
                </span>
              </MenuItem>
            ))
          : PRESET_IDS.map((id) => (
              <MenuItem key={id} onClick={() => onChoose(presetSection(id, role))}>
                <span className="flex flex-col items-start">
                  <span>{PRESET_LABELS[id].label}</span>
                  <span className="text-text-subtle">{PRESET_LABELS[id].description}</span>
                </span>
              </MenuItem>
            ))}
      </div>
    </>
  )
}
