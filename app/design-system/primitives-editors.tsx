'use client';

import type { Editor, JSONContent } from '@tiptap/react';
import { useState } from 'react';

import { ScriptEditor } from '@/components/documents/script-editor';
import { ScriptToolbar } from '@/components/documents/script-toolbar';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { AudioPlayButton } from '@/components/ui/audio-play-button';
import { ColorPopover } from '@/components/ui/color-popover';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SignatureEditor } from '@/components/ui/signature-editor';
import { SignaturePad } from '@/components/ui/signature-pad';

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
      <Spec name="RichTextEditor" file="components/ui/rich-text-editor.tsx"
        importPath="@/components/ui/rich-text-editor" description="TipTap-backed. Optional variable mentions, signature block and dense mode.">
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

      <Spec name="SignatureEditor" file="components/ui/signature-editor.tsx"
        importPath="@/components/ui/signature-editor" description="A constrained RichTextEditor for email sign-offs.">
        <SignatureEditor value={sig} onChange={setSig} />
      </Spec>

      <Spec name="ColorPopover" file="components/ui/color-popover.tsx"
        importPath="@/components/ui/color-popover" description="Saturation/value field, hue slider and swatch row behind a caller-supplied trigger.">
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
          <code className="text-body text-text-muted">{colour}</code>
        </div>
      </Spec>

      <Spec name="AddressAutocomplete" file="components/ui/address-autocomplete.tsx"
        importPath="@/components/ui/address-autocomplete" description="Google Places lookup returning text plus lat/lng. Suggestions appear after typing.">
        <AddressAutocomplete
          label="Venue address"
          placeholder="Start typing a venue"
          value={address}
          onChange={(next) => setAddress(next.text)}
        />
      </Spec>

      <Spec name="AudioPlayButton" file="components/ui/audio-play-button.tsx"
        importPath="@/components/ui/audio-play-button" description="Play/pause toggle for pronunciation clips. Idle and playing classes are caller-supplied.">
        <div className="flex items-center gap-3">
          <AudioPlayButton src={SILENT_WAV} label="Play name" playingLabel="Playing" />
          <span className="text-body text-text-subtle">
            wired to a silent clip, so the toggle runs without audio
          </span>
        </div>
      </Spec>

      <Spec name="SignaturePad" file="components/ui/signature-pad.tsx"
        importPath="@/components/ui/signature-pad"
        description="Canvas a person draws their signature on, exported as a base64 PNG data URL. Pointer events with setPointerCapture (a stroke that leaves the canvas keeps tracking) and touch-action:none (a finger draws instead of scrolling the page) are what make it usable on a phone, which is where most couples sign. A gesture under 24px of total travel counts as empty, so a stray tap cannot pass as a signature. Appearance is injectable: omit it in-app to get the tokens below, or pass the MC's brand colours on the public contract page.">
        <SignaturePadDemo />
      </Spec>

      <Spec name="ScriptEditor + ScriptToolbar" file="components/documents/script-editor.tsx"
        importPath="@/components/documents/script-editor"
        description="The couple-script writing surface: TipTap on the branding schema plus a page-break block, driven by the fixed Word-style toolbar. Base font is Noto Serif with the Noto CJK fallbacks, so diacritics and CJK text render. The font Select (restoreFocus off, each face shown in itself) applies a per-selection family; colours are ColorPopover with a colour bar under the glyph; size steps A-/A+ through a ladder; the omega menu inserts accented letters. No block-style menu: a heading is bigger, bolder text. Every control has a tooltip.">
        <ScriptEditorDemo />
      </Spec>
    </>
  );
}

/** A short bilingual ceremony fragment: heading, chip, highlight, page break, Greek and Cyrillic. */
const SCRIPT_DOC: JSONContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The asking' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Do you, Nguyễn Thị Ánh, take Đặng Văn Minh (阮氏映) to be your ' },
        { type: 'text', text: 'lawful wedded partner', marks: [{ type: 'highlight', attrs: { color: '#FEF08A' } }] },
        { type: 'text', text: '?' },
      ],
    },
    { type: 'pageBreak' },
    { type: 'paragraph', content: [{ type: 'text', text: 'Ελένη, Дмитрий: pause, then the rings.' }] },
  ],
};

function ScriptEditorDemo() {
  const [value, setValue] = useState<JSONContent>(SCRIPT_DOC);
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {editor ? <ScriptToolbar editor={editor} /> : null}
      <div className="max-h-72 overflow-y-auto rounded-control border border-border bg-surface px-4 py-3">
        <ScriptEditor value={value} onChange={setValue} font="noto_serif" onEditorReady={setEditor} />
      </div>
    </div>
  );
}

/** SignaturePad wired to local state, with a readout of what it exports. */
function SignaturePadDemo() {
  const [signature, setSignature] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <SignaturePad value={signature} onChange={setSignature} />
      <p className="text-body text-text-subtle">
        {signature
          ? `exports a PNG data URL, ${(signature.length / 1024).toFixed(1)}KB of base64 (cap 128KB)`
          : 'draw above — a tap alone stays empty'}
      </p>
    </div>
  );
}
