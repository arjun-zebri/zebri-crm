'use client'

import { Check, Clock, FileSignature, FileText, Plus, Receipt, Settings2 } from 'lucide-react'

/**
 * Props for the demo's topbar + document tab strip.
 * @internal
 */
interface DemoTabsProps {
  /** The documents popover (behind the gear) is open. */
  docsOpen: boolean
  /** Run sheet has been ticked on: its row checks and its tab appears. */
  runSheetOn: boolean
}

// Same labels, subtitles and icons as the real surface-tabs strip.
const TABS = [
  { label: 'Invoice', subtitle: 'Once booked', Icon: Receipt, active: true },
  { label: 'Contract', subtitle: 'E-sign agreement', Icon: FileSignature, active: false },
]

const DOC_ROWS = ['Invoice', 'Contract', 'Run sheet'] as const

/** One document tab card, mirroring the real strip's icon + label + subtitle. @internal */
function Tab({ label, subtitle, Icon, active }: { label: string; subtitle: string; Icon: typeof FileText; active: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-control border pl-1.5 pr-2 py-1 bg-surface ${
        active ? 'border-gray-900 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.18)]' : 'border-border'
      }`}
    >
      <span className="w-4.5 h-4.5 rounded-control bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 p-1">
        <Icon size={9} strokeWidth={1.5} className="text-text-muted" />
      </span>
      <span className="text-left min-w-0">
        <span className={`block text-[9px] font-medium leading-tight ${active ? 'text-text' : 'text-gray-700'}`}>{label}</span>
        <span className="block text-[8px] text-text-subtle leading-tight">{subtitle}</span>
      </span>
    </span>
  )
}

/**
 * DemoTabs — miniature of the editor's topbar and surface tab strip.
 *
 * Mirrors surface-tabs.tsx: one card per document with the active one on a
 * dark border, and the settings gear on the right whose popover is where you
 * choose which documents you use. The Run sheet tab pops into the strip the
 * moment its row is ticked, exactly like the real editor.
 * @internal
 */
export function DemoTabs({ docsOpen, runSheetOn }: DemoTabsProps) {
  return (
    <>
      {/* Topbar: kit name + Add block, like editor-topbar. */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100">
        <span className="text-[10px] font-semibold text-text">My brand</span>
        <span className="text-[8px] text-text-subtle">Saved</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-control border border-border px-1.5 py-0.5 text-[8px] font-medium text-gray-700">
          <Plus size={8} strokeWidth={2} /> Add block
        </span>
      </div>

      {/* Tab strip. */}
      <div className="relative flex items-center gap-1.5 border-b border-gray-100 px-2 py-1.5">
        {TABS.map(({ label, subtitle, Icon, active }) => (
          <Tab key={label} label={label} subtitle={subtitle} Icon={Icon} active={active} />
        ))}
        {runSheetOn && (
          <span data-testid="demo-tab-run-sheet" className="animate-fade-in">
            <Tab label="Run sheet" subtitle="Live timeline" Icon={Clock} active={false} />
          </span>
        )}
        <span
          data-cursor="doc-gear"
          className="ml-auto inline-flex items-center justify-center h-5 w-5 rounded-control border border-border text-text-muted"
        >
          <Settings2 size={9} strokeWidth={1.75} />
        </span>

        {/* The "Choose which documents you use" popover, anchored to the gear. */}
        {docsOpen && (
          <div className="absolute right-2 top-full mt-1 z-20 w-[110px] rounded-control border border-border bg-surface p-1.5 shadow-xl animate-modal-in">
            <p className="px-1 pb-1 text-[8px] font-medium text-text-subtle">Your documents</p>
            {DOC_ROWS.map((label) => {
              const on = label !== 'Run sheet' || runSheetOn
              return (
                <span
                  key={label}
                  data-cursor={label === 'Run sheet' ? 'doc-run-sheet' : undefined}
                  className="flex items-center gap-1.5 rounded-control px-1 py-0.5 text-[9px] text-gray-700"
                >
                  <span
                    className={`inline-flex items-center justify-center w-3 h-3 rounded-control border shrink-0 transition-colors duration-300 ${
                      on ? 'bg-gray-900 border-gray-900 text-white' : 'border-border-strong'
                    }`}
                  >
                    {on && <Check size={8} strokeWidth={2} />}
                  </span>
                  {label}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
