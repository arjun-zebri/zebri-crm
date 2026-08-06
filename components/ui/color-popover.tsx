'use client'

import * as Popover from '@radix-ui/react-popover'
import { Pipette } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface ColorPopoverProps {
  value: string
  onChange: (v: string) => void
  swatches?: readonly string[]
  trigger: React.ReactNode
  align?: 'start' | 'end' | 'center'
  /** Stacking class for the panel. Override when the trigger already
   *  lives inside a portalled layer that outranks the default — a
   *  swatch inside another popover needs to beat that popover, or the
   *  picker opens underneath the list it was opened from. Replaces the
   *  default rather than appending, since two z-utilities on one element
   *  resolve by stylesheet order, not by class order. */
  zClassName?: string
}

export function ColorPopover({
  value,
  onChange,
  swatches = [],
  trigger,
  align = 'start',
  zClassName = 'z-[70]',
}: ColorPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          className={`bg-white border border-gray-200 rounded-control shadow-xl p-3 ${zClassName} w-[280px] animate-modal-in`}
        >
          <ColorPickerBody value={value} onChange={onChange} swatches={swatches} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ── Picker body ──────────────────────────────────────────────────────────────

interface BodyProps {
  value: string
  onChange: (v: string) => void
  swatches?: readonly string[]
}

function ColorPickerBody({ value, onChange, swatches = [] }: BodyProps) {
  const hex = normalizeHex(value) || '#000000'
  const [h, s, v] = hexToHsv(hex)
  const [hexInput, setHexInput] = useState(hex)
  const [hueLocal, setHueLocal] = useState(h)

  // Keep the hex input synced when external value changes.
  useEffect(() => {
    if (normalizeHex(hexInput) !== hex) setHexInput(hex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex])

  // Keep hue stable while user drags saturation/value square so it doesn't
  // jump to red when reaching the grayscale edge.
  useEffect(() => {
    if (s > 0.001 && v > 0.001) setHueLocal(h)
  }, [h, s, v])

  const setFromHsv = (nh: number, ns: number, nv: number) => {
    onChange(hsvToHex(nh, ns, nv))
  }

  const commitHex = (raw: string) => {
    const cleaned = normalizeHex(raw)
    if (cleaned) onChange(cleaned)
  }

  const useEyedropper = async () => {
    const w = window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }
    if (!w.EyeDropper) return
    try {
      const result = await new w.EyeDropper().open()
      if (result.sRGBHex) onChange(normalizeHex(result.sRGBHex) || hex)
    } catch {
      /* user cancelled */
    }
  }

  const hasEyedropper = typeof window !== 'undefined' && 'EyeDropper' in window
  const visibleSwatches = swatches.slice(0, 6)

  return (
    <div>
      {/* Quick swatches strip */}
      <div className="flex items-center gap-1.5 mb-3">
        {hasEyedropper && (
          <button
            type="button"
            onClick={useEyedropper}
            title="Pick from screen"
            aria-label="Pick from screen"
            className="w-8 h-8 rounded-pill ring-1 ring-black/10 bg-white flex items-center justify-center text-gray-600 hover:text-gray-900 hover:ring-black/20 cursor-pointer transition shrink-0"
          >
            <Pipette size={13} strokeWidth={1.75} />
          </button>
        )}
        {visibleSwatches.map((c) => {
          const active = value.toLowerCase() === c.toLowerCase()
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              title={c}
              aria-label={c}
              className={`w-8 h-8 rounded-pill ring-1 hover:scale-105 transition cursor-pointer shrink-0 ${
                active ? 'ring-2 ring-gray-900' : 'ring-black/10'
              }`}
              style={{ background: c }}
            />
          )
        })}
      </div>

      {/* Saturation × value square */}
      <SatValSquare
        hue={hueLocal}
        sat={s}
        val={v}
        onChange={(ns, nv) => setFromHsv(hueLocal, ns, nv)}
      />

      {/* Hue strip */}
      <HueStrip
        hue={hueLocal}
        onChange={(nh) => {
          setHueLocal(nh)
          setFromHsv(nh, s || 1, v || 1)
        }}
      />

      {/* Hex input */}
      <div className="flex items-center gap-2 mt-3">
        <span
          className="w-9 h-9 rounded-control ring-1 ring-black/10 shrink-0"
          style={{ background: hex }}
          aria-hidden
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => {
            setHexInput(e.target.value)
            // Live commit when the input is a valid hex
            const cleaned = normalizeHex(e.target.value)
            if (cleaned) onChange(cleaned)
          }}
          onBlur={(e) => commitHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
          }}
          className="flex-1 border border-gray-200 rounded-control px-2.5 py-1.5 text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
          placeholder="#000000"
          maxLength={7}
          spellCheck={false}
        />
      </div>
    </div>
  )
}

// ── Saturation × Value square ────────────────────────────────────────────────

function SatValSquare({
  hue,
  sat,
  val,
  onChange,
}: {
  hue: number
  sat: number
  val: number
  onChange: (sat: number, val: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState(false)

  const setFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
      onChange(x, 1 - y)
    },
    [onChange],
  )

  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => setFromPoint(e.clientX, e.clientY)
    const up = () => setDrag(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [drag, setFromPoint])

  const hueColor = hsvToHex(hue, 1, 1)

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.preventDefault()
        setDrag(true)
        setFromPoint(e.clientX, e.clientY)
      }}
      className="relative w-full h-32 rounded-control cursor-crosshair overflow-hidden select-none mb-2"
      style={{ background: hueColor }}
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #000, transparent)' }} />
      <div
        className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-pill border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)] pointer-events-none"
        style={{ left: `${sat * 100}%`, top: `${(1 - val) * 100}%` }}
      />
    </div>
  )
}

// ── Hue strip ────────────────────────────────────────────────────────────────

function HueStrip({
  hue,
  onChange,
}: {
  hue: number
  onChange: (hue: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState(false)

  const setFromPoint = useCallback(
    (clientX: number) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      onChange(x * 360)
    },
    [onChange],
  )

  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => setFromPoint(e.clientX)
    const up = () => setDrag(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [drag, setFromPoint])

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.preventDefault()
        setDrag(true)
        setFromPoint(e.clientX)
      }}
      className="relative w-full h-3 rounded-pill cursor-pointer select-none"
      style={{
        background:
          'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
      }}
    >
      <div
        className="absolute top-1/2 w-4 h-4 -ml-2 -mt-2 rounded-pill bg-white border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)] pointer-events-none"
        style={{ left: `${(hue / 360) * 100}%`, background: hsvToHex(hue, 1, 1) }}
      />
    </div>
  )
}

// ── Color math ───────────────────────────────────────────────────────────────

function normalizeHex(input: string): string | null {
  if (!input) return null
  let h = input.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return `#${h.toUpperCase()}`
}

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || '').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return [r, g, b]
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) =>
    Math.round(Math.max(0, Math.min(1, n)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  return `#${to(r)}${to(g)}${to(b)}`
}

function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : delta / max
  return [h, s, max]
}

function hsvToHex(h: number, s: number, v: number): string {
  h = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let [r1, g1, b1] = [0, 0, 0]
  if (h < 60) [r1, g1, b1] = [c, x, 0]
  else if (h < 120) [r1, g1, b1] = [x, c, 0]
  else if (h < 180) [r1, g1, b1] = [0, c, x]
  else if (h < 240) [r1, g1, b1] = [0, x, c]
  else if (h < 300) [r1, g1, b1] = [x, 0, c]
  else [r1, g1, b1] = [c, 0, x]
  return rgbToHex(r1 + m, g1 + m, b1 + m)
}
