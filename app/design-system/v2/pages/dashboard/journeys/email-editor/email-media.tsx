'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useRef, useState, type DragEvent } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ImageIcon } from '@/components/ui-v2/icons';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui-v2/popover';

import { blockCorner, VideoFace } from '../../email/render/email-body';

import { block, CardDelete, CardRow, Picked } from './email-nodes';

/**
 * Photos and video in a journey email. A photo starts as a dashed drop
 * zone ("Drop a header photo, or browse files"), takes a file dropped on
 * it or picked, and then shows it; a header photo is the wide one at the
 * top. A video is its thumbnail with a play button and its length, and a
 * caption under it: an email cannot play a video, so the thumbnail links
 * to it. Its link and length are set in a popover while it is picked,
 * and a thumbnail drops onto it like a photo. Files become blob URLs:
 * the preview has no server to upload to.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-editor/email-media
 */

/** A drop target that takes one image file, and a hidden picker for "browse files". */
export function useImageDrop(onFile: (url: string, name: string) => void) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (f: File | undefined) => {
    if (f?.type.startsWith('image/')) onFile(URL.createObjectURL(f), f.name.replace(/\.[^.]+$/, ''));
  };
  return {
    over,
    browse: () => input.current?.click(),
    zone: {
      onDragOver: (e: DragEvent) => (e.preventDefault(), setOver(true)),
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => (e.preventDefault(), setOver(false), take(e.dataTransfer.files[0])),
    },
    picker: <input ref={input} type="file" accept="image/*" hidden onChange={(e) => take(e.target.files?.[0])} />,
  };
}

function ImageView({ node, selected, updateAttributes, deleteNode }: NodeViewProps) {
  const header = Boolean(node.attrs.header);
  const drop = useImageDrop((src, alt) => updateAttributes({ src, alt }));
  const src = node.attrs.src ? String(node.attrs.src) : '';
  return (
    <NodeViewWrapper>
      <Picked selected={selected} onRemove={deleteNode} label={header ? 'header photo' : 'image'}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={String(node.attrs.alt ?? '')} className={`w-full object-cover ${blockCorner()}`} />
        ) : (
          // The drop zone's dashed edge is FileDrop's recipe; it is the editor's, never sent.
          <div {...drop.zone} className={`flex w-full flex-col items-center justify-center gap-1 rounded-check border border-dashed text-center transition-colors duration-150 motion-reduce:transition-none ${header ? 'aspect-[5/2]' : 'aspect-[16/7]'} ${drop.over ? 'border-selected bg-grass-50' : 'border-zebra-300 bg-field'}`}>
            <ImageIcon aria-hidden="true" className="mb-1 size-4 text-zebra-500" />
            <p className="type-label text-zebra-700">{header ? 'Drop a header photo' : 'Drop a photo'}</p>
            <p className="type-body text-zebra-500">
              or{' '}
              <Button variant="plain" onClick={drop.browse} className="underline">
                browse files
              </Button>
            </p>
          </div>
        )}
        {drop.picker}
      </Picked>
    </NodeViewWrapper>
  );
}

function VideoView({ node, selected, updateAttributes, deleteNode }: NodeViewProps) {
  const drop = useImageDrop((thumb) => updateAttributes({ thumb }));
  const thumb = node.attrs.thumb ? String(node.attrs.thumb) : '';
  return (
    <NodeViewWrapper>
      <Popover open={selected}>
        <PopoverAnchor asChild>
          <div>
            <Picked selected={selected} onRemove={deleteNode} label="video">
              {/* A thumbnail drops onto the face; the outline says it will take it. */}
              <div {...drop.zone} className={`${blockCorner()} ${drop.over ? 'outline-2 outline-selected' : ''}`}>
                <VideoFace thumb={thumb || undefined} length={node.attrs.length ? String(node.attrs.length) : undefined} />
              </div>
              <InlineInput aria-label="Caption" placeholder="Add a caption" value={String(node.attrs.caption ?? '')} onChange={(e) => updateAttributes({ caption: e.target.value })} className="mt-2 w-full text-center type-body text-zebra-500" />
              {drop.picker}
            </Picked>
          </div>
        </PopoverAnchor>
        <PopoverContent size="card" align="start" aria-label="Video" onOpenAutoFocus={(e) => e.preventDefault()}>
          <CardRow label="Link" value={String(node.attrs.url ?? '')} placeholder="YouTube, Vimeo or Loom" onChange={(v) => updateAttributes({ url: v })} />
          <CardRow label="Length" value={String(node.attrs.length ?? '')} placeholder="1:12" onChange={(v) => updateAttributes({ length: v })} />
          <div className="flex min-h-9 items-center gap-3 type-body">
            <span className="w-16 shrink-0 text-zebra-500">Thumbnail</span>
            <Button variant="text" onClick={drop.browse}>
              {thumb ? 'Change' : 'Upload'}
            </Button>
          </div>
          <CardDelete label="video" onRemove={deleteNode} />
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  );
}

export const EmailImage = block('emailImage', { src: null, alt: '', header: false }, ImageView);
export const EmailVideo = block('emailVideo', { url: '', thumb: null, length: '', caption: '' }, VideoView);
