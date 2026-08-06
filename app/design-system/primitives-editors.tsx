'use client';

import type { JSONContent } from '@tiptap/react';
import { useState } from 'react';

import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { AudioPlayButton } from '@/components/ui/audio-play-button';
import { ColorPopover } from '@/components/ui/color-popover';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SignatureEditor } from '@/components/ui/signature-editor';

import { Conflict } from './conflict';
import { Demo, DemoGrid, Spec } from './showroom';

/**
 * Editor and input-adjacent primitives: rich text, signature, colour,
 * address autocomplete and the audio play button.
 *
 * @module app/design-system/primitives-editors
 */

/** Seed document for the rich-text demo. */
const DOC: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hi Alex and Sam, thanks for getting in touch.' }],
    },
  ],
};

/**
 * A valid, empty WAV. AudioPlayButton needs a real `src`: passing `""`
 * makes the browser re-request the whole page and React logs a warning.
 */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';

const VARIABLES = [
  { id: 'couple_name', label: 'Couple name', description: 'Both first names' },
  { id: 'event_date', label: 'Event date', description: 'The wedding date' },
  { id: 'venue', label: 'Venue', description: 'Ceremony venue name' },
] as const;

/** Editor primitives with their configuration variants. */
export function PrimitivesEditors() {
  const [doc, setDoc] = useState<JSONContent>(DOC);
  const [sig, setSig] = useState<JSONContent>({ type: 'doc', content: [] });
  const [colour, setColour] = useState('#7c3aed');
  const [address, setAddress] = useState('');

  return (
    <>
      <Spec name="RichTextEditor" file="components/ui/rich-text-editor.tsx" description="TipTap-backed. Optional variable mentions, signature block and dense mode.">
        <DemoGrid cols={2}>
          <Demo label="Default, with variable inserter">
            <RichTextEditor
              value={doc}
              onChange={setDoc}
              variables={VARIABLES}
              showVariableInserter
              placeholder="Write your email"
            />
          </Demo>
          <Demo label="dense, read only">
            <RichTextEditor value={doc} onChange={setDoc} dense editable={false} />
          </Demo>
        </DemoGrid>
      </Spec>

      <Spec name="SignatureEditor" file="components/ui/signature-editor.tsx" description="A constrained RichTextEditor for email sign-offs.">
        <SignatureEditor value={sig} onChange={setSig} />
      </Spec>

      <Conflict
        title="Two rich-text surfaces with separate toolbars"
        recommendation={
          <>
            <code>rich-text-editor.tsx</code> and <code>signature-toolbar.tsx</code> each build
            their own toolbar button, so the same bold control exists twice with different padding
            and hover states. Extract one shared toolbar button and have both import it.
          </>
        }
      />

      <Spec name="ColorPopover" file="components/ui/color-popover.tsx" description="Saturation/value field, hue slider and swatch row behind a caller-supplied trigger.">
        <div className="flex items-center gap-3">
          <ColorPopover
            value={colour}
            onChange={setColour}
            trigger={
              <button
                type="button"
                className="h-8 w-8 cursor-pointer rounded-control border border-border"
                style={{ backgroundColor: colour }}
                aria-label="Pick a colour"
              />
            }
          />
          <code className="text-caption text-text-muted">{colour}</code>
        </div>
      </Spec>

      <Conflict
        title="ColorPopover takes a caller-supplied trigger, so every call site styles its own swatch"
        recommendation={
          <>
            The <code>trigger</code> prop is a raw <code>ReactNode</code> with no default, which is
            why swatch triggers in Branding, the time-category rows and the questionnaire editor all
            differ in size and radius. Ship a default trigger and let callers override only when
            they need to.
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-8 w-8 rounded-control border border-border" style={{ backgroundColor: colour }} />
          <span className="h-6 w-6 rounded-full border border-border" style={{ backgroundColor: colour }} />
          <span className="h-5 w-5 rounded border border-border" style={{ backgroundColor: colour }} />
          <span className="text-caption text-text-subtle">
            three trigger shapes found across call sites
          </span>
        </div>
      </Conflict>

      <Spec name="AddressAutocomplete" file="components/ui/address-autocomplete.tsx" description="Google Places lookup returning text plus lat/lng. Suggestions appear after typing.">
        <AddressAutocomplete
          label="Venue address"
          placeholder="Start typing a venue"
          value={address}
          onChange={(next) => setAddress(next.text)}
        />
      </Spec>

      <Spec name="AudioPlayButton" file="components/ui/audio-play-button.tsx" description="Play/pause toggle for pronunciation clips. Idle and playing classes are caller-supplied.">
        <div className="flex items-center gap-3">
          <AudioPlayButton src={SILENT_WAV} label="Play name" playingLabel="Playing" />
          <span className="text-caption text-text-subtle">
            wired to a silent clip, so the toggle runs without audio
          </span>
        </div>
      </Spec>
    </>
  );
}
