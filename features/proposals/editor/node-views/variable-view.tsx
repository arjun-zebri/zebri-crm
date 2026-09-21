'use client'

/**
 * Editor node view for the `variable` node (registered on the shared
 * `Variable` extension - see `../extensions/index.ts`, and `FieldVariable`
 * in `../data/inline-field.tsx` for the data-section fields). Without a
 * node view it renders as `lib/branding/rich-text-extensions.ts`'s plain
 * `renderHTML`: an empty `<span data-variable="id">`, invisible until the
 * document is sent and the id is resolved - which is exactly what UX
 * audit §3.1 flagged ("`{{couple_name}}` renders as blank"). This paints
 * it as a labelled chip instead, matching the Branding editor's own
 * variable chip (`app/(dashboard)/branding/blocks/rich-text/variable-chip.tsx`)
 * but in design-system tokens rather than that file's hand-picked mint,
 * since this chip lives in the tokenised proposal canvas.
 *
 * A click selects the node and opens the chip's popover: the variable's
 * name and source, an "If empty, show" fallback (the node's `fallback`
 * attr, read by `render/rich-doc.tsx` and `resolveVariablesInHtml`), and
 * Remove. A set fallback also reads on the chip itself, after the label,
 * so the canvas shows what a couple-less proposal will say.
 *
 * @module features/proposals/editor/node-views/variable-view
 */
import * as Popover from '@radix-ui/react-popover'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useState, type MouseEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { PROPOSAL_VARIABLES } from '../../model/variables'

import { selectNodeOnClick } from './select-node'

/** `id` → definition, from the same list the editor's variable inserter offers. */
const BY_ID = Object.fromEntries(PROPOSAL_VARIABLES.map((v) => [v.id, v]))

/** Editor node view for the `variable` node. */
export function VariableView({ node, selected, editor, getPos, updateAttributes, deleteNode }: NodeViewProps) {
  const { id = '', fallback = null } = node.attrs as { id?: string | null; fallback?: string | null }
  const def = BY_ID[id ?? '']
  const label = def?.label ?? id ?? ''
  const [open, setOpen] = useState(false)
  // Buffered while typing and committed on blur/Enter, like every plain
  // string field in the editor: an attribute write per keystroke would be
  // its own undo step.
  const [draft, setDraft] = useState(fallback ?? '')
  const select = selectNodeOnClick(editor, getPos)

  const commit = () => {
    const next = draft.trim()
    if (next !== (fallback ?? '')) updateAttributes({ fallback: next || null })
  }

  const onClickCapture = (e: MouseEvent<HTMLElement>) => {
    // The popover portals to `body`, but React still bubbles its clicks
    // through this wrapper; only a click on the chip itself selects it
    // (and `select` would otherwise swallow the popover's own buttons).
    if (!e.currentTarget.contains(e.target as Node)) return
    select(e)
    setDraft(fallback ?? '')
    setOpen(true)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <NodeViewWrapper
          as="span"
          data-variable={id}
          // The same mint token the email composer's mention chip uses
          // (`components/ui/rich-text-editor.tsx`), on the control radius:
          // one look for "this fills in later" across the app. Colours are
          // fixed rather than inherited so the chip reads the same on a dark
          // hero as on the white sheet. No `text-body`, and em-based padding:
          // the chip sits inside headings too (the default hero's h1 is one),
          // where it must take the heading's size, not shrink to body text.
          className={`inline-block rounded-control bg-emerald-50 px-[0.3em] py-[0.05em] text-emerald-700 cursor-pointer align-baseline ${selected ? 'ring-1 ring-brand-fg' : ''}`}
          contentEditable={false}
          onClickCapture={onClickCapture}
        >
          {label}
          {fallback ? (
            <>
              <span className="mx-[0.25em] opacity-50">·</span>
              <span className="opacity-70">{fallback}</span>
            </>
          ) : null}
        </NodeViewWrapper>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-[60] w-[280px] animate-modal-in rounded-control border border-border bg-surface p-3 shadow-xl">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-body font-medium text-text">{label}</p>
              {def ? <p className="text-body text-text-muted">{def.source}</p> : null}
            </div>
            <Input
              label="If empty, show"
              placeholder="e.g. you two"
              value={draft}
              maxLength={200}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commit()
                  setOpen(false)
                }
              }}
            />
            <Button variant="ghost" className="self-start" onClick={() => { setOpen(false); deleteNode() }} aria-label="Remove variable">
              Remove
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
