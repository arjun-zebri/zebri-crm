'use client'

import { ColorPopover } from '@/components/ui/color-popover'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip } from '@/components/ui/tooltip'
import type { PublicBranding } from '@/lib/branding/public-branding'
import { COLOR_PALETTE } from '@/lib/branding/themes'
import { roleDefaults } from '@/lib/branding/type-defaults'

import type { UpdateBlock } from '../render-proposal'
import { TextStyleControls } from '../text-style-controls'
import type { AcceptBlock, PackagesBlock } from '../types'

import { LabelledControl } from './labelled-control'

const PACKAGES_LAYOUT_OPTIONS = [
  { value: 'cards', label: 'Cards' },
  { value: 'stacked', label: 'Stacked' },
]

interface CommerceControlsProps<B> {
  block: B
  branding: PublicBranding
  updateBlock: UpdateBlock
  expanded?: boolean | undefined
}

/**
 * Toolbar controls for the proposal {@link PackagesBlock} marker: card
 * layout, whether inclusions are listed, the per-card CTA label, and heading
 * typography. The options and add-ons themselves come from the proposal, not
 * this block, so there is nothing to edit for them here.
 */
export function PackagesControls({ block, branding, updateBlock, expanded }: CommerceControlsProps<PackagesBlock>) {
  const patch = (p: Partial<PackagesBlock>) => updateBlock<PackagesBlock>(block.id, p)
  return (
    <div className="flex flex-wrap items-end gap-2">
      <LabelledControl label="Layout">
        <div className="w-28">
          <Select
            ariaLabel="Layout"
            options={PACKAGES_LAYOUT_OPTIONS}
            value={block.layout}
            onValueChange={(v) => patch({ layout: v as PackagesBlock['layout'] })}
          />
        </div>
      </LabelledControl>
      <LabelledControl label="Show inclusions">
        <Toggle checked={block.showInclusions} onChange={(v) => patch({ showInclusions: v })} ariaLabel="Show inclusions" />
      </LabelledControl>
      <LabelledControl label="CTA label">
        <div className="w-36">
          <Input aria-label="CTA label" value={block.ctaLabel} placeholder="Choose this package" onChange={(e) => patch({ ctaLabel: e.target.value })} />
        </div>
      </LabelledControl>
      <TextStyleControls
        style={block.headingStyle}
        defaults={roleDefaults(branding, 'sectionHeading')}
        onChange={(p) => patch({ headingStyle: { ...(block.headingStyle ?? {}), ...p } })}
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}

/**
 * Toolbar controls for the proposal {@link AcceptBlock} marker: the accept
 * button's colour (falls back to the brand colour, same rule the public
 * page uses) and heading typography.
 */
export function AcceptControls({ block, branding, updateBlock, expanded }: CommerceControlsProps<AcceptBlock>) {
  const patch = (p: Partial<AcceptBlock>) => updateBlock<AcceptBlock>(block.id, p)
  const buttonColor = block.buttonColor ?? branding.brand_color
  return (
    <div className="flex flex-wrap items-end gap-2">
      <LabelledControl label="Button colour">
        <Tooltip label="Button colour">
          <ColorPopover
            value={buttonColor}
            onChange={(v) => patch({ buttonColor: v })}
            swatches={COLOR_PALETTE}
            trigger={
              <button type="button" className="inline-flex items-center h-8 px-2.5 rounded-control hover:bg-surface-emphasis cursor-pointer border border-border">
                <span className="w-4 h-4 rounded-control ring-1 ring-black/10" style={{ background: buttonColor }} />
              </button>
            }
          />
        </Tooltip>
      </LabelledControl>
      <TextStyleControls
        style={block.headingStyle}
        defaults={roleDefaults(branding, 'sectionHeading')}
        onChange={(p) => patch({ headingStyle: { ...(block.headingStyle ?? {}), ...p } })}
        {...(expanded !== undefined ? { expanded } : {})}
      />
    </div>
  )
}
