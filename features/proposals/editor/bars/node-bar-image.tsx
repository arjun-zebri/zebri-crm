'use client'

/**
 * The `image` node's control bar (Proposal Layout v2 Phase 2, spec §4):
 * layout, width, a Caption/alt-text popover, Replace (`NodeBarUpload`)
 * and Remove.
 *
 * Alt text is required for the public page (screen readers, and the
 * page's own a11y audit), so an empty `alt` shows {@link OverrideDot}'s
 * dot on the Caption/alt trigger - repurposed here as a plain "missing"
 * warning rather than its usual "differs from baseline" meaning, since
 * it is the same "something needs your attention" signal either way -
 * with a tooltip explaining it.
 *
 * @module features/proposals/editor/bars/node-bar-image
 */
import * as Popover from '@radix-ui/react-popover'
import type { Editor } from '@tiptap/react'
import { Trash2, Type } from 'lucide-react'

import { NumberStepper, PillToggle } from '@/components/editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'

import { MEDIA_LIMITS } from '../../data/media'
import type { ImageNodeAttrs } from '../extensions/image'
import type { NodeSelection } from '../state'

import { NodeBarUpload, removeNode, useNodeAttrs, writeNodeAttrs } from './node-bar-shared'
import { OverrideDot } from './override-dot'

/** Shown on the Caption/alt control's tooltip and as the Alt text field's error while `alt` is empty. */
export const ALT_WARNING = 'Add alt text'

/** Props for {@link NodeBarImage}. */
export interface NodeBarImageProps {
  node: NonNullable<NodeSelection>
  editor: Editor
}

/** The `image` node's control bar. */
export function NodeBarImage({ node, editor }: NodeBarImageProps) {
  const attrs = useNodeAttrs<ImageNodeAttrs>(editor, node.pos, 'image')
  if (!attrs) return null
  const set = (patch: Partial<ImageNodeAttrs>) => writeNodeAttrs(editor, node.pos, patch)
  const missingAlt = attrs.alt.trim() === ''

  return (
    <>
      <PillToggle<ImageNodeAttrs['layout']>
        value={attrs.layout}
        onChange={(layout) => set({ layout })}
        options={[
          { value: 'inline', label: 'Inline' },
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
          { value: 'full', label: 'Full' },
        ]}
      />
      <NumberStepper value={attrs.widthPct} min={20} max={100} step={5} suffix="%" ariaLabel="Width" onChange={(widthPct) => set({ widthPct })} />
      <Popover.Root>
        <Tooltip label={missingAlt ? ALT_WARNING : 'Caption & alt text'}>
          <Popover.Trigger asChild>
            <span data-testid="image-text-control" className="relative inline-flex shrink-0">
              <button
                type="button"
                aria-label="Caption & alt text"
                className="inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:bg-surface-emphasis hover:text-text"
              >
                <Type size={14} strokeWidth={1.5} />
              </button>
              <OverrideDot active={missingAlt} />
            </span>
          </Popover.Trigger>
        </Tooltip>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="z-[60] w-[260px] animate-modal-in rounded-control border border-border bg-surface p-3 shadow-xl">
            <div className="flex flex-col gap-2">
              <Input label="Caption" value={attrs.caption} onChange={(e) => set({ caption: e.target.value })} />
              <Input
                label="Alt text"
                value={attrs.alt}
                {...(missingAlt ? { error: ALT_WARNING } : {})}
                onChange={(e) => set({ alt: e.target.value })}
              />
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <NodeBarUpload kind="image" accept={MEDIA_LIMITS.image.types.join(',')} label="Replace" onUploaded={(src) => set({ src })} />
      <Tooltip label="Remove">
        <Button variant="ghost" iconOnly aria-label="Remove" onClick={() => removeNode(editor, node.pos)}>
          <Trash2 size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
    </>
  )
}
