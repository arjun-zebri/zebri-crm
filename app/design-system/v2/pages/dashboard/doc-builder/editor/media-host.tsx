'use client';

import type { Editor } from '@tiptap/react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { LinkIcon, PhotosIcon, VideoIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { detectEmbedProvider, insertAtomNode, useRegisteredEditors } from '@/features/proposals';

import type { DocEditor } from '../state/use-doc-editor';

import { PhotoGrid, usePhotos } from './photos';

/**
 * What answers the text editor's requests for media, in v2 dress:
 * production's editor asks for an image, an embed or a sound through
 * callbacks on each editor (`ProposalEditorCallbacks`); this wires every
 * live section editor to the two small dialogs here (pictures from the
 * kit; a YouTube, Vimeo or Loom link), both built from the dialog parts
 * (one anatomy: icon and quiet title, Close, the action at the foot, no
 * Cancel), and routes the editor's undo to the builder's single history.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/media-host
 */

type Asking = { kind: 'image' | 'embed'; editor: Editor } | null;

/** The host; render once inside the editor. */
export function MediaHost({ builder }: { builder: DocEditor }) {
  const editors = useRegisteredEditors();
  const [asking, setAsking] = useState<Asking>(null);
  const [url, setUrl] = useState('');
  const photos = usePhotos();
  const { undo, redo } = builder;
  useEffect(() => {
    for (const editor of editors)
      editor.commands.setProposalEditorCallbacks({
        requestImage: () => setAsking({ kind: 'image', editor }),
        requestEmbed: () => {
          setUrl('');
          setAsking({ kind: 'embed', editor });
        },
        undo,
        redo,
      });
  }, [editors, undo, redo]);
  const close = () => setAsking(null);
  const putImage = (src: string) => {
    if (asking) insertAtomNode(asking.editor, 'image', { src, alt: '', layout: 'inline', widthPct: 100 });
    close();
  };
  const provider = detectEmbedProvider(url.trim());
  return (
    <>
      <Dialog open={asking?.kind === 'image'} onClose={close} size="form" aria-labelledby="pick-picture">
        <DialogHeader id="pick-picture" icon={PhotosIcon} title="Add a picture" />
        <DialogBody>
          <PhotoGrid photos={photos} onPick={putImage} />
        </DialogBody>
      </Dialog>
      <Dialog open={asking?.kind === 'embed'} onClose={close} size="form" aria-labelledby="embed-video">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!asking || !provider) return;
            asking.editor.chain().focus().setEmbed(url.trim()).run();
            close();
          }}
        >
          <DialogHeader id="embed-video" icon={VideoIcon} title="Embed a video" />
          <DialogBody>
            <Input
              icon={LinkIcon}
              label="Link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              help={url.trim() && !provider ? 'Paste a YouTube, Vimeo or Loom link.' : 'YouTube, Vimeo or Loom.'}
              data-autofocus
            />
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={!provider}>
              Embed
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
