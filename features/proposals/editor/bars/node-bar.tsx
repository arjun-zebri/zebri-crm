'use client'

/**
 * The per-node control bar (Proposal Layout v2 Phase 2, spec §4): shown
 * whenever the editor selection is a `NodeSelection` on an atom node
 * (image, button, embed, audio, spacer) or the `columns` container.
 * Dispatches to the matching sub-bar by `node.nodeType`; Task 12 mounts
 * this at the selection's screen position, this task only builds the
 * bar and its own tests render it directly.
 *
 * The shared read/write helpers (`useNodeAttrs`, `writeNodeAttrs`,
 * `removeNode`, `NodeBarUpload`) live in `node-bar-shared.tsx`, not
 * here: every sub-bar below needs them, and this file already imports
 * every sub-bar, so putting the helpers here too would make each
 * sub-bar's import of them a module cycle back through the dispatcher.
 *
 * @module features/proposals/editor/bars/node-bar
 */
import type { Editor } from '@tiptap/react'

import type { NodeSelection } from '../state'

import { BarShell } from './bar-shell'
import { NodeBarAudio } from './node-bar-audio'
import { NodeBarButton } from './node-bar-button'
import { NodeBarColumns } from './node-bar-columns'
import { NodeBarEmbed } from './node-bar-embed'
import { NodeBarImage } from './node-bar-image'
import type { NodeBarSection } from './node-bar-shared'
import { NodeBarSpacer } from './node-bar-spacer'

/** Accessible bar name for each node type, keyed by its TipTap node name. */
const ARIA_LABEL: Record<string, string> = {
  image: 'Image',
  button: 'Button',
  embed: 'Embed',
  audio: 'Audio',
  columns: 'Columns',
  spacer: 'Spacer',
}

/** Props for {@link NodeBar}. */
export interface NodeBarProps {
  node: NonNullable<NodeSelection>
  editor: Editor
  /** Sections offered by the button bar's "Jump to section" target. Defaults to none. */
  sections?: readonly NodeBarSection[]
  /** Brand swatches offered by colour pickers. Defaults to none. */
  swatches?: readonly string[]
}

/** The node bar: `role="toolbar"`, dispatched by `node.nodeType`. Renders nothing for an unrecognised type. */
export function NodeBar({ node, editor, sections = [], swatches = [] }: NodeBarProps) {
  const label = ARIA_LABEL[node.nodeType]
  if (!label) return null

  return (
    <div role="toolbar" aria-label={label} className="w-full rounded-control border border-border bg-surface px-1 shadow-lg">
      <BarShell>
        {node.nodeType === 'image' && <NodeBarImage node={node} editor={editor} />}
        {node.nodeType === 'button' && <NodeBarButton node={node} editor={editor} sections={sections} swatches={swatches} />}
        {node.nodeType === 'embed' && <NodeBarEmbed node={node} editor={editor} />}
        {node.nodeType === 'audio' && <NodeBarAudio node={node} editor={editor} />}
        {node.nodeType === 'columns' && <NodeBarColumns node={node} editor={editor} />}
        {node.nodeType === 'spacer' && <NodeBarSpacer node={node} editor={editor} />}
      </BarShell>
    </div>
  )
}
