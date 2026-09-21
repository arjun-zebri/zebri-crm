'use client'

/**
 * The "..." overflow's Typography section (Qwilr-parity pass): font
 * weight, line height, letter spacing and top spacing for the current
 * selection, alongside the overflow's existing list toggles and `Aa`
 * case choices (`text-bar-overflow.tsx`, which renders this between
 * them). Split out to keep that file near the ~150-line guideline once
 * this section landed.
 *
 * Every stepper seeds its displayed value from the *current effective*
 * style when no override is set yet - `theme.text[role]` (`StyleValue`
 * and `ThemeTextRole` share the same four values), the same theme
 * resolver `editor-styles.ts`'s `docTypeVars` uses to paint the canvas -
 * rather than a fixed neutral number. Seeding from a generic default
 * (line-height `1`, say) would make the first nudge on a heading (whose
 * theme default might be `1.15`) jump the visible text before the user
 * has changed anything, instead of nudging from what they already see;
 * it also means Global style edits keep the seed live for a selection
 * that has no override of its own.
 *
 * @module features/proposals/editor/bars/text-bar-typography-panel
 */
import type { Editor } from '@tiptap/react'
import type { ReactNode } from 'react'

import { NumberStepper, Select, type SelectOption } from '@/components/editor'
import { FONT_WEIGHT_LABELS, FONT_WEIGHTS } from '@/lib/branding/fonts'

import type { ProposalTheme } from '../../model/theme'

import { applyTextStyle, TEXT_BAR_MENU_ATTR, type TextState } from './text-bar-style'

const WEIGHT_NONE = 'weight-none'
const WEIGHT_OPTIONS: SelectOption<string>[] = [
  { value: WEIGHT_NONE, label: 'Default' },
  ...FONT_WEIGHTS.map((w) => ({ value: String(w), label: FONT_WEIGHT_LABELS[w] })),
]

/** One label + control row. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1">
      <span className="text-text-muted">{label}</span>
      {children}
    </div>
  )
}

/** Props for {@link TextBarTypographyPanel}. */
export interface TextBarTypographyPanelProps {
  editor: Editor
  state: TextState
  theme: ProposalTheme
}

/** Font weight, line height, letter spacing and top spacing for the current selection, each seeded from the active role's theme default until overridden. */
export function TextBarTypographyPanel({ editor, state, theme }: TextBarTypographyPanelProps) {
  const defaults = theme.text[state.style]

  const lineHeight = state.lineHeight !== null ? parseFloat(state.lineHeight) : defaults.lineHeight
  const letterSpacingEm = state.letterSpacing !== null ? parseFloat(state.letterSpacing) : defaults.letterSpacing
  const topSpacingEm = state.topSpacing !== null ? parseFloat(state.topSpacing) : 0

  return (
    <div className="space-y-0.5 py-1">
      <Field label="Weight">
        <div className="w-28">
          <Select<string>
            size="xs"
            value={state.fontWeight ?? WEIGHT_NONE}
            options={WEIGHT_OPTIONS}
            onChange={(v) => applyTextStyle(editor, { fontWeight: v === WEIGHT_NONE ? null : v })}
            contentProps={TEXT_BAR_MENU_ATTR}
          />
        </div>
      </Field>
      <Field label="Line height">
        <NumberStepper
          value={Math.round(lineHeight * 100) / 100}
          min={0.8}
          max={3}
          step={0.1}
          ariaLabel="Line height"
          onChange={(v) => applyTextStyle(editor, { lineHeight: v.toFixed(2) })}
        />
      </Field>
      <Field label="Letter spacing">
        <NumberStepper
          value={Math.round(letterSpacingEm * 1000) / 1000}
          min={-0.05}
          max={0.3}
          step={0.01}
          suffix="em"
          ariaLabel="Letter spacing"
          onChange={(v) => applyTextStyle(editor, { letterSpacing: `${v.toFixed(3)}em` })}
        />
      </Field>
      <Field label="Top spacing">
        <NumberStepper
          value={Math.round(topSpacingEm * 100) / 100}
          min={0}
          max={4}
          step={0.1}
          suffix="em"
          ariaLabel="Top spacing"
          onChange={(v) => applyTextStyle(editor, { topSpacing: `${v.toFixed(2)}em` })}
        />
      </Field>
    </div>
  )
}
