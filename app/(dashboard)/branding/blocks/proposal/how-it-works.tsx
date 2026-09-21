'use client'

import { publicBrandingFromEditorState } from '@/app/(dashboard)/branding/editor-branding'
import { getTextColor } from '@/lib/branding/contrast'
import {
  HOW_IT_WORKS_ICONS,
  RenderHowItWorks,
  type HowItWorksSlots,
} from '@/lib/branding/public-blocks/proposal/how-it-works'
import { roleDefaults } from '@/lib/branding/type-defaults'
import type { BrandPreviewState, SurfaceTab } from '@/types/branding-preview'

import type { ProposalRenderExtras, UpdateBlock } from '../render-proposal'
import { resolveTextStyle } from '../text-style'
import type { HowItWorksBlock, HowItWorksStep } from '../types'

import { AddItemButton, RemoveItemButton } from './item-list'
import { ProposalText } from './proposal-text'

/** The steps list's own cap, enforced by `AddItemButton`'s `max`. */
const MAX_STEPS = 6

interface EditHowItWorksProps {
  block: HowItWorksBlock
  state: BrandPreviewState
  surface: SurfaceTab
  updateBlock: UpdateBlock
  extras: ProposalRenderExtras
}

/** New step ids never repeat within a session; that's all a client-only key needs. */
function newStepId(): string {
  return `st-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Editor renderer for the proposal how-it-works block: each step keeps its
 * public icon circle (chosen from the toolbar, not here) with an
 * inline-editable title and description, plus a hover remove control;
 * "Add step" appends a step up to the 6-step cap.
 */
export function EditHowItWorks({ block, state, updateBlock }: EditHowItWorksProps) {
  const branding = publicBrandingFromEditorState(state)
  const iconColor = getTextColor(branding.brand_color)
  const labelStyle = resolveTextStyle(undefined, roleDefaults(branding, 'sectionLabel'))
  const titleStyle = { ...resolveTextStyle(undefined, roleDefaults(branding, 'sectionHeading')), fontSize: 18 }
  const bodyStyle = resolveTextStyle(undefined, roleDefaults(branding, 'body'))

  const patchStep = (id: string, patch: Partial<HowItWorksStep>) => {
    updateBlock<HowItWorksBlock>(block.id, {
      steps: block.steps.map((step) => (step.id === id ? { ...step, ...patch } : step)),
    })
  }

  const removeStep = (id: string) => {
    updateBlock<HowItWorksBlock>(block.id, { steps: block.steps.filter((step) => step.id !== id) })
  }

  const addStep = () => {
    updateBlock<HowItWorksBlock>(block.id, {
      steps: [...block.steps, { id: newStepId(), title: '', description: '', icon: 'check' }],
    })
  }

  const slots: HowItWorksSlots = {
    heading: (
      <ProposalText subtarget="heading" value={block.heading} onChange={(v) => updateBlock<HowItWorksBlock>(block.id, { heading: v })} placeholder="Heading" />
    ),
    step: (step, i) => {
      const Icon = HOW_IT_WORKS_ICONS[step.icon]
      return (
        <div className="group/item relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-pill" style={{ background: branding.brand_color }}>
            <Icon size={18} strokeWidth={1.5} style={{ color: iconColor }} />
          </div>
          <p className="m-0 mt-3" style={labelStyle}>Step {i + 1}</p>
          {/* div, not p: ProposalText mounts a TipTap EditorContent (a div), and a div inside a p is a hydration error. */}
          <div className="m-0 mt-1" style={titleStyle}>
            <ProposalText value={step.title} onChange={(v) => patchStep(step.id, { title: v })} placeholder="Step title" />
          </div>
          <div className="m-0 mt-1" style={bodyStyle}>
            <ProposalText value={step.description} onChange={(v) => patchStep(step.id, { description: v })} placeholder="Step description" enterKey="paragraph" />
          </div>
          <RemoveItemButton onRemove={() => removeStep(step.id)} label={`Remove step ${i + 1}`} />
        </div>
      )
    },
  }

  return (
    <>
      <RenderHowItWorks block={block} branding={branding} slots={slots} />
      <AddItemButton onAdd={addStep} label="Add step" count={block.steps.length} max={MAX_STEPS} />
    </>
  )
}
