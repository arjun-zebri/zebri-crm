'use client'

/**
 * The `audio` node's control bar (Proposal Layout v2 Phase 2, spec §4):
 * a title `Input`, Replace (`NodeBarUpload`) and Remove.
 *
 * @module features/proposals/editor/bars/node-bar-audio
 */
import type { Editor } from '@tiptap/react'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'

import { MEDIA_LIMITS } from '../../data/media'
import type { AudioNodeAttrs } from '../extensions/audio'
import type { NodeSelection } from '../state'

import { NodeBarUpload, removeNode, useNodeAttrs, writeNodeAttrs } from './node-bar-shared'

/** Props for {@link NodeBarAudio}. */
export interface NodeBarAudioProps {
  node: NonNullable<NodeSelection>
  editor: Editor
}

/** The `audio` node's control bar. */
export function NodeBarAudio({ node, editor }: NodeBarAudioProps) {
  const attrs = useNodeAttrs<AudioNodeAttrs>(editor, node.pos, 'audio')
  if (!attrs) return null

  return (
    <>
      <Input
        aria-label="Audio title"
        value={attrs.title}
        placeholder="Title"
        className="w-36 shrink-0"
        onChange={(e) => writeNodeAttrs(editor, node.pos, { title: e.target.value })}
      />
      <NodeBarUpload
        kind="audio"
        accept={MEDIA_LIMITS.audio.types.join(',')}
        label="Replace"
        onUploaded={(src) => writeNodeAttrs(editor, node.pos, { src })}
      />
      <Tooltip side="top" label="Remove">
        <Button variant="ghost" iconOnly aria-label="Remove" onClick={() => removeNode(editor, node.pos)}>
          <Trash2 size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
    </>
  )
}
