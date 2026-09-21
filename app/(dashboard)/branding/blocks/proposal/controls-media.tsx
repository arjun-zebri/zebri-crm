'use client'

import { heroTextDefaults, heroVerticalAlign } from '@/lib/branding/public-blocks/proposal/hero'
import type { PublicBranding } from '@/lib/branding/public-branding'

import { Slider } from '../../components/slider'
import type { UpdateBlock } from '../render-proposal'
import { TextStyleControls } from '../text-style-controls'
import { ActiveTargetLabel, IncludeDropdown, ToolbarDivider } from '../toolbar-primitives'
import type { HeroBlock, TextStyle } from '../types'

import { PositionControl } from './position-control'

function withoutAlign(style: TextStyle | undefined): TextStyle {
  const next = { ...(style ?? {}) }
  delete next.align
  return next
}

/**
 * Toolbar controls for the proposal {@link HeroBlock}, in the same single
 * row every general block uses: the part being styled (heading by default,
 * subheading via its `data-subtarget`) and its typography, then Position
 * (one 3x3 grid for horizontal + vertical), the overlay darkness when there
 * is media to darken, and Include for showing or hiding either part. The
 * typography defaults are the ones the hero renders with, so the stepper
 * and swatch show what is on screen. Height is not here: the MC drags the
 * hero's bottom edge on the canvas. Media sources (upload, link) live on the
 * block itself, beside the media.
 */
export function HeroControls({
  block,
  branding,
  updateBlock,
  activeSubTarget,
  expanded,
}: {
  block: HeroBlock
  branding: PublicBranding
  updateBlock: UpdateBlock
  activeSubTarget: string | null
  expanded?: boolean | undefined
}) {
  const patch = (p: Partial<HeroBlock>) => updateBlock<HeroBlock>(block.id, p)
  const hasMedia = block.background.kind !== 'none'
  const target: 'heading' | 'subheading' = activeSubTarget === 'subheading' ? 'subheading' : 'heading'
  const defaults = heroTextDefaults(branding, block, 'page')[target]
  const style = target === 'heading' ? block.headingStyle : block.subheadingStyle

  return (
    <div className="flex flex-wrap items-center gap-1">
      <ActiveTargetLabel label={target === 'heading' ? 'Heading' : 'Subheading'} />
      <ToolbarDivider />
      <TextStyleControls
        key={target}
        style={style}
        defaults={defaults}
        fontKind={target === 'heading' ? 'heading' : 'body'}
        showAlign={false}
        onChange={(p) =>
          target === 'heading'
            ? patch({ headingStyle: { ...(block.headingStyle ?? {}), ...p } })
            : patch({ subheadingStyle: { ...(block.subheadingStyle ?? {}), ...p } })
        }
        {...(expanded !== undefined ? { expanded } : {})}
      />
      <ToolbarDivider />
      <PositionControl
        h={block.textAlign}
        v={heroVerticalAlign(block)}
        // Position is the hero's one alignment control, so a per-part align
        // override (from before it existed) is dropped whenever it changes.
        onChange={(textAlign, verticalAlign) =>
          patch({ textAlign, verticalAlign, headingStyle: withoutAlign(block.headingStyle), subheadingStyle: withoutAlign(block.subheadingStyle) })
        }
      />
      {/* Overlay darkens media; on a plain surface there is nothing to darken. */}
      {hasMedia && (
        <div className="inline-flex items-center gap-2 h-8 px-2 rounded-control border border-border bg-surface shrink-0">
          <span className="text-body text-text-muted">Overlay</span>
          <div className="w-20">
            <Slider ariaLabel="Overlay" value={block.overlay} min={0} max={100} onChange={(v) => patch({ overlay: v })} />
          </div>
          <span className="text-body font-mono text-gray-700 tabular-nums w-9 text-right">{block.overlay}%</span>
        </div>
      )}
      <ToolbarDivider />
      <IncludeDropdown
        tooltip="Show or hide the heading and subheading"
        rows={[
          { label: 'Heading', active: block.showHeading !== false, set: (v) => patch({ showHeading: v }) },
          { label: 'Subheading', active: block.showSubheading !== false, set: (v) => patch({ showSubheading: v }) },
        ]}
      />
    </div>
  )
}
