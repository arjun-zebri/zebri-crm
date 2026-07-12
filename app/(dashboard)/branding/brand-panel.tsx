'use client'

import * as Popover from '@radix-ui/react-popover'
import {
  ChevronDown, Check, RotateCcw, Paintbrush, Type as TypeIcon,
  Layout, Sparkles, Globe, LayoutTemplate,
} from 'lucide-react'
import { useState } from 'react'

import { ColorPopover } from '@/components/ui/color-popover'
import { getContrastRatio, getWcagLevel } from '@/lib/branding/contrast'
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
import {
  THEME_PRESETS,
  DEFAULT_THEME,
  THEME_IDS,
  COLOR_PALETTE,
  ACCENT_PALETTE,
  SURFACE_PALETTE,
  TEXT_PALETTE,
  MUTED_PALETTE,
  type ThemeId,
  type ThemeIdOrCustom,
  type Density,
} from '@/lib/branding/themes'

import { BusinessSection } from './business-section'
import { Slider } from './components/slider'
import { STARTER_DESIGNS } from './starter-designs'


interface BrandPanelProps {
  themePreset: ThemeIdOrCustom
  applyTheme: (id: ThemeId) => void
  applyStarterDesign: (id: string) => void
  resetToTheme: () => void

  brandColor: string
  setBrandColor: (v: string) => void
  accentColor: string
  setAccentColor: (v: string) => void
  surfaceColor: string
  setSurfaceColor: (v: string) => void
  textColor: string
  setTextColor: (v: string) => void
  mutedColor: string
  setMutedColor: (v: string) => void
  secondaryColor: string
  setSecondaryColor: (v: string) => void
  secondaryTextColor: string
  setSecondaryTextColor: (v: string) => void

  fontHeading: HeadingFont
  setFontHeading: (v: HeadingFont) => void
  fontBody: BodyFont
  setFontBody: (v: BodyFont) => void
  fontWeight: FontWeight
  setFontWeight: (v: FontWeight) => void
  fontBodyWeight: FontWeight
  setFontBodyWeight: (v: FontWeight) => void
  fontScale: number
  setFontScale: (v: number) => void
  headingSize: number
  setHeadingSize: (v: number) => void
  bodySize: number
  setBodySize: (v: number) => void
  headingCase: 'none' | 'uppercase' | 'capitalize'
  setHeadingCase: (v: 'none' | 'uppercase' | 'capitalize') => void
  bodyCase: 'none' | 'uppercase' | 'capitalize'
  setBodyCase: (v: 'none' | 'uppercase' | 'capitalize') => void
  headingLetterSpacing: number
  setHeadingLetterSpacing: (v: number) => void
  bodyLineHeight: number
  setBodyLineHeight: (v: number) => void

  density: Density
  setDensity: (v: Density) => void
  cornerRadius: number
  setCornerRadius: (v: number) => void
  docPadding: number
  setDocPadding: (v: number) => void

  faviconUrl: string
  uploadFavicon: (file: File) => Promise<void>
  removeFavicon: () => void

  // Business info - promoted to the top of the rail
  businessName: string
  setBusinessName: (v: string) => void
  tagline: string
  setTagline: (v: string) => void
  abn: string
  setAbn: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  website: string
  setWebsite: (v: string) => void
  instagramUrl: string
  setInstagramUrl: (v: string) => void
  facebookUrl: string
  setFacebookUrl: (v: string) => void

}

type SectionId = 'business' | 'starters' | 'themes' | 'colors' | 'fonts' | 'layout'

export function BrandPanel(props: BrandPanelProps) {
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    business: true,
    starters: false,
    themes: false,
    colors: false,
    fonts: false,
    layout: false,
  })

  const toggle = (id: SectionId) => setOpen((p) => ({ ...p, [id]: !p[id] }))

  return (
    <aside className="w-[320px] border-r border-gray-100 bg-white overflow-y-auto shrink-0 flex flex-col">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between sticky top-0 bg-white z-10 border-b border-gray-50">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-[0.08em]">Brand kit</p>
          <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
            <Globe size={13} strokeWidth={1.75} className="text-gray-400 shrink-0" />
            Applies to every document
          </p>
        </div>
        {props.themePreset === 'custom' && (
          <button
            type="button"
            onClick={props.resetToTheme}
            title="Reset customisations"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer transition"
          >
            <RotateCcw size={10} strokeWidth={1.75} />
            Reset
          </button>
        )}
      </div>

      <div className="pb-12">
        <Accordion
          icon={<Globe size={13} strokeWidth={1.75} className="text-gray-500" />}
          title="Your business"
          subtitle="Name, phone, social links, favicon"
          open={open.business}
          onToggle={() => toggle('business')}
        >
          <BusinessSection
            businessName={props.businessName}
            setBusinessName={props.setBusinessName}
            tagline={props.tagline}
            setTagline={props.setTagline}
            abn={props.abn}
            setAbn={props.setAbn}
            phone={props.phone}
            setPhone={props.setPhone}
            website={props.website}
            setWebsite={props.setWebsite}
            instagramUrl={props.instagramUrl}
            setInstagramUrl={props.setInstagramUrl}
            facebookUrl={props.facebookUrl}
            setFacebookUrl={props.setFacebookUrl}
            faviconUrl={props.faviconUrl}
            uploadFavicon={props.uploadFavicon}
            removeFavicon={props.removeFavicon}
          />
        </Accordion>

        <Accordion
          icon={<LayoutTemplate size={13} strokeWidth={1.75} className="text-gray-500" />}
          title="Starter designs"
          subtitle="Colours, fonts + a ready layout"
          open={open.starters}
          onToggle={() => toggle('starters')}
        >
          <StarterSection {...props} />
        </Accordion>

        <Accordion
          icon={<Sparkles size={13} strokeWidth={1.75} className="text-gray-500" />}
          title="Themes"
          subtitle="Colours & fonts only"
          open={open.themes}
          onToggle={() => toggle('themes')}
        >
          <ThemeSection {...props} />
        </Accordion>

        <Accordion
          icon={<Paintbrush size={13} strokeWidth={1.75} className="text-gray-500" />}
          title="Brand colours"
          subtitle="Primary, accent, surface…"
          open={open.colors}
          onToggle={() => toggle('colors')}
        >
          <ColorSection {...props} />
        </Accordion>

        <Accordion
          icon={<TypeIcon size={13} strokeWidth={1.75} className="text-gray-500" />}
          title="Typography"
          subtitle="Fonts, weights, scale"
          open={open.fonts}
          onToggle={() => toggle('fonts')}
        >
          <FontSection {...props} />
        </Accordion>

        <Accordion
          icon={<Layout size={13} strokeWidth={1.75} className="text-gray-500" />}
          title="Layout"
          subtitle="Density and corners"
          open={open.layout}
          onToggle={() => toggle('layout')}
        >
          <LayoutSection {...props} />
        </Accordion>
      </div>
    </aside>
  )
}

function Accordion({
  icon,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-gray-50">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50/60 transition cursor-pointer"
      >
        <span className="w-6 h-6 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-gray-900 truncate">{title}</p>
          {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
        </div>
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 pb-5 pt-1">{children}</div>}
    </div>
  )
}

// ── Starter designs ─────────────────────────────────────────────────────────

function StarterSection({ applyStarterDesign }: BrandPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {STARTER_DESIGNS.map((d) => {
        const p = THEME_PRESETS[d.theme] ?? DEFAULT_THEME
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => applyStarterDesign(d.id)}
            className="relative rounded-xl border border-gray-200 hover:border-gray-300 overflow-hidden text-left transition cursor-pointer"
            style={{ background: p.surface }}
            title={`Apply ${d.name}`}
          >
            <div className="p-3 min-h-[92px] flex flex-col gap-1.5">
              <p
                className="text-[13px] leading-tight"
                style={{ fontFamily: FONT_STACKS[p.headingFont], fontWeight: p.headingWeight, color: p.text }}
              >
                {d.name}
              </p>
              <p className="text-[10px] leading-snug" style={{ color: p.muted }}>
                {d.description}
              </p>
              <div className="flex items-center gap-0.5 mt-auto">
                <span className="w-3 h-3 rounded-full ring-1 ring-black/5" style={{ background: p.color }} />
                <span className="w-3 h-3 rounded-full ring-1 ring-black/5" style={{ background: p.accent }} />
                <span className="w-3 h-3 rounded-full ring-1 ring-black/5" style={{ background: p.surface }} />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Themes ────────────────────────────────────────────────────────────────────

function ThemeSection({ themePreset, applyTheme }: BrandPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {THEME_IDS.map((id) => {
        const preset = THEME_PRESETS[id]
        const active = themePreset === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => applyTheme(id)}
            className={`relative rounded-xl border overflow-hidden text-left transition cursor-pointer ${
              active ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'
            }`}
            style={{ background: preset.surface }}
            title={preset.name}
          >
            <div className="p-3 pb-2 min-h-[96px] flex flex-col gap-1.5">
              <div
                className="h-1 w-8 rounded-full"
                style={{ background: preset.color }}
              />
              <p
                className="text-[14px] leading-tight"
                style={{
                  fontFamily: FONT_STACKS[preset.headingFont],
                  fontWeight: preset.headingWeight,
                  color: preset.text,
                  letterSpacing: -0.005,
                }}
              >
                Aa
              </p>
              <p
                className="text-[10px] leading-tight"
                style={{ fontFamily: FONT_STACKS[preset.bodyFont], color: preset.muted }}
              >
                {preset.name}
              </p>
              <div className="flex items-center gap-0.5 mt-auto">
                <span className="w-3 h-3 rounded-full ring-1 ring-black/5" style={{ background: preset.color }} />
                <span className="w-3 h-3 rounded-full ring-1 ring-black/5" style={{ background: preset.accent }} />
                <span className="w-3 h-3 rounded-full ring-1 ring-black/5" style={{ background: preset.surface }} />
              </div>
            </div>
            {active && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-gray-900 text-white flex items-center justify-center">
                <Check size={10} strokeWidth={2.5} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Colours ───────────────────────────────────────────────────────────────────

function ColorSection({
  brandColor, setBrandColor,
  accentColor, setAccentColor,
  surfaceColor, setSurfaceColor,
  textColor, setTextColor,
  mutedColor, setMutedColor,
  secondaryColor, setSecondaryColor,
  secondaryTextColor, setSecondaryTextColor,
}: BrandPanelProps) {
  return (
    <div className="space-y-3">
      <ColorRow label="Primary"  value={brandColor}   onChange={setBrandColor}   swatches={COLOR_PALETTE} />
      <ColorRow label="Accent"   value={accentColor}  onChange={setAccentColor}  swatches={ACCENT_PALETTE} />
      <ColorRow label="Surface"  value={surfaceColor} onChange={setSurfaceColor} swatches={SURFACE_PALETTE} />
      <ColorRow label="Text"     value={textColor}    onChange={setTextColor}    swatches={TEXT_PALETTE} />
      <ColorRow label="Muted"    value={mutedColor}   onChange={setMutedColor}   swatches={MUTED_PALETTE} />
      <ColorRow label="Secondary"      value={secondaryColor}     onChange={setSecondaryColor}     swatches={COLOR_PALETTE} />
      <ColorRow label="Secondary text" value={secondaryTextColor} onChange={setSecondaryTextColor} swatches={TEXT_PALETTE} />
      <ContrastWarnings
        textColor={textColor}
        mutedColor={mutedColor}
        surfaceColor={surfaceColor}
        brandColor={brandColor}
      />
    </div>
  )
}

function ContrastWarnings({
  textColor,
  mutedColor,
  surfaceColor,
  brandColor,
}: {
  textColor: string
  mutedColor: string
  surfaceColor: string
  brandColor: string
}) {
  const checks: Array<{ label: string; ratio: number; level: ReturnType<typeof getWcagLevel> }> = [
    {
      label: 'Text on Surface',
      ratio: getContrastRatio(textColor, surfaceColor),
      level: getWcagLevel(textColor, surfaceColor),
    },
    {
      label: 'Muted on Surface',
      ratio: getContrastRatio(mutedColor, surfaceColor),
      level: getWcagLevel(mutedColor, surfaceColor),
    },
    {
      label: 'Primary on Surface',
      ratio: getContrastRatio(brandColor, surfaceColor),
      level: getWcagLevel(brandColor, surfaceColor),
    },
  ]
  const fails = checks.filter((c) => c.level === 'fail')
  if (fails.length === 0) return null
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 space-y-1">
      <p className="text-[11px] font-medium text-amber-800">Low contrast</p>
      {fails.map((c) => (
        <p key={c.label} className="text-[11px] text-amber-700">
          {c.label} <span className="font-mono">{c.ratio.toFixed(2)}:1</span>
        </p>
      ))}
      <p className="text-[10px] text-amber-700/80 pt-0.5">Aim for at least 4.5 for body text.</p>
    </div>
  )
}

function ColorRow({
  label,
  value,
  onChange,
  swatches,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  swatches: readonly string[]
}) {
  return (
    <div className="flex items-center gap-2">
      <ColorPopover
        value={value}
        onChange={onChange}
        swatches={swatches}
        trigger={
          <button
            type="button"
            className="w-9 h-9 rounded-lg ring-1 ring-black/10 cursor-pointer shrink-0 relative overflow-hidden hover:ring-black/20 transition"
            style={{ background: value }}
            aria-label={`${label} colour`}
            title={value}
          />
        }
      />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">{label}</p>
        <p className="text-xs font-mono text-gray-700 truncate">{value}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {swatches.slice(0, 4).map((c) => {
          const active = value.toLowerCase() === c.toLowerCase()
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              title={c}
              className={`w-4 h-4 rounded-full ring-1 transition cursor-pointer hover:scale-110 ${
                active ? 'ring-gray-900 ring-2' : 'ring-black/10'
              }`}
              style={{ background: c }}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Fonts ─────────────────────────────────────────────────────────────────────

function FontSection({
  fontHeading, setFontHeading,
  fontBody, setFontBody,
  fontWeight, setFontWeight,
  fontBodyWeight, setFontBodyWeight,
  fontScale, setFontScale,
  headingSize, setHeadingSize,
  bodySize, setBodySize,
  headingCase, setHeadingCase,
  bodyCase, setBodyCase,
  headingLetterSpacing, setHeadingLetterSpacing,
  bodyLineHeight, setBodyLineHeight,
}: BrandPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] text-gray-400 uppercase tracking-[0.08em] mb-2">Heading</p>
        <div className="space-y-2.5">
          <div>
            <p className="text-[10px] text-gray-500 mb-1.5">Font</p>
            <FontPicker role="Heading" value={fontHeading} options={HEADING_FONTS as readonly HeadingFont[]} onChange={setFontHeading} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">Size</span>
                <span className="text-[9px] font-mono text-gray-700">{headingSize}px</span>
              </div>
              <Slider value={headingSize} min={16} max={64} step={1} onChange={setHeadingSize} ariaLabel="Heading size" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">Letter sp.</span>
                <span className="text-[9px] font-mono text-gray-700">{headingLetterSpacing.toFixed(2)}</span>
              </div>
              <Slider value={headingLetterSpacing} min={-0.05} max={0.1} step={0.01} onChange={setHeadingLetterSpacing} ariaLabel="Heading letter spacing" />
            </div>
          </div>
          <WeightPills label="Weight" value={fontWeight} onChange={setFontWeight} compact />
          <CasePills label="Case" value={headingCase} onChange={setHeadingCase} />
        </div>
      </div>

      <div>
        <p className="text-[11px] text-gray-400 uppercase tracking-[0.08em] mb-2">Body</p>
        <div className="space-y-2.5">
          <div>
            <p className="text-[10px] text-gray-500 mb-1.5">Font</p>
            <FontPicker role="Body" value={fontBody} options={BODY_FONTS as readonly BodyFont[]} onChange={setFontBody} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">Size</span>
                <span className="text-[9px] font-mono text-gray-700">{bodySize}px</span>
              </div>
              <Slider value={bodySize} min={12} max={24} step={1} onChange={setBodySize} ariaLabel="Body size" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">Line ht.</span>
                <span className="text-[9px] font-mono text-gray-700">{bodyLineHeight.toFixed(2)}</span>
              </div>
              <Slider value={bodyLineHeight} min={1.2} max={2} step={0.05} onChange={setBodyLineHeight} ariaLabel="Body line height" />
            </div>
          </div>
          <WeightPills label="Weight" value={fontBodyWeight} onChange={setFontBodyWeight} compact />
          <CasePills label="Case" value={bodyCase} onChange={setBodyCase} />
        </div>
      </div>

      <div className="pt-1 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Overall scale</span>
          <span className="text-xs font-mono text-gray-700 tabular-nums">{Math.round(fontScale * 100)}%</span>
        </div>
        <Slider value={fontScale} min={0.85} max={1.2} step={0.01} onChange={setFontScale} ariaLabel="Font scale" />
        <p className="text-[10px] text-gray-400 mt-1">Multiplies all text sizes on every document.</p>
      </div>
    </div>
  )
}

function WeightPills({ label, value, onChange, compact }: { label: string; value: FontWeight; onChange: (v: FontWeight) => void; compact?: boolean }) {
  return (
    <div>
      <p className={`mb-1 uppercase tracking-[0.08em] ${compact ? 'text-[10px] text-gray-500' : 'text-[11px] text-gray-400'}`}>{label}</p>
      <div className="inline-flex bg-gray-100 rounded-lg p-0.5 w-full">
        {FONT_WEIGHTS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChange(w)}
            className={`flex-1 px-2 py-1.5 text-xs rounded-md transition cursor-pointer ${
              value === w ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}
            style={{ fontWeight: w }}
          >
            {FONT_WEIGHT_LABELS[w]}
          </button>
        ))}
      </div>
    </div>
  )
}

function CasePills({ label, value, onChange }: { label: string; value: 'none' | 'uppercase' | 'capitalize'; onChange: (v: 'none' | 'uppercase' | 'capitalize') => void }) {
  const cases: Array<{ id: 'none' | 'uppercase' | 'capitalize'; label: string; preview: string }> = [
    { id: 'none', label: 'None', preview: 'Aa' },
    { id: 'uppercase', label: 'Uppercase', preview: 'AA' },
    { id: 'capitalize', label: 'Capitalize', preview: 'Aa' },
  ]
  return (
    <div>
      <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-[0.08em]">{label}</p>
      <div className="inline-flex bg-gray-100 rounded-lg p-0.5 w-full">
        {cases.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={`flex-1 px-2 py-1.5 text-xs rounded-md transition cursor-pointer ${
              value === c.id ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}
            title={c.label}
          >
            {c.preview}
          </button>
        ))}
      </div>
    </div>
  )
}

function FontPicker<V extends HeadingFont | BodyFont>({
  role,
  value,
  options,
  onChange,
}: {
  role: string
  value: V
  options: readonly V[]
  onChange: (v: V) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white text-left hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 cursor-pointer transition"
        >
          <span className="flex-1 min-w-0 truncate text-[14px] text-gray-900" style={{ fontFamily: FONT_STACKS[value] }}>
            {FONT_LABELS[value]}
          </span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-gray-400 shrink-0">{role}</span>
          <ChevronDown size={12} strokeWidth={2} className="text-gray-400 shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="bg-white border border-gray-200 rounded-xl shadow-xl p-1 z-[60] animate-modal-in"
          style={{
            minWidth: 'var(--radix-popover-trigger-width)',
            maxHeight: 'min(360px, var(--radix-popover-content-available-height))',
            overflowY: 'auto',
          }}
        >
          {options.map((opt) => {
            const active = opt === value
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt)
                  setOpen(false)
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-[14px] hover:bg-gray-50 cursor-pointer ${
                  active ? 'text-gray-900' : 'text-gray-700'
                }`}
                style={{ fontFamily: FONT_STACKS[opt] }}
              >
                <span className="flex-1 text-left truncate">{FONT_LABELS[opt]}</span>
                {active && <Check size={12} strokeWidth={2.5} className="text-gray-900 shrink-0" />}
              </button>
            )
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

function LayoutSection({
  density,
  setDensity,
  cornerRadius,
  setCornerRadius,
  docPadding,
  setDocPadding,
}: BrandPanelProps) {
  const densities: { id: Density; label: string }[] = [
    { id: 'compact', label: 'Compact' },
    { id: 'cozy',    label: 'Cozy' },
    { id: 'roomy',   label: 'Roomy' },
  ]
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] text-gray-400 uppercase tracking-[0.08em] mb-1.5">Density</p>
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5 w-full">
          {densities.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDensity(d.id)}
              className={`flex-1 px-2 py-1.5 text-xs rounded-md transition cursor-pointer ${
                density === d.id ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Padding</span>
          <span className="text-xs font-mono text-gray-700 tabular-nums">{docPadding}px</span>
        </div>
        <Slider value={docPadding} min={0} max={48} step={1} onChange={setDocPadding} ariaLabel="Document padding" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">Corner radius</span>
          <span className="text-xs font-mono text-gray-700 tabular-nums">{cornerRadius}px</span>
        </div>
        <Slider value={cornerRadius} min={0} max={24} step={1} onChange={setCornerRadius} ariaLabel="Corner radius" />
      </div>
    </div>
  )
}



