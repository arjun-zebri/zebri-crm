'use client'

/**
 * The section style popover's Width, Height and Align pills: three
 * `PillToggle`s. Split into three separate components (not one
 * `SectionStylePills` bundle, as before Proposal Layout v2's editor-chrome
 * rebuild) because the labelled Style popover (`section-style-popover.tsx`,
 * UX audit §3.5) gives each control its own labelled row rather than a
 * flat unlabelled run of pills.
 *
 * No override dot on these rows (2026-09-18 feedback): the pill's own
 * selected state already shows the current value, so a separate "differs
 * from default" indicator was redundant noise in this labelled-row layout.
 *
 * @module features/proposals/editor/bars/section-style-pills
 */
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'

import { PillToggle, VAlignIcon } from '@/components/editor'

import type { SectionStyle } from '../../model/layout'

/** The Width pill's value space: the three named stops, or `custom` while `contentWidth` holds a dragged px number. */
type WidthValue = 'narrow' | 'medium' | 'wide' | 'custom'

/** Props shared by every pill below. */
export interface SectionStylePillProps {
  /** The section's style; the Width pill expects `contentWidth` already resolved through the theme (`effectiveWidth`), as the popover passes it. */
  style: SectionStyle
  /** Always a discrete, committed change: no pill here has a "while dragging" phase. */
  onChange: (patch: Partial<SectionStyle>) => void
}

/** The Width pill: Narrow / Medium / Wide, or a fourth "Custom" pill while a dragged px value is set. */
export function SectionWidthPill({ style, onChange }: SectionStylePillProps) {
  // `?? 'medium'` only for a caller that skipped `effectiveWidth`; the popover never does.
  const width = style.contentWidth ?? 'medium'
  const widthValue: WidthValue = typeof width === 'number' ? 'custom' : width

  return (
    <PillToggle<WidthValue>
      value={widthValue}
      onChange={(v) => {
        if (v !== 'custom') onChange({ contentWidth: v })
      }}
      options={[
        { value: 'narrow', label: 'Narrow' },
        { value: 'medium', label: 'Medium' },
        { value: 'wide', label: 'Wide' },
        // A dragged px value (set elsewhere, e.g. a future canvas resize
        // handle) shows as its own fourth pill rather than silently
        // snapping to the nearest named stop. The label never interpolates
        // the px number itself - a 4-digit value ("Custom 1042px") widened
        // this segment and wrapped the whole pill group (live-found bug).
        ...(typeof width === 'number' ? [{ value: 'custom' as const, label: 'Custom' }] : []),
      ]}
    />
  )
}

/** The Height pill: Fit / Full. */
export function SectionHeightPill({ style, onChange }: SectionStylePillProps) {
  return (
    <PillToggle<'fit' | 'full'>
      value={style.height}
      onChange={(v) => onChange({ height: v })}
      options={[
        { value: 'fit', label: 'Fit' },
        { value: 'full', label: 'Full' },
      ]}
    />
  )
}

/** The Alignment pill: left / center / right. */
export function SectionAlignPill({ style, onChange }: SectionStylePillProps) {
  const align = style.align ?? 'left'
  return (
    <PillToggle<'left' | 'center' | 'right'>
      value={align}
      onChange={(v) => onChange({ align: v })}
      options={[
        { value: 'left', label: 'Align left', icon: <AlignLeft size={12} strokeWidth={1.5} /> },
        { value: 'center', label: 'Align center', icon: <AlignCenter size={12} strokeWidth={1.5} /> },
        { value: 'right', label: 'Align right', icon: <AlignRight size={12} strokeWidth={1.5} /> },
      ]}
    />
  )
}

/** The Vertical alignment pill: top / middle / bottom, for the extra space a `height: 'full'` section leaves around its content. */
export function SectionVAlignPill({ style, onChange }: SectionStylePillProps) {
  const verticalAlign = style.verticalAlign ?? 'middle'
  return (
    <PillToggle<'top' | 'middle' | 'bottom'>
      value={verticalAlign}
      onChange={(v) => onChange({ verticalAlign: v })}
      options={[
        { value: 'top', label: 'Align top', icon: <VAlignIcon position="top" /> },
        { value: 'middle', label: 'Align middle', icon: <VAlignIcon position="middle" /> },
        { value: 'bottom', label: 'Align bottom', icon: <VAlignIcon position="bottom" /> },
      ]}
    />
  )
}
