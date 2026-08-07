'use client'

import { ColorPopover } from '@/components/ui/color-popover'
import type { Density } from '@/lib/branding/themes'

/** Shared tile styling for the pickers; single-width border so selection
 *  never shifts layout. */
const OPTION_CLASSES = (selected: boolean) =>
  `rounded-control border cursor-pointer transition ${
    selected ? 'border-border-strong bg-surface-muted' : 'border-border hover:border-border-strong'
  }`

/**
 * Props for a labelled colour field (swatch popover + hex input).
 * @internal
 */
interface ColorFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
}

/**
 * ColorField: compact colour input used for the primary and secondary brand
 * colours; a swatch opens the picker, the hex is editable beside it.
 * @internal
 */
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-body font-medium text-text-muted mb-2">{label}</label>
      <div className="flex items-center gap-2">
        <ColorPopover
          value={value}
          onChange={onChange}
          trigger={
            <button
              type="button"
              className="w-8 h-8 shrink-0 rounded-control border border-border cursor-pointer focus-visible:ring-2 focus-visible:ring-brand/50 transition"
              style={{ backgroundColor: value }}
              aria-label={`Pick ${label.toLowerCase()}`}
            />
          }
          align="start"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 h-8 text-body px-2.5 rounded-control border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-brand"
          aria-label={`${label} hex`}
        />
      </div>
    </div>
  )
}

/**
 * Props for density picker.
 * @internal
 */
interface DensityPickerProps {
  density: Density
  setDensity: (v: Density) => void
}

/**
 * DensityPicker: spacing density as three side-by-side tiles, each with a
 * glyph whose line rhythm matches the choice.
 * @internal
 */
export function DensityPicker(props: DensityPickerProps) {
  return (
    <div>
      <label className="block text-body font-medium text-text-muted mb-2">Spacing</label>
      <div className="grid grid-cols-3 gap-2">
        {(['compact', 'cozy', 'roomy'] as const).map((d) => {
          const selected = props.density === d
          return (
            <label key={d} className="block">
              <input
                type="radio"
                name="density"
                checked={selected}
                onChange={() => props.setDensity(d)}
                className="sr-only"
                aria-label={d}
              />
              <div className={`flex flex-col items-center gap-2 px-2 py-3 ${OPTION_CLASSES(selected)}`}>
                <DensityGlyph density={d} />
                <span className="text-body font-medium text-text capitalize">{d}</span>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}


/**
 * DensityGlyph: three short lines whose vertical gaps mirror the density's
 * document rhythm.
 * @internal
 */
function DensityGlyph({ density }: { density: Density }) {
  const gaps: Record<Density, string> = { compact: 'gap-[3px]', cozy: 'gap-[5px]', roomy: 'gap-[8px]' }
  return (
    <div className={`flex flex-col ${gaps[density]}`} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className={`h-0.5 rounded-pill bg-text-subtle ${i === 2 ? 'w-5' : 'w-8'}`} />
      ))}
    </div>
  )
}
