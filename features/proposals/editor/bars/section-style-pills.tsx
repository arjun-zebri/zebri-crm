'use client'

/**
 * The section bar's Width, Height and Align pills: three `PillToggle`s
 * sharing the same "differs from the kind's starting style" override-dot
 * pattern, grouped into one file so `section-bar.tsx` stays a plain
 * composition of controls rather than three near-identical blocks.
 *
 * @module features/proposals/editor/bars/section-style-pills
 */
import { AlignCenter, AlignLeft } from 'lucide-react'

import { PillToggle } from '@/components/editor'

import type { SectionStyle } from '../../model/layout'

import { ControlDot } from './override-dot'

/** The Width pill's value space: the three named stops, or `custom` while `contentWidth` holds a dragged px number. */
type WidthValue = 'narrow' | 'medium' | 'wide' | 'custom'

/** Props for {@link SectionStylePills}. */
export interface SectionStylePillsProps {
  style: SectionStyle
  /** The section kind's starting style, for the override dots. */
  baseline: SectionStyle
  /** Always a discrete, committed change: no pill here has a "while dragging" phase. */
  onChange: (patch: Partial<SectionStyle>) => void
}

/** Width, Height and Align, as three dot-bearing `PillToggle`s. */
export function SectionStylePills({ style, baseline, onChange }: SectionStylePillsProps) {
  const baselineWidth: WidthValue = typeof baseline.contentWidth === 'number' ? 'custom' : baseline.contentWidth
  const widthValue: WidthValue = typeof style.contentWidth === 'number' ? 'custom' : style.contentWidth
  const align = style.align ?? 'left'

  return (
    <>
      <ControlDot testId="width-control" active={widthValue !== baselineWidth}>
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
            // snapping to the nearest named stop.
            ...(typeof style.contentWidth === 'number' ? [{ value: 'custom' as const, label: `Custom ${style.contentWidth}px` }] : []),
          ]}
        />
      </ControlDot>

      <ControlDot testId="height-control" active={style.height !== baseline.height}>
        <PillToggle<'fit' | 'full'>
          value={style.height}
          onChange={(v) => onChange({ height: v })}
          options={[
            { value: 'fit', label: 'Fit' },
            { value: 'full', label: 'Full' },
          ]}
        />
      </ControlDot>

      <ControlDot testId="align-control" active={align !== (baseline.align ?? 'left')}>
        <PillToggle<'left' | 'center'>
          value={align}
          onChange={(v) => onChange({ align: v })}
          options={[
            { value: 'left', label: 'Align left', icon: <AlignLeft size={12} strokeWidth={1.5} /> },
            { value: 'center', label: 'Align center', icon: <AlignCenter size={12} strokeWidth={1.5} /> },
          ]}
        />
      </ControlDot>
    </>
  )
}
