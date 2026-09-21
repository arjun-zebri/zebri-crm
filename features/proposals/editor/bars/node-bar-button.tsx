'use client'

/**
 * The `button` node's control bar (Proposal Layout v2 Phase 2, spec §4):
 * label, what it does on click (`NodeBarButtonAction`), variant, size,
 * colour, corner radius, alignment and Remove.
 *
 * @module features/proposals/editor/bars/node-bar-button
 */
import type { Editor } from '@tiptap/react'
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from 'lucide-react'

import { NumberStepper, PillToggle } from '@/components/editor'
import { Button } from '@/components/ui/button'
import { ColorPopover } from '@/components/ui/color-popover'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'

import type { ButtonNodeAttrs } from '../extensions/button'
import type { NodeSelection } from '../state'

import { NodeBarButtonAction } from './node-bar-button-action'
import { removeNode, useNodeAttrs, writeNodeAttrs, type NodeBarSection } from './node-bar-shared'

/** Colour swatch shown when the button has no `color` override of its own. */
const DEFAULT_COLOR = '#111827'

/** Props for {@link NodeBarButton}. */
export interface NodeBarButtonProps {
  node: NonNullable<NodeSelection>
  editor: Editor
  /** Sections offered by the action's "Jump to section" target. Defaults to none. */
  sections?: readonly NodeBarSection[]
  /** Brand swatches offered by the colour picker. Defaults to none. */
  swatches?: readonly string[]
}

/** The `button` node's control bar. */
export function NodeBarButton({ node, editor, sections = [], swatches = [] }: NodeBarButtonProps) {
  const attrs = useNodeAttrs<ButtonNodeAttrs>(editor, node.pos, 'button')
  if (!attrs) return null
  const set = (patch: Partial<ButtonNodeAttrs>) => writeNodeAttrs(editor, node.pos, patch)

  return (
    <>
      {/* Writes per keystroke like every other attr here (the editor's own
          history debounce coalesces them). */}
      <Input aria-label="Button label" value={attrs.label} className="w-44 shrink-0" onChange={(e) => set({ label: e.target.value })} />
      <NodeBarButtonAction action={attrs.action} sections={sections} onChange={(action) => set({ action })} />
      <PillToggle<'fill' | 'outline'>
        value={attrs.variant}
        onChange={(variant) => set({ variant })}
        options={[
          { value: 'fill', label: 'Fill' },
          { value: 'outline', label: 'Outline' },
        ]}
      />
      <PillToggle<'sm' | 'md' | 'lg'>
        value={attrs.size}
        onChange={(size) => set({ size })}
        options={[
          { value: 'sm', label: 'S' },
          { value: 'md', label: 'M' },
          { value: 'lg', label: 'L' },
        ]}
      />
      <Tooltip side="top" label="Colour">
        <ColorPopover
          value={attrs.color ?? DEFAULT_COLOR}
          onChange={(color) => set({ color })}
          swatches={swatches}
          trigger={
            <button
              type="button"
              aria-label="Colour"
              className="h-8 w-8 shrink-0 rounded-control ring-1 ring-black/10"
              style={{ background: attrs.color ?? DEFAULT_COLOR }}
            />
          }
        />
      </Tooltip>
      <NumberStepper value={attrs.radius ?? 0} min={0} max={40} step={1} ariaLabel="Corner radius" onChange={(radius) => set({ radius })} />
      <PillToggle<'left' | 'center' | 'right'>
        value={attrs.align}
        onChange={(align) => set({ align })}
        options={[
          { value: 'left', label: 'Align left', icon: <AlignLeft size={12} strokeWidth={1.5} /> },
          { value: 'center', label: 'Align center', icon: <AlignCenter size={12} strokeWidth={1.5} /> },
          { value: 'right', label: 'Align right', icon: <AlignRight size={12} strokeWidth={1.5} /> },
        ]}
      />
      <Tooltip side="top" label="Remove">
        <Button variant="ghost" iconOnly aria-label="Remove" onClick={() => removeNode(editor, node.pos)}>
          <Trash2 size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
    </>
  )
}
