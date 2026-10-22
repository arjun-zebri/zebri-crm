'use client';

import type { JSONContent } from '@tiptap/core';

import { useScriptFonts } from '@/components/documents/use-script-fonts';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { CeremonyScriptIcon } from '@/components/ui-v2/icons';
import { collectScriptFonts, DEFAULT_SCRIPT_FONT } from '@/lib/documents/script-fonts';

import { ScriptFieldsContext } from '../../scripts/script-nodes';
import { ScriptPage, useScriptEditor } from '../../scripts/script-page';
import { ScriptSide } from '../../scripts/script-side';
import { ScriptToolbar } from '../../scripts/script-toolbar';
import type { ScriptField } from '../../scripts/scripts-data';

import { BlockImageFrame, SCENE_CARD } from './block-image-frame';

/**
 * Ceremony scripts product image (block id `scripts`): Lian and Freya's
 * ceremony script on the real script workspace (the real toolbar and
 * TipTap page), in English and Chinese, their names, the MC and the venue
 * dropped in as fields, with the script's real "Their details" panel
 * lifted onto a card in front. Both laid out at real width and shrunk to
 * half, as the Run sheets image is.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/scripts
 */

const none = () => undefined;

const FIELDS: ScriptField[] = [
  { id: 'person_1', label: 'Person 1', value: 'Lian', group: 'client' },
  { id: 'person_2', label: 'Person 2', value: 'Freya', group: 'client' },
  { id: 'mc', label: 'You', value: 'Daniel Reyes', group: 'client' },
  { id: 'date', label: 'Date', value: 'Sat 17 Apr 2027', group: 'event' },
  { id: 'start', label: 'Starts', value: '3:30 pm', group: 'event' },
  { id: 'venue', label: 'Venue', value: 'Quamby Estate', group: 'event' },
  { id: 'q_say', label: 'How do you say your names?', value: 'LEE-an and FRAY-a', group: 'answers' },
  { id: 'q_reading', label: 'Who is giving a reading?', value: "Lian's sister, Jing", group: 'answers' },
  { id: 'who_photographer', label: 'Photographer', value: 'Hannah Cho', group: 'people' },
];

const v = (id: string): JSONContent => ({ type: 'variable', attrs: { id } });
const t = (text: string, bold = false): JSONContent => ({ type: 'text', text, ...(bold ? { marks: [{ type: 'bold' }] } : {}) });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });

const SCRIPT: JSONContent = {
  type: 'doc',
  content: [
    p(t('Welcome', true)),
    p(t('Good afternoon everyone, and welcome to '), v('venue'), t('. My name is '), v('mc'), t(', and it is my honour to marry '), v('person_1'), t(' and '), v('person_2'), t(' today.')),
    p(t('各位来宾，下午好！欢迎大家来到'), v('venue'), t('，见证'), v('person_1'), t('和'), v('person_2'), t('的婚礼。')),
    p(t('The reading', true)),
    p(t("I'd now like to invite "), v('q_reading'), t(' to share a reading chosen by the couple.')),
  ],
};

/** The script workspace's left side: the quiet label, the name, the client line, the toolbar and the page. */
function Writing({ className }: { className: string }) {
  const editor = useScriptEditor(SCRIPT, none);
  useScriptFonts(collectScriptFonts(SCRIPT, DEFAULT_SCRIPT_FONT));
  return (
    <ScriptFieldsContext.Provider value={FIELDS}>
      <div className={`${SCENE_CARD} ${className}`}>
        <div className="space-y-6 px-10 pb-4 pt-10">
          <div className="flex items-center gap-2">
            <IconCircle icon={CeremonyScriptIcon} />
            <p className="type-label text-zebra-500">Script</p>
          </div>
          <div className="space-y-1">
            <p className="type-display text-zebra-950">Ceremony script</p>
            <p className="type-body text-zebra-500">Lian & Freya · Sat 17 Apr 2027 · Quamby Estate</p>
          </div>
          <ScriptToolbar editor={editor} font={DEFAULT_SCRIPT_FONT} onFont={none} />
        </div>
        {/* The page's own side padding is sm:px-10, which follows the viewport; pin it. */}
        <div className="[&_.ProseMirror]:px-10">
          <ScriptPage editor={editor} font={DEFAULT_SCRIPT_FONT} />
        </div>
      </div>
    </ScriptFieldsContext.Provider>
  );
}

/**
 * Their details, the script's side panel, lifted onto its own card, with
 * no rule. It used to hide the panel's first child, then a close row;
 * the panel no longer has one, so that hid the details themselves and
 * left the card blank but for Print (user, 2026-10-19).
 */
function Details({ className }: { className: string }) {
  return (
    <div className={`${SCENE_CARD} ${className} [&>aside]:w-full [&>aside]:border-0`}>
      <ScriptSide fields={FIELDS} empty={false} onInsert={none} onPrint={none} onClose={none} />
    </div>
  );
}

/** Ceremony scripts block image. */
export function ScriptsImage() {
  return (
    <BlockImageFrame alt="Lian and Freya's ceremony script in English and Chinese with their names filled in, and their details on a card in front.">
      <Writing className="left-8 top-6 h-[38rem] w-[34rem] origin-top-left scale-[0.5]" />
      <Details className="right-5 top-16 h-[34rem] w-[25rem] origin-top-right scale-[0.5] shadow-md" />
    </BlockImageFrame>
  );
}
