'use client'

import * as Popover from '@radix-ui/react-popover'
import { AlignLeft, AlignCenter, AlignRight, Italic, Underline, Type, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { ColorPopover } from '@/components/ui/color-popover'
import { Tooltip } from '@/components/ui/tooltip'
import {
  HEADING_FONTS,
  BODY_FONTS,
  FONT_LABELS,
  FONT_STACKS,
  FONT_WEIGHTS,
  FONT_WEIGHT_LABELS,
  type HeadingFont,
  type BodyFont,
  type FontWeight,
} from '@/lib/branding/fonts'
import type { TextCase } from '@/lib/branding/text-case'

import { Select, type SelectOption } from '../components/select'
import { Slider } from '../components/slider'



import { TEXT_COLOR_PRESETS, type TextStyleDefaults } from './text-style'
import type { TextStyle } from './types'

/** Case options for the block-level toolbar, sharing the rail's glyph +
 *  wording so the two capitalisation controls read identically. 'None' keeps
 *  a per-block escape hatch (unlike the global rail, which has no as-typed). */
const CASE_OPTIONS: Array<{ id: TextCase; glyph: string; tooltip: string }> = [
  { id: 'none', glyph: 'As', tooltip: 'As typed' },
  { id: 'sentence', glyph: 'Aa', tooltip: 'Capitalise first letter' },
  { id: 'capitalize', glyph: 'Ab', tooltip: 'Capitalise each word' },
  { id: 'uppercase', glyph: 'AA', tooltip: 'Uppercase' },
  { id: 'lowercase', glyph: 'aa', tooltip: 'Lowercase' },
]

interface TextStyleControlsProps {
  style: TextStyle | undefined
  defaults: TextStyleDefaults
  onChange: (patch: TextStyle) => void
  fontKind?: 'heading' | 'body' | 'all'
  expanded?: boolean
  /** Optional control rendered immediately after the text colour picker (e.g.
   *  the block background colour), so the two colour controls sit together. */
  bgSlot?: ReactNode
}

export function TextStyleControls({
  style,
  defaults,
  onChange,
  fontKind = 'all',
  expanded = false,
  bgSlot,
}: TextStyleControlsProps) {
  const eff = {
    fontFamily: style?.fontFamily ?? defaults.fontFamily,
    fontSize: style?.fontSize ?? defaults.fontSize,
    fontWeight: style?.fontWeight ?? defaults.fontWeight,
    color: style?.color ?? defaults.color,
    align: style?.align ?? defaults.align,
    lineHeight: style?.lineHeight ?? defaults.lineHeight,
    letterSpacing: style?.letterSpacing ?? defaults.letterSpacing,
    italic: style?.italic ?? false,
    underline: style?.underline ?? false,
    textTransform: style?.textTransform ?? defaults.textTransform ?? 'none',
  }

  const fontOptions: SelectOption<HeadingFont | BodyFont>[] = Array.from(
    new Set<HeadingFont | BodyFont>(
      fontKind === 'heading' ? HEADING_FONTS
      : fontKind === 'body' ? BODY_FONTS
      : [...HEADING_FONTS, ...BODY_FONTS],
    ),
  ).map((f) => ({ value: f, label: FONT_LABELS[f], fontFamily: FONT_STACKS[f] }))

  return (
    <div className="flex items-center gap-1">
      {/* Font family */}
      <div className="w-[120px] shrink-0">
        <Select<HeadingFont | BodyFont>
          value={eff.fontFamily}
          options={fontOptions}
          onChange={(v) => onChange({ fontFamily: v })}
          size="xs"
        />
      </div>

      {/* Size */}
      <NumberStepper
        value={eff.fontSize}
        min={10}
        max={96}
        step={1}
        onChange={(v) => onChange({ fontSize: v })}
        ariaLabel="Font size"
      />

      <Divider />

      {/* Weight */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 h-8 rounded-md text-xs hover:bg-gray-100 cursor-pointer text-gray-700 border border-gray-200"
            title="Weight"
          >
            <Type size={12} strokeWidth={1.75} />
            {FONT_WEIGHT_LABELS[eff.fontWeight as FontWeight] ?? 'Reg'}
            <ChevronDown size={10} strokeWidth={2} className="text-gray-400" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="bg-white border border-gray-200 rounded-lg shadow-xl p-1 z-[60] flex"
          >
            {FONT_WEIGHTS.map((w) => (
              <Popover.Close asChild key={w}>
                <button
                  type="button"
                  onClick={() => onChange({ fontWeight: w })}
                  className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                    eff.fontWeight === w ? 'bg-gray-900 text-white' : 'hover:bg-gray-100 text-gray-700'
                  }`}
                  style={{ fontWeight: w }}
                >
                  {FONT_WEIGHT_LABELS[w]}
                </button>
              </Popover.Close>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {expanded && (
        <>
          <Tooltip label="Italic">
            <ToggleButton
              active={eff.italic}
              onClick={() => onChange({ italic: !eff.italic })}
            >
              <Italic size={12} strokeWidth={1.75} />
            </ToggleButton>
          </Tooltip>
          <Tooltip label="Underline">
            <ToggleButton
              active={eff.underline}
              onClick={() => onChange({ underline: !eff.underline })}
            >
              <Underline size={12} strokeWidth={1.75} />
            </ToggleButton>
          </Tooltip>
          <Divider />
        </>
      )}

      {/* Color — Tooltip wraps the whole ColorPopover so the hover label works
          without breaking the trigger's open-onClick. */}
      <Tooltip label="Text colour">
        <ColorPopover
          value={eff.color}
          onChange={(v) => onChange({ color: v })}
          swatches={TEXT_COLOR_PRESETS}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1 px-1.5 h-8 rounded-md hover:bg-gray-100 cursor-pointer border border-gray-200"
            >
              <span
                className="w-4 h-4 rounded ring-1 ring-black/10"
                style={{ background: eff.color }}
              />
            </button>
          }
        />
      </Tooltip>

      {bgSlot}

      <Divider />

      {/* Alignment */}
      <div className="inline-flex items-center bg-gray-50 rounded-md border border-gray-200">
        {(['left', 'center', 'right'] as const).map((a) => (
          <Tooltip key={a} label={`Align ${a}`}>
            <button
              type="button"
              onClick={() => onChange({ align: a })}
              aria-label={`Align ${a}`}
              className={`p-1.5 transition cursor-pointer ${
                eff.align === a ? 'bg-white text-gray-900 shadow-sm rounded-md m-0.5' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {a === 'left' && <AlignLeft size={12} strokeWidth={1.75} />}
              {a === 'center' && <AlignCenter size={12} strokeWidth={1.75} />}
              {a === 'right' && <AlignRight size={12} strokeWidth={1.75} />}
            </button>
          </Tooltip>
        ))}
      </div>

      {expanded && (
        <>
          <Divider />
          <SliderPopover
            label="Line height"
            value={eff.lineHeight}
            min={1}
            max={2.5}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => onChange({ lineHeight: v })}
          />
          <SliderPopover
            label="Letter spacing"
            value={eff.letterSpacing}
            min={-0.05}
            max={0.2}
            step={0.005}
            format={(v) => `${(v * 1000).toFixed(0)}`}
            onChange={(v) => onChange({ letterSpacing: v })}
          />
          <Divider />
          <div className="inline-flex items-center bg-gray-50 rounded-md border border-gray-200">
            {CASE_OPTIONS.map((t) => (
              <Tooltip key={t.id} label={t.tooltip}>
                <button
                  type="button"
                  onClick={() => onChange({ textTransform: t.id })}
                  aria-label={t.tooltip}
                  className={`px-2 py-1 text-xs transition cursor-pointer ${
                    eff.textTransform === t.id
                      ? 'bg-white text-gray-900 shadow-sm rounded-md m-0.5 font-medium'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {t.glyph}
                </button>
              </Tooltip>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Divider() {
  return <span className="w-px h-5 bg-gray-200 mx-0.5" />
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`p-1.5 rounded-md border cursor-pointer ${
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-600 border-gray-200 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  )
}

function NumberStepper({
  value,
  min,
  max,
  step,
  onChange,
  ariaLabel,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  ariaLabel: string
}) {
  return (
    <div className="inline-flex items-center border border-gray-200 rounded-md h-8">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-5 h-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition cursor-pointer text-xs"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
        }}
        aria-label={ariaLabel}
        className="w-8 h-full text-xs text-center bg-transparent text-gray-900 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-5 h-full text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition cursor-pointer text-xs"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  )
}

function SliderPopover({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2 h-8 rounded-md text-xs hover:bg-gray-100 cursor-pointer text-gray-700 border border-gray-200"
          title={label}
        >
          <span className="text-[10px] text-gray-400">{label}</span>
          <span className="font-mono">{format(value)}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="center"
          sideOffset={6}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-[60] w-[220px] animate-modal-in"
        >
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-gray-600">{label}</span>
            <span className="font-mono text-gray-900">{format(value)}</span>
          </div>
          <Slider value={value} min={min} max={max} step={step} onChange={onChange} ariaLabel={label} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
