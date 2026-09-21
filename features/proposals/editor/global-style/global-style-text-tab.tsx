'use client'

/**
 * The Global style popover's Text tab: pick one of the four theme roles
 * (Heading 1/2/3, Paragraph), then set its font, size, weight, colour,
 * case, letter spacing, line height and alignment. A live sample line at
 * the top renders the chosen role through the same `themeRoleCss` the
 * page uses, so what the MC sees here is what the couple gets. Every
 * control dispatches a `setTheme` patch for that one role.
 *
 * @module features/proposals/editor/global-style/global-style-text-tab
 */
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import { useState } from 'react'

import { NumberStepper, PillToggle, Select, type SelectOption } from '@/components/editor'
import { ColorPopover } from '@/components/ui/color-popover'
import { FONT_LABELS, FONT_STACKS, FONT_WEIGHT_LABELS, FONT_WEIGHTS, type FontId, type FontWeight } from '@/lib/branding/fonts'
import type { TextCase } from '@/lib/branding/text-case'

import {
  THEME_TEXT_ROLE_LABELS, THEME_TEXT_ROLES, themeRoleCss, type ProposalTheme, type ThemeTextRole, type ThemeTextStyle,
} from '../../model/theme'
import type { ThemePatch } from '../state'

import { GlobalStyleField, SwatchTrigger } from './global-style-field'

const ROLE_OPTIONS: SelectOption<ThemeTextRole>[] = THEME_TEXT_ROLES.map((r) => ({ value: r, label: THEME_TEXT_ROLE_LABELS[r] }))
const FONT_OPTIONS: SelectOption<FontId>[] = (Object.keys(FONT_STACKS) as FontId[]).map((id) => ({ value: id, label: FONT_LABELS[id] }))
const WEIGHT_OPTIONS: SelectOption<string>[] = FONT_WEIGHTS.map((w) => ({ value: String(w), label: FONT_WEIGHT_LABELS[w] }))
const CASE_OPTIONS: SelectOption<TextCase>[] = [
  { value: 'none', label: 'As typed' },
  { value: 'sentence', label: 'Sentence case' },
  { value: 'capitalize', label: 'Title Case' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
]

/** Props for {@link GlobalStyleTextTab}. */
export interface GlobalStyleTextTabProps {
  theme: ProposalTheme
  onPatch: (patch: ThemePatch) => void
  /** Brand swatches for the colour picker. */
  swatches: readonly string[]
}

/** The Text tab. See the module doc. */
export function GlobalStyleTextTab({ theme, onPatch, swatches }: GlobalStyleTextTabProps) {
  const [role, setRole] = useState<ThemeTextRole>('heading1')
  const style = theme.text[role]
  const patch = (fields: Partial<ThemeTextStyle>) => onPatch({ text: { [role]: fields } })

  return (
    <div>
      <div className="pb-2">
        <Select<ThemeTextRole> size="xs" value={role} options={ROLE_OPTIONS} onChange={setRole} />
      </div>

      {/* The preview: the role at its real size, clipped to one line so a
          160px Heading 1 never pushes the controls off screen. */}
      <div className="mb-2 overflow-hidden rounded-control border border-border px-3 py-2" style={{ background: theme.background }}>
        <p className="m-0 truncate" style={{ ...themeRoleCss(theme, role), fontSize: `${Math.min(style.size, 40)}px` }}>
          {THEME_TEXT_ROLE_LABELS[role]}
        </p>
      </div>

      <GlobalStyleField label="Font">
        <div className="w-44">
          <Select<FontId>
            size="xs"
            value={style.font}
            options={FONT_OPTIONS}
            renderLabel={(o) => <span style={{ fontFamily: FONT_STACKS[o.value] }}>{o.label}</span>}
            onChange={(font) => patch({ font })}
          />
        </div>
      </GlobalStyleField>
      <GlobalStyleField label="Size">
        <NumberStepper value={style.size} min={9} max={160} step={1} suffix="px" ariaLabel="Font size" onChange={(size) => patch({ size })} />
      </GlobalStyleField>
      <GlobalStyleField label="Weight">
        <div className="w-32">
          <Select<string>
            size="xs"
            value={String(style.weight)}
            options={WEIGHT_OPTIONS}
            onChange={(w) => patch({ weight: Number(w) as FontWeight })}
          />
        </div>
      </GlobalStyleField>
      <GlobalStyleField label="Colour">
        <ColorPopover
          value={style.color}
          onChange={(color) => patch({ color })}
          swatches={swatches}
          trigger={<SwatchTrigger color={style.color} label={`${THEME_TEXT_ROLE_LABELS[role]} colour`} />}
        />
      </GlobalStyleField>
      <GlobalStyleField label="Case">
        <div className="w-36">
          <Select<TextCase> size="xs" value={style.case} options={CASE_OPTIONS} onChange={(c) => patch({ case: c })} />
        </div>
      </GlobalStyleField>
      <GlobalStyleField label="Letter spacing">
        <NumberStepper
          value={Math.round(style.letterSpacing * 1000) / 1000}
          min={-0.05}
          max={0.3}
          step={0.01}
          suffix="em"
          ariaLabel="Letter spacing"
          onChange={(v) => patch({ letterSpacing: Math.round(v * 1000) / 1000 })}
        />
      </GlobalStyleField>
      <GlobalStyleField label="Line height">
        <NumberStepper
          value={Math.round(style.lineHeight * 100) / 100}
          min={0.8}
          max={3}
          step={0.1}
          ariaLabel="Line height"
          onChange={(v) => patch({ lineHeight: Math.round(v * 100) / 100 })}
        />
      </GlobalStyleField>
      <GlobalStyleField label="Alignment">
        <PillToggle<ThemeTextStyle['align']>
          value={style.align}
          onChange={(align) => patch({ align })}
          options={[
            { value: 'left', label: 'Align left', icon: <AlignLeft size={12} strokeWidth={1.5} /> },
            { value: 'center', label: 'Align center', icon: <AlignCenter size={12} strokeWidth={1.5} /> },
            { value: 'right', label: 'Align right', icon: <AlignRight size={12} strokeWidth={1.5} /> },
          ]}
        />
      </GlobalStyleField>
    </div>
  )
}
