'use client'

import { ChevronDown, Globe, Layout, Paintbrush, Type as TypeIcon } from 'lucide-react'

import { FONT_STACKS, type HeadingFont } from '@/lib/branding/fonts'

import { DEMO_GREEN } from './demo-doc'

/**
 * Props for the demo's brand-kit rail.
 * @internal
 */
interface DemoRailProps {
  /** Brand colours accordion expanded. */
  colorsOpen: boolean
  /** Heading colour palette popover open. */
  paletteOpen: boolean
  /** Current heading colour, on the Heading row's swatch. */
  headingHex: string
  /** Typography accordion expanded. */
  fontsOpen: boolean
  /** Heading font dropdown open. */
  fontMenuOpen: boolean
  /** Current heading font. */
  fontHeading: HeadingFont
  /** Current heading size in px. */
  headingSize: number
}

// Same titles, subtitles and icons as the real brand-panel accordions.
const SECTIONS = [
  { title: 'Your business', subtitle: 'Name, phone, socials', Icon: Globe },
  { title: 'Brand colours', subtitle: 'Primary, accent, surface…', Icon: Paintbrush, cursor: 'rail-colors' },
  { title: 'Typography', subtitle: 'Fonts, weights, scale', Icon: TypeIcon, cursor: 'rail-fonts' },
  { title: 'Global styles', subtitle: 'Radius, links, buttons', Icon: Layout },
]

const PALETTE = ['#111827', DEMO_GREEN, '#7C3A2D', '#1E3A5F']

const FONT_OPTIONS: { id: HeadingFont; label: string }[] = [
  { id: 'inter', label: 'Inter' },
  { id: 'playfair', label: 'Playfair Display' },
  { id: 'lora', label: 'Lora' },
]

/**
 * DemoRail — miniature of the editor's left brand-kit rail (brand-panel).
 *
 * Header, then the four real accordion sections. Brand colours opens to its
 * colour rows (the Heading swatch opens a palette popover); Typography opens
 * to the Heading font picker and size slider. Everything set here is the
 * global half of the story — it applies to every document.
 * @internal
 */
export function DemoRail(props: DemoRailProps) {
  return (
    <aside className="w-[168px] shrink-0 border-r border-gray-100 bg-surface overflow-hidden">
      <div className="px-2.5 pt-2 pb-1.5 border-b border-gray-50">
        <p className="text-[8px] font-medium text-text-subtle uppercase tracking-[0.08em]">Brand kit</p>
        <p className="text-[10px] font-medium text-text flex items-center gap-1">
          <Globe size={9} strokeWidth={1.75} className="text-text-subtle shrink-0" />
          Applies to every document
        </p>
      </div>

      {SECTIONS.map(({ title, subtitle, Icon, cursor }) => {
        const open =
          (title === 'Brand colours' && props.colorsOpen) || (title === 'Typography' && props.fontsOpen)
        return (
          <div key={title} className="border-b border-gray-50">
            <span data-cursor={cursor} className="flex items-center gap-1.5 px-2.5 py-1.5">
              <span className="w-4.5 h-4.5 rounded-control bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 p-1">
                <Icon size={9} strokeWidth={1.75} className="text-text-muted" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[9px] font-medium text-text truncate">{title}</span>
                <span className="block text-[8px] text-text-subtle truncate">{subtitle}</span>
              </span>
              <ChevronDown
                size={8}
                strokeWidth={1.5}
                className={`text-text-subtle shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </span>

            {title === 'Brand colours' && open && (
              <div data-testid="demo-colors-open" className="px-2.5 pb-2 space-y-1.5 animate-fade-in">
                <ColorRow label="Heading" hex={props.headingHex} cursor="swatch-heading" paletteOpen={props.paletteOpen} />
                <ColorRow label="Body text" hex="#6B7280" />
                <ColorRow label="Primary button" hex="#111827" />
              </div>
            )}

            {title === 'Typography' && open && (
              <div data-testid="demo-fonts-open" className="px-2.5 pb-2 space-y-1.5 animate-fade-in">
                <p className="text-[8px] text-text-subtle uppercase tracking-[0.08em]">Heading</p>
                <div className="relative">
                  <span
                    data-cursor="font-picker"
                    className="flex items-center justify-between gap-1 rounded-control border border-border px-1.5 py-1 text-[9px] text-text"
                    style={{ fontFamily: FONT_STACKS[props.fontHeading] }}
                  >
                    {FONT_OPTIONS.find((f) => f.id === props.fontHeading)?.label}
                    <ChevronDown size={8} strokeWidth={1.5} className="text-text-subtle shrink-0" />
                  </span>
                  {props.fontMenuOpen && (
                    <div className="absolute inset-x-0 top-full mt-1 z-20 rounded-control border border-border bg-surface p-1 shadow-xl animate-modal-in">
                      {FONT_OPTIONS.map((f) => (
                        <span
                          key={f.id}
                          data-cursor={f.id === 'playfair' ? 'font-playfair' : undefined}
                          className={`block rounded-control px-1.5 py-1 text-[9px] ${
                            f.id === props.fontHeading ? 'bg-surface-emphasis text-text font-medium' : 'text-gray-700'
                          }`}
                          style={{ fontFamily: FONT_STACKS[f.id] }}
                        >
                          {f.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-text-muted">Size</span>
                    <span className="text-[9px] font-mono text-gray-700 tabular-nums">{props.headingSize}px</span>
                  </div>
                  {/* Mini slider; the thumb sits at the size's position on the
                      real 16-64px range and glides when the pointer clicks. */}
                  <div data-cursor="size-slider" className="relative h-3 flex items-center">
                    <div className="h-1 w-full rounded-pill bg-gray-200" />
                    <span
                      className="absolute size-2.5 rounded-pill bg-surface border border-border-strong shadow-sm -translate-x-1/2 transition-[left] duration-500 motion-reduce:transition-none"
                      style={{ left: `${((props.headingSize - 16) / 48) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </aside>
  )
}

/** One miniature colour row: round swatch + tiny uppercase label. @internal */
function ColorRow({ label, hex, cursor, paletteOpen }: { label: string; hex: string; cursor?: string; paletteOpen?: boolean }) {
  return (
    <div className="relative flex items-center gap-1.5">
      <span
        data-cursor={cursor}
        className="size-3.5 rounded-pill border border-black/10 shrink-0 transition-colors duration-500 motion-reduce:transition-none"
        style={{ background: hex }}
      />
      <span className="text-[8px] text-text-subtle uppercase tracking-[0.08em] truncate">{label}</span>
      {paletteOpen && (
        <div className="absolute left-0 top-full mt-1 z-20 flex items-center gap-1 rounded-control border border-border bg-surface p-1.5 shadow-xl animate-modal-in">
          {PALETTE.map((c) => (
            <span
              key={c}
              data-cursor={c === DEMO_GREEN ? 'pick-green' : undefined}
              className={`size-3 rounded-pill border border-black/10 shrink-0 ${hex === c ? 'ring-2 ring-gray-900 ring-offset-1' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
