'use client'

import * as Popover from '@radix-ui/react-popover'
import {
  ChevronDown, Check, RotateCcw, Paintbrush, Type as TypeIcon,
  Layout, Globe,
} from 'lucide-react'
import { useState } from 'react'

import { ColorPopover } from '@/components/ui/color-popover'
import { Tooltip } from '@/components/ui/tooltip'
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
import type { TextCase } from '@/lib/branding/text-case'
import {
  COLOR_PALETTE,
  SURFACE_PALETTE,
  TEXT_PALETTE,
  BORDER_PALETTE,
  type ThemeId,
  type ThemeIdOrCustom,
  type Density,
} from '@/lib/branding/themes'
import type { SurfaceTab } from '@/types/branding-preview'

import { BusinessSection } from './business-section'
import { Slider } from './components/slider'


interface BrandPanelProps {
  themePreset: ThemeIdOrCustom
  applyTheme: (id: ThemeId) => void
  resetToTheme: () => void
  surface: SurfaceTab
  enabledSurfaces: SurfaceTab[]
  onToggleSurface: (surface: SurfaceTab, enabled: boolean) => void
  resetSurfaceToDefault: () => void

  brandColor: string
  setBrandColor: (v: string) => void
  headingColor: string
  setHeadingColor: (v: string) => void
  subheadingColor: string
  setSubheadingColor: (v: string) => void
  surfaceColor: string
  setSurfaceColor: (v: string) => void
  textColor: string
  setTextColor: (v: string) => void
  secondaryColor: string
  setSecondaryColor: (v: string) => void

  fontHeading: HeadingFont
  setFontHeading: (v: HeadingFont) => void
  fontBody: BodyFont
  setFontBody: (v: BodyFont) => void
  fontWeight: FontWeight
  setFontWeight: (v: FontWeight) => void
  fontBodyWeight: FontWeight
  setFontBodyWeight: (v: FontWeight) => void
  headingSize: number
  setHeadingSize: (v: number) => void
  bodySize: number
  setBodySize: (v: number) => void
  headingCase: TextCase
  setHeadingCase: (v: TextCase) => void
  bodyCase: TextCase
  setBodyCase: (v: TextCase) => void
  subheadingSize: number
  setSubheadingSize: (v: number) => void
  subheadingWeight: FontWeight
  setSubheadingWeight: (v: FontWeight) => void
  subheadingCase: TextCase
  setSubheadingCase: (v: TextCase) => void
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

  linkColor: string
  setLinkColor: (v: string) => void
  borderColor: string
  onBorderColorChange: (v: string) => void
  buttonVariant: 'fill' | 'outline'
  setButtonVariant: (v: 'fill' | 'outline') => void
  buttonSize: 'sm' | 'md' | 'lg'
  setButtonSize: (v: 'sm' | 'md' | 'lg') => void
  buttonRadius: number
  setButtonRadius: (v: number) => void
  sectionSpacing: number
  setSectionSpacing: (v: number) => void

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
  twitterUrl: string
  setTwitterUrl: (v: string) => void
  pinterestUrl: string
  setPinterestUrl: (v: string) => void

}

type SectionId = 'business' | 'colors' | 'fonts' | 'globalStyles'

export function BrandPanel(props: BrandPanelProps) {
  // Every section starts collapsed. Landing straight out of onboarding used to
  // open "Your business", which read as clutter on first entry; a fully
  // collapsed rail lets the preview breathe and the MC choose where to start.
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    business: false,
    colors: false,
    fonts: false,
    globalStyles: false,
  })

  const toggle = (id: SectionId) => setOpen((p) => ({ ...p, [id]: !p[id] }))

  return (
    <aside className="w-[320px] border-r border-gray-100 bg-surface overflow-y-auto shrink-0 flex flex-col">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between sticky top-0 bg-surface z-10 border-b border-gray-50">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-text-subtle uppercase tracking-[0.08em]">Brand kit</p>
          <p className="text-body font-medium text-text flex items-center gap-1.5">
            <Globe size={13} strokeWidth={1.75} className="text-text-subtle shrink-0" />
            Applies to every document
          </p>
        </div>
        {props.themePreset === 'custom' && (
          <button
            type="button"
            onClick={props.resetToTheme}
            title="Reset customisations"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-control text-[11px] text-text-muted hover:text-text hover:bg-surface-emphasis cursor-pointer transition"
          >
            <RotateCcw size={10} strokeWidth={1.75} />
            Reset
          </button>
        )}
      </div>

      <div className="pb-12">
        <Accordion
          icon={<Globe size={13} strokeWidth={1.75} className="text-text-muted" />}
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
            twitterUrl={props.twitterUrl}
            setTwitterUrl={props.setTwitterUrl}
            pinterestUrl={props.pinterestUrl}
            setPinterestUrl={props.setPinterestUrl}
            faviconUrl={props.faviconUrl}
            uploadFavicon={props.uploadFavicon}
            removeFavicon={props.removeFavicon}
          />
        </Accordion>

        {/* Choosing which documents you use now sits behind the settings button
            on the tab strip, and Reset layout sits in the canvas scope bar.
            Both are per-document, whereas this rail is the brand kit that
            applies to every document. */}

        <Accordion
          icon={<Paintbrush size={13} strokeWidth={1.75} className="text-text-muted" />}
          title="Brand colours"
          subtitle="Primary, accent, surface…"
          open={open.colors}
          onToggle={() => toggle('colors')}
        >
          <ColorSection {...props} />
        </Accordion>

        <Accordion
          icon={<TypeIcon size={13} strokeWidth={1.75} className="text-text-muted" />}
          title="Typography"
          subtitle="Fonts, weights, scale"
          open={open.fonts}
          onToggle={() => toggle('fonts')}
        >
          <FontSection {...props} />
        </Accordion>

        <Accordion
          icon={<Layout size={13} strokeWidth={1.75} className="text-text-muted" />}
          title="Global styles"
          subtitle="Radius, links, buttons, spacing"
          open={open.globalStyles}
          onToggle={() => toggle('globalStyles')}
        >
          <GlobalStylesSection {...props} />
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
        <span className="w-6 h-6 rounded-control bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-text truncate">{title}</p>
          {subtitle && <p className="text-[11px] text-text-subtle truncate">{subtitle}</p>}
        </div>
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={`text-text-subtle shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 pb-5 pt-1">{children}</div>}
    </div>
  )
}

// ── Colours ───────────────────────────────────────────────────────────────────

function ColorSection({
  brandColor, setBrandColor,
  headingColor, setHeadingColor,
  subheadingColor, setSubheadingColor,
  surfaceColor, setSurfaceColor,
  textColor, setTextColor,
  secondaryColor, setSecondaryColor,
  borderColor, onBorderColorChange,
  linkColor, setLinkColor,
}: BrandPanelProps) {
  return (
    <div className="space-y-3">
      <ColorRow label="Heading" description="Main headings and titles" value={headingColor} onChange={setHeadingColor} swatches={TEXT_PALETTE} />
      <ColorRow label="Subheading" description="Section labels under headings" value={subheadingColor} onChange={setSubheadingColor} swatches={TEXT_PALETTE} />
      <ColorRow label="Body text" description="Paragraph and detail text" value={textColor} onChange={setTextColor} swatches={TEXT_PALETTE} />
      <ColorRow label="Background" description="The page background" value={surfaceColor} onChange={setSurfaceColor} swatches={SURFACE_PALETTE} />
      <ColorRow label="Primary button" description="Accept and Pay buttons" value={brandColor} onChange={setBrandColor} swatches={COLOR_PALETTE} />
      <ColorRow label="Secondary button" description="Decline and supporting buttons" value={secondaryColor} onChange={setSecondaryColor} swatches={COLOR_PALETTE} />
      <ColorRow label="Border" description="Lines, rules and card outlines" value={borderColor} onChange={onBorderColorChange} swatches={BORDER_PALETTE} />
      <ColorRow label="Link" description="Links inside document text" value={linkColor} onChange={setLinkColor} swatches={COLOR_PALETTE} />
      <ContrastWarnings textColor={textColor} surfaceColor={surfaceColor} />
    </div>
  )
}

/**
 * Flags brand colour combinations that would genuinely be hard to read.
 *
 * Only body text against the page background is checked. An earlier version
 * also compared the primary button colour to the background at 4.5:1, which
 * was wrong twice over: 4.5:1 is the WCAG threshold for text, and the button
 * is a fill whose label already picks black or white through getTextColor, so
 * its legibility is never the user's problem to solve. That check fired on
 * perfectly readable buttons and cited a rule that did not apply to them.
 */
function ContrastWarnings({
  textColor,
  surfaceColor,
}: {
  textColor: string
  surfaceColor: string
}) {
  const checks: Array<{ label: string; ratio: number; level: ReturnType<typeof getWcagLevel> }> = [
    {
      label: 'Text on Surface',
      ratio: getContrastRatio(textColor, surfaceColor),
      level: getWcagLevel(textColor, surfaceColor),
    },
  ]
  const fails = checks.filter((c) => c.level === 'fail')
  if (fails.length === 0) return null
  return (
    <div className="rounded-control border border-amber-200 bg-amber-50/60 p-2.5 space-y-1">
      <p className="text-[11px] font-medium text-amber-800">Low contrast</p>
      {fails.map((c) => (
        <p key={c.label} className="text-[11px] text-amber-700">
          {c.label} <span className="font-mono">{c.ratio.toFixed(2)}:1</span>
        </p>
      ))}
      <p className="text-[11px] text-amber-700/80 pt-0.5">Aim for at least 4.5 for body text.</p>
    </div>
  )
}

function ColorRow({
  label,
  description,
  value,
  onChange,
  swatches,
}: {
  label: string
  description: string
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
            className="w-9 h-9 rounded-control ring-1 ring-black/10 cursor-pointer shrink-0 relative overflow-hidden hover:ring-black/20 transition"
            style={{ background: value }}
            aria-label={`${label} colour`}
            title={value}
          />
        }
      />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-text-subtle uppercase tracking-[0.08em]">{label}</p>
        <p className="text-[11px] text-text-muted">{description}</p>
        <p className="text-body font-mono text-gray-700 truncate">{value}</p>
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
  headingSize, setHeadingSize,
  bodySize, setBodySize,
  headingCase, setHeadingCase,
  bodyCase, setBodyCase,
  subheadingSize, setSubheadingSize,
  subheadingWeight, setSubheadingWeight,
  subheadingCase, setSubheadingCase,
  headingLetterSpacing, setHeadingLetterSpacing,
  bodyLineHeight, setBodyLineHeight,
}: BrandPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] text-text-subtle uppercase tracking-[0.08em] mb-2">Heading</p>
        <div className="space-y-2.5">
          <div>
            <p className="text-[11px] text-text-muted mb-1">Font</p>
            <FontPicker role="Heading" value={fontHeading} options={HEADING_FONTS as readonly HeadingFont[]} onChange={setFontHeading} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-text-muted">Size</span>
                <span className="text-[11px] font-mono text-gray-700 tabular-nums">{headingSize}px</span>
              </div>
              <Slider value={headingSize} min={16} max={64} step={1} onChange={setHeadingSize} ariaLabel="Heading size" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-text-muted">Letter sp.</span>
                <span className="text-[11px] font-mono text-gray-700 tabular-nums">{headingLetterSpacing.toFixed(2)}</span>
              </div>
              <Slider value={headingLetterSpacing} min={-0.05} max={0.1} step={0.01} onChange={setHeadingLetterSpacing} ariaLabel="Heading letter spacing" />
            </div>
          </div>
          <WeightPills label="Weight" value={fontWeight} onChange={setFontWeight} compact />
          <CasePills label="Case" value={headingCase} onChange={setHeadingCase} />
        </div>
      </div>

      <div>
        <p className="text-[11px] text-text-subtle uppercase tracking-[0.08em] mb-2">Subheading</p>
        {/* The small labels across every document: invoice "Ref"/"Expires",
            "Account name"/"BSB"/"Account number", and the like. Sits between
            heading and body because that is its visual weight. Colour is set in
            Brand colours (Subheading); size, weight and case live here. */}
        <p className="text-[11px] text-text-muted mb-2 leading-snug">Labels like Ref, Expires and bank details. Colour is under Brand colours.</p>
        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-text-muted">Size</span>
              <span className="text-[11px] font-mono text-gray-700 tabular-nums">{subheadingSize}px</span>
            </div>
            <Slider value={subheadingSize} min={8} max={24} step={1} onChange={setSubheadingSize} ariaLabel="Subheading size" />
          </div>
          <WeightPills label="Weight" value={subheadingWeight} onChange={setSubheadingWeight} compact />
          <CasePills label="Case" value={subheadingCase} onChange={setSubheadingCase} />
        </div>
      </div>

      <div>
        <p className="text-[11px] text-text-subtle uppercase tracking-[0.08em] mb-2">Body</p>
        <div className="space-y-2.5">
          <div>
            <p className="text-[11px] text-text-muted mb-1">Font</p>
            <FontPicker role="Body" value={fontBody} options={BODY_FONTS as readonly BodyFont[]} onChange={setFontBody} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-text-muted">Size</span>
                <span className="text-[11px] font-mono text-gray-700 tabular-nums">{bodySize}px</span>
              </div>
              <Slider value={bodySize} min={12} max={24} step={1} onChange={setBodySize} ariaLabel="Body size" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-text-muted">Line ht.</span>
                <span className="text-[11px] font-mono text-gray-700 tabular-nums">{bodyLineHeight.toFixed(2)}</span>
              </div>
              <Slider value={bodyLineHeight} min={1.2} max={2} step={0.05} onChange={setBodyLineHeight} ariaLabel="Body line height" />
            </div>
          </div>
          <WeightPills label="Weight" value={fontBodyWeight} onChange={setFontBodyWeight} compact />
          <CasePills label="Case" value={bodyCase} onChange={setBodyCase} />
        </div>
      </div>

    </div>
  )
}

function WeightPills({ label, value, onChange, compact }: { label: string; value: FontWeight; onChange: (v: FontWeight) => void; compact?: boolean }) {
  return (
    <div>
      <p className={`mb-1 ${compact ? 'text-[11px] text-text-muted' : 'text-[11px] text-text-subtle'}`}>{label}</p>
      <div className="inline-flex bg-surface-emphasis rounded-control p-0.5 w-full">
        {FONT_WEIGHTS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChange(w)}
            className={`flex-1 px-2 py-1 text-[11px] rounded-control transition cursor-pointer ${
              value === w ? 'bg-surface text-text shadow-sm font-medium' : 'text-text-muted hover:text-gray-700'
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

function CasePills({ label, value, onChange }: { label: string; value: TextCase; onChange: (v: TextCase) => void }) {
  // Glyph previews double as the behaviour: "Aa" = sentence case (first letter
  // only), "Ab" = every word, "AA"/"aa" = upper/lower. The tooltip spells each
  // one out. There's no "As typed" pill any more: sentence case took the "Aa"
  // slot because that is what MCs reach for, and a stored 'none' just shows no
  // active pill (harmless) until the MC picks one.
  const cases: Array<{ id: TextCase; label: string; preview: string }> = [
    { id: 'sentence', label: 'Capitalise first letter', preview: 'Aa' },
    { id: 'capitalize', label: 'Capitalise each word', preview: 'Ab' },
    { id: 'uppercase', label: 'Uppercase', preview: 'AA' },
    { id: 'lowercase', label: 'Lowercase', preview: 'aa' },
  ]
  return (
    <div>
      <p className="text-[11px] text-text-muted mb-1">{label}</p>
      <div className="inline-flex bg-surface-emphasis rounded-control p-0.5 w-full">
        {cases.map((c) => (
          // Shared Tooltip rather than the native `title` attribute: title
          // tooltips are slow to appear and fire inconsistently. This one shows
          // instantly on hover/focus. flex-1 on the wrapper keeps pills equal.
          <Tooltip key={c.id} label={c.label} className="flex-1">
            <button
              type="button"
              onClick={() => onChange(c.id)}
              aria-label={c.label}
              className={`w-full px-2 py-1 text-[11px] rounded-control transition cursor-pointer ${
                value === c.id ? 'bg-surface text-text shadow-sm font-medium' : 'text-text-muted hover:text-gray-700'
              }`}
            >
              {c.preview}
            </button>
          </Tooltip>
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
          aria-label={`${role} font`}
          className="w-full flex items-center gap-2 border border-border rounded-control px-2.5 py-1.5 bg-surface text-left hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-border-strong cursor-pointer transition"
        >
          {/* No role badge here. The group heading directly above already says
              HEADING or BODY, so repeating it inside the control was noise. */}
          <span className="flex-1 min-w-0 truncate text-[12px] text-text" style={{ fontFamily: FONT_STACKS[value] }}>
            {FONT_LABELS[value]}
          </span>
          <ChevronDown size={12} strokeWidth={2} className="text-text-subtle shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="bg-surface border border-border rounded-control shadow-xl p-1 z-[60] animate-modal-in"
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
                className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-control text-[12px] hover:bg-gray-50 cursor-pointer ${
                  active ? 'text-text' : 'text-gray-700'
                }`}
                style={{ fontFamily: FONT_STACKS[opt] }}
              >
                <span className="flex-1 text-left truncate">{FONT_LABELS[opt]}</span>
                {active && <Check size={12} strokeWidth={2.5} className="text-text shrink-0" />}
              </button>
            )
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ── Global Styles ────────────────────────────────────────────────────────────

function GlobalStylesSection({
  cornerRadius,
  setCornerRadius,
  docPadding,
  setDocPadding,
  buttonVariant,
  setButtonVariant,
  buttonSize,
  setButtonSize,
  buttonRadius,
  setButtonRadius,
}: BrandPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-text-muted">Corner radius</span>
          <span className="text-[11px] font-mono text-gray-700 tabular-nums">{cornerRadius}px</span>
        </div>
        <Slider value={cornerRadius} min={0} max={24} step={1} onChange={setCornerRadius} ariaLabel="Corner radius" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-text-muted">Document padding</span>
          <span className="text-[11px] font-mono text-gray-700 tabular-nums">{docPadding}px</span>
        </div>
        <Slider value={docPadding} min={0} max={48} step={1} onChange={setDocPadding} ariaLabel="Document padding" />
      </div>

      <div>
        <p className="text-[11px] text-text-subtle uppercase tracking-[0.08em] mb-2">Button style</p>
        <div className="space-y-2">
          <div>
            <p className="text-[11px] text-text-muted mb-1">Variant</p>
            <div className="inline-flex bg-surface-emphasis rounded-control p-0.5 w-full">
              {(['fill', 'outline'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setButtonVariant(v)}
                  className={`flex-1 px-2 py-1 text-[11px] rounded-control transition cursor-pointer ${
                    buttonVariant === v ? 'bg-surface text-text shadow-sm font-medium' : 'text-text-muted hover:text-gray-700'
                  }`}
                >
                  {v === 'fill' ? 'Filled' : 'Outline'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-text-muted mb-1">Size</p>
            <div className="inline-flex bg-surface-emphasis rounded-control p-0.5 w-full">
              {(['sm', 'md', 'lg'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setButtonSize(s)}
                  className={`flex-1 px-2 py-1 text-[11px] rounded-control transition cursor-pointer ${
                    buttonSize === s ? 'bg-surface text-text shadow-sm font-medium' : 'text-text-muted hover:text-gray-700'
                  }`}
                >
                  {s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-text-muted">Radius</span>
              <span className="text-[11px] font-mono text-gray-700 tabular-nums">{buttonRadius}px</span>
            </div>
            <Slider value={buttonRadius} min={0} max={16} step={1} onChange={setButtonRadius} ariaLabel="Button radius" />
          </div>
        </div>
      </div>

      {/* Section spacing is not offered here. Nothing reads it: blocks take
          their vertical rhythm from per-block padding and their own internal
          margins, and there is no container gap for the value to drive. It
          stays in the data layer, dormant, exactly as font_scale does, rather
          than being wired now, which would add spacing on top of existing
          padding and shift the layout of every document already sent. */}
    </div>
  )
}



