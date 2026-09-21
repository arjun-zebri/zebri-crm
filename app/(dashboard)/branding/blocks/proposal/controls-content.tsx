'use client'

import { Select } from '@/components/ui/select'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { roleDefaults } from '@/lib/branding/type-defaults'

import type { UpdateBlock } from '../render-proposal'
import { TextStyleControls } from '../text-style-controls'
import { ActiveTargetLabel, ToolbarDivider } from '../toolbar-primitives'
import type { AboutMeBlock, FaqBlock, IntroNoteBlock, TestimonialsBlock } from '../types'

import { LabelledControl } from './labelled-control'

const TESTIMONIALS_LAYOUT_OPTIONS = [
  { value: 'cards', label: 'Cards' },
  { value: 'carousel', label: 'Carousel' },
]
const IMAGE_SIDE_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
]

interface ContentControlsProps<B> {
  block: B
  branding: PublicBranding
  updateBlock: UpdateBlock
  expanded?: boolean | undefined
}

/**
 * Toolbar controls for the proposal {@link IntroNoteBlock}: typography for
 * whichever part the MC clicked in the preview, the heading by default and
 * the note (the per-proposal text) via its `data-subtarget`, one group at a
 * time like every other block.
 */
export function IntroNoteControls({
  block,
  branding,
  updateBlock,
  activeSubTarget,
  expanded,
}: ContentControlsProps<IntroNoteBlock> & { activeSubTarget: string | null }) {
  const target: 'heading' | 'note' = activeSubTarget === 'note' ? 'note' : 'heading'
  const style = target === 'heading' ? block.headingStyle : block.textStyle
  return (
    <div className="flex flex-wrap items-center gap-1">
      <ActiveTargetLabel label={target === 'heading' ? 'Heading' : 'Note'} />
      <ToolbarDivider />
      <TextStyleControls
        key={target}
        style={style}
        defaults={roleDefaults(branding, target === 'heading' ? 'sectionHeading' : 'body')}
        fontKind={target === 'heading' ? 'all' : 'body'}
        onChange={(p) =>
          target === 'heading'
            ? updateBlock<IntroNoteBlock>(block.id, { headingStyle: { ...(block.headingStyle ?? {}), ...p } })
            : updateBlock<IntroNoteBlock>(block.id, { textStyle: { ...(block.textStyle ?? {}), ...p } })
        }
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}

/** Toolbar controls for the proposal {@link TestimonialsBlock}: card/carousel layout plus heading typography. */
export function TestimonialsControls({ block, branding, updateBlock, expanded }: ContentControlsProps<TestimonialsBlock>) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <LabelledControl label="Layout">
        <div className="w-28">
          <Select
            ariaLabel="Layout"
            options={TESTIMONIALS_LAYOUT_OPTIONS}
            value={block.layout}
            onValueChange={(v) => updateBlock<TestimonialsBlock>(block.id, { layout: v as TestimonialsBlock['layout'] })}
          />
        </div>
      </LabelledControl>
      <TextStyleControls
        style={block.headingStyle}
        defaults={roleDefaults(branding, 'sectionHeading')}
        onChange={(p) => updateBlock<TestimonialsBlock>(block.id, { headingStyle: { ...(block.headingStyle ?? {}), ...p } })}
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}

/** Toolbar controls for the proposal {@link AboutMeBlock}: which side the portrait sits on, plus heading typography. */
export function AboutMeControls({ block, branding, updateBlock, expanded }: ContentControlsProps<AboutMeBlock>) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <LabelledControl label="Portrait side">
        <div className="w-24">
          <Select
            ariaLabel="Portrait side"
            options={IMAGE_SIDE_OPTIONS}
            value={block.imageSide}
            onValueChange={(v) => updateBlock<AboutMeBlock>(block.id, { imageSide: v as AboutMeBlock['imageSide'] })}
          />
        </div>
      </LabelledControl>
      <TextStyleControls
        style={block.headingStyle}
        defaults={roleDefaults(branding, 'sectionHeading')}
        onChange={(p) => updateBlock<AboutMeBlock>(block.id, { headingStyle: { ...(block.headingStyle ?? {}), ...p } })}
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}

/** Toolbar controls for the proposal {@link FaqBlock}: heading typography only (the questions themselves are edited on the canvas). */
export function FaqControls({ block, branding, updateBlock, expanded }: ContentControlsProps<FaqBlock>) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <TextStyleControls
        style={block.headingStyle}
        defaults={roleDefaults(branding, 'sectionHeading')}
        onChange={(p) => updateBlock<FaqBlock>(block.id, { headingStyle: { ...(block.headingStyle ?? {}), ...p } })}
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}
