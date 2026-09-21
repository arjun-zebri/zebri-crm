'use client'

/**
 * The Global style popover's Page tab: page background, the gap between
 * sections, the vertical padding sections inherit and the horizontal
 * padding they all share, stack vs step flow, and the reveal animation
 * (mode, type, speed). Every control dispatches a
 * `setTheme` patch through `onPatch`; nothing here holds state.
 *
 * @module features/proposals/editor/global-style/global-style-page-tab
 */
import { NumberStepper, PillToggle, Select } from '@/components/editor'
import { ColorPopover } from '@/components/ui/color-popover'

import type { SectionPadding } from '../../model/layout'
import { CONTENT_WIDTH_PX, SECTION_PADDING_PX } from '../../model/rich-doc-spec'
import { SECTION_GAP_PX, SECTION_PADDING_X_PX, type ProposalTheme, type ThemeAnimation } from '../../model/theme'
import type { ThemePatch } from '../state'

import { GlobalStyleField, SwatchTrigger } from './global-style-field'

type GapValue = keyof typeof SECTION_GAP_PX | 'custom'
type WidthValue = 'narrow' | 'medium' | 'wide' | 'custom'
type PaddingValue = 'compact' | 'cozy' | 'roomy' | 'custom'

const ANIMATION_MODE_OPTIONS: { value: ThemeAnimation['mode']; label: string }[] = [
  { value: 'section', label: 'Animate by section' },
  { value: 'together', label: 'Animate all together' },
  { value: 'none', label: 'No animation' },
]

function gapValue(px: number): GapValue {
  const hit = (Object.entries(SECTION_GAP_PX) as [keyof typeof SECTION_GAP_PX, number][]).find(([, v]) => v === px)
  return hit ? hit[0] : 'custom'
}

function paddingValue(padding: SectionPadding): PaddingValue {
  return typeof padding === 'number' ? 'custom' : padding
}

function paddingXValue(px: number): PaddingValue {
  const hit = (Object.entries(SECTION_PADDING_X_PX) as [keyof typeof SECTION_PADDING_X_PX, number][]).find(([, v]) => v === px)
  return hit ? hit[0] : 'custom'
}

const PADDING_OPTIONS: { value: PaddingValue; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'cozy', label: 'Cozy' },
  { value: 'roomy', label: 'Roomy' },
  { value: 'custom', label: 'Custom' },
]

/** Props for {@link GlobalStylePageTab}. */
export interface GlobalStylePageTabProps {
  theme: ProposalTheme
  onPatch: (patch: ThemePatch) => void
  /** Brand swatches for the background picker. */
  swatches: readonly string[]
}

/** The Page tab. See the module doc. */
export function GlobalStylePageTab({ theme, onPatch, swatches }: GlobalStylePageTabProps) {
  const gap = gapValue(theme.sectionGap)
  const padding = paddingValue(theme.sectionPadding)
  const paddingPx = typeof theme.sectionPadding === 'number' ? theme.sectionPadding : SECTION_PADDING_PX[theme.sectionPadding]
  const paddingX = paddingXValue(theme.sectionPaddingX)
  const widthPx: number = typeof theme.contentWidth === 'number' ? theme.contentWidth : CONTENT_WIDTH_PX[theme.contentWidth]

  return (
    <div>
      <GlobalStyleField label="Background">
        <ColorPopover
          value={theme.background}
          onChange={(background) => onPatch({ background })}
          swatches={swatches}
          trigger={<SwatchTrigger color={theme.background} label="Page background" />}
        />
      </GlobalStyleField>

      {/* Page width: the content column width every section inherits until
          it picks its own in its Style popover (same Narrow / Medium / Wide
          stops as there, so the two controls agree on what "Wide" is). */}
      <GlobalStyleField label="Page width" stack>
        <PillToggle<WidthValue>
          stretch
          value={typeof theme.contentWidth === 'number' ? 'custom' : theme.contentWidth}
          onChange={(v) => onPatch({ contentWidth: v === 'custom' ? widthPx + 1 : v })}
          options={[
            { value: 'narrow', label: 'Narrow' },
            { value: 'medium', label: 'Medium' },
            { value: 'wide', label: 'Wide' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
      </GlobalStyleField>
      {typeof theme.contentWidth === 'number' ? (
        <GlobalStyleField label="Width size">
          <NumberStepper value={theme.contentWidth} min={320} max={1400} step={20} suffix="px" ariaLabel="Page width" onChange={(v) => onPatch({ contentWidth: v })} />
        </GlobalStyleField>
      ) : null}

      {/* "Custom" on either pill turns the current stop into a plain px
          number (so the pill stays on Custom) and reveals a stepper for it,
          the same way a dragged section padding shows as its own value. */}
      <GlobalStyleField label="Section gap" stack>
        <PillToggle<GapValue>
          stretch
          value={gap}
          onChange={(v) => onPatch({ sectionGap: v === 'custom' ? theme.sectionGap + 1 : SECTION_GAP_PX[v] })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
      </GlobalStyleField>
      {gap === 'custom' ? (
        <GlobalStyleField label="Gap size">
          <NumberStepper value={theme.sectionGap} min={0} max={200} step={4} suffix="px" ariaLabel="Section gap" onChange={(v) => onPatch({ sectionGap: v })} />
        </GlobalStyleField>
      ) : null}

      {/* Two paddings, named by axis (2026-09-19: one "Section padding"
          read as nothing in particular). Vertical is the default a section
          inherits and can override in its own Style; horizontal is one
          value for the whole page (see `ProposalTheme.sectionPaddingX`).
          The vertical stops are the same `SECTION_PADDING_PX` a section's
          own Padding pill uses, so "Cozy" means the same 48px in both. */}
      <GlobalStyleField label="Vertical padding" stack>
        <PillToggle<PaddingValue>
          stretch
          value={padding}
          onChange={(v) => onPatch({ sectionPadding: v === 'custom' ? paddingPx + 1 : v })}
          options={PADDING_OPTIONS}
        />
      </GlobalStyleField>
      {padding === 'custom' ? (
        <GlobalStyleField label="Vertical size">
          <NumberStepper value={paddingPx} min={0} max={240} step={8} suffix="px" ariaLabel="Vertical padding" onChange={(v) => onPatch({ sectionPadding: v })} />
        </GlobalStyleField>
      ) : null}

      <GlobalStyleField label="Horizontal padding" stack>
        <PillToggle<PaddingValue>
          stretch
          value={paddingX}
          onChange={(v) => onPatch({ sectionPaddingX: v === 'custom' ? theme.sectionPaddingX + 1 : SECTION_PADDING_X_PX[v] })}
          options={PADDING_OPTIONS}
        />
      </GlobalStyleField>
      {paddingX === 'custom' ? (
        <GlobalStyleField label="Horizontal size">
          <NumberStepper value={theme.sectionPaddingX} min={0} max={240} step={8} suffix="px" ariaLabel="Horizontal padding" onChange={(v) => onPatch({ sectionPaddingX: v })} />
        </GlobalStyleField>
      ) : null}

      <GlobalStyleField label="Page style">
        <PillToggle<ProposalTheme['flow']>
          value={theme.flow}
          onChange={(flow) => onPatch({ flow })}
          options={[
            { value: 'stack', label: 'Stacked' },
            { value: 'step', label: 'One at a time' },
          ]}
        />
      </GlobalStyleField>

      <div className="my-2 border-t border-border" />

      <GlobalStyleField label="Animation">
        <div className="w-44">
          <Select<ThemeAnimation['mode']>
            size="xs"
            value={theme.animation.mode}
            options={ANIMATION_MODE_OPTIONS}
            onChange={(mode) => onPatch({ animation: { mode } })}
          />
        </div>
      </GlobalStyleField>
      {theme.animation.mode === 'none' ? null : (
        <>
          <GlobalStyleField label="Type">
            <PillToggle<ThemeAnimation['type']>
              value={theme.animation.type}
              onChange={(type) => onPatch({ animation: { type } })}
              options={[
                { value: 'fade', label: 'Fade in' },
                { value: 'slide', label: 'Slide in' },
              ]}
            />
          </GlobalStyleField>
          <GlobalStyleField label="Speed">
            <PillToggle<ThemeAnimation['speed']>
              value={theme.animation.speed}
              onChange={(speed) => onPatch({ animation: { speed } })}
              options={[
                { value: 'slow', label: 'Slow' },
                { value: 'medium', label: 'Med' },
                { value: 'fast', label: 'Fast' },
              ]}
            />
          </GlobalStyleField>
        </>
      )}
    </div>
  )
}
