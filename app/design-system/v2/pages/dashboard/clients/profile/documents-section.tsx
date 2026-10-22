'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui-v2/button';

import { useAccount } from '../../account';
import { ZebriSays } from '../../first-use/zebri-says';
import { RunSheetDialog } from '../../home/run-sheet-dialog';
import { useRunSheet } from '../../home/run-sheet-store';
import { ScriptDialog } from '../../scripts/script-dialog';

import { DocDetail } from './doc-detail';
import { DocRow } from './doc-row';
import { NewDocumentMenu } from './new-document-menu';
import type { Doc, Profile } from './profile-data';
import { GUTTER, TOP } from './profile-header';
import { introFor, runSheetAction, withSheet } from './run-sheet-doc';
import { RUN_SHEET_DOC } from './run-sheet-doc-seed';
import { ProfileGroup } from './section-frame';
import { usePaperworkDocs } from './use-paperwork-docs';
import { useQuestionnaireDocs } from './use-questionnaire-docs';
import { useScriptDocs } from './use-script-docs';

/**
 * Every document for the client in one column (2026-10-09 founder
 * mockup): what the journey sent (proposal, contract, invoices), then
 * the MC's own (run sheet, scripts, questionnaires, paperwork), then
 * what other people shared. Each row is the document, where it stands
 * and its date, on one line (`DocRow`); one with an editor of its own
 * opens it, any other opens its details under itself. Replaces seven of
 * the current app's tabs.
 *
 * The run sheet is one of these documents (there is no Run sheets page):
 * every booked client has one, drawn from the shared sheet, and New
 * document > Run sheet starts one for anyone else. It opens in the run
 * sheet dialog, over the profile. An account without the Run sheets
 * block shows none of it. Scripts work the same way (each booked client
 * has one to write; New document > Script adds another, or starts the
 * first for anyone else), opening in the script dialog. Questionnaires
 * show once sent (New document > Questionnaire), opening in theirs.
 * With the Lodge with BDM block, a booked couple's marriage paperwork
 * is here too, opening in the paperwork dialog.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/documents-section
 */

/** Run sheets, scripts, questionnaires and paperwork open in their own editor, not under the row. */
const hasEditor = (d: Doc) => Boolean(d.runSheet || d.scriptId || d.questionnaireId || d.paperwork);

/** Where a document came from: the journey's sends, what the MC made, or what others shared. */
type Source = 'journey' | 'yours' | 'shared';

const GROUPS: { title: string; source: Source }[] = [
  { title: 'From the journey', source: 'journey' },
  { title: 'Yours', source: 'yours' },
  { title: 'Shared with you', source: 'shared' },
];

/** Proposals, contracts and invoices go out with the journey; run sheets, scripts, forms and paperwork are the MC's own. */
const sourceOf = (d: Doc): Source =>
  d.group === 'shared'
    ? 'shared'
    : d.runSheet || d.scriptId || d.questionnaireId || d.paperwork
      ? 'yours'
      : 'journey';

export interface DocumentsSectionProps {
  profile: Profile;
  /** "Sarah & Tom": whose run sheet this is. */
  client: string;
  /** Open on this document rather than the first. */
  initialDoc?: string | undefined;
  /** Zebri's line on the run sheet: the MC was brought here to meet it. */
  intro?: boolean | undefined;
  /** The header's slot beside More: Upload and New document go there from md up. */
  slot?: HTMLDivElement | null | undefined;
}

/** The Documents section. See {@link DocumentsSectionProps}. */
export function DocumentsSection({
  profile,
  client,
  initialDoc,
  intro = false,
  slot = null,
}: DocumentsSectionProps) {
  const runSheets = useAccount().runSheets !== false;
  const sheet = useRunSheet(client);
  const [started, setStarted] = useState(false);
  const has = profile.docs.some((d) => d.runSheet);
  // Opens on the document asked for (the run sheet, from Show me); otherwise all shut.
  const [picked, setPicked] = useState<string | null | undefined>(initialDoc);
  const scripts = useScriptDocs(client, has, setPicked);
  const forms = useQuestionnaireDocs(client, setPicked);
  const paperwork = usePaperworkDocs(client, setPicked);
  const docs = [
    ...paperwork.docs,
    ...forms.docs,
    ...scripts.docs,
    ...(has || !started ? profile.docs : [RUN_SHEET_DOC, ...profile.docs])
      .filter((d) => runSheets || !d.runSheet)
      .map((d) => (d.runSheet ? withSheet(d, sheet, client) : d)),
  ];
  // Counts openings, so each one starts fresh; 0 is shut.
  const [editing, setEditing] = useState(0);
  const open = () => setEditing((n) => n + 1);
  // A document with an editor opens it; any other opens its details under the row.
  const openDoc = (d: Doc) => {
    if (paperwork.openDoc(d) || forms.openDoc(d) || scripts.openDoc(d)) return;
    if (d.runSheet) return open();
    setPicked(d.id === picked ? null : d.id);
  };
  const action = (d: Doc) =>
    d.runSheet ? runSheetAction(sheet, client) : (paperwork.action(d) ?? forms.action(d));
  // Only what is known: "Date to come · Venue to come" under a title reads as noise.
  const when = [profile.event.date, profile.event.venue]
    .filter((s) => !s.endsWith('to come'))
    .join(' · ');
  // Upload and New document: in the header's top bar from md up, beside More; on a phone, here above the list.
  const actions = (
    <>
      <Button variant="secondary">Upload</Button>
      <NewDocumentMenu
        runSheets={runSheets}
        scripts={scripts.on}
        paperwork={paperwork.on}
        onPaperwork={paperwork.start}
        onRunSheet={() => (setStarted(true), setPicked(RUN_SHEET_DOC.id), open())}
        onScript={scripts.start}
        onQuestionnaire={forms.start}
      />
    </>
  );
  return (
    <>
      {slot ? createPortal(actions, slot) : null}
      <div className="min-h-0 flex-1 overflow-y-auto motion-safe:animate-fade-in">
        <div className={`space-y-8 pb-28 ${TOP} ${GUTTER}`}>
          {/* No "2 documents" line: the rail's count and the group headings
              say it (user, 2026-10-15). On a phone the actions sit here. */}
          <div className={slot ? 'flex gap-2 md:hidden' : 'flex gap-2'}>{actions}</div>
          {/* The first time the MC is brought here to meet the run sheet (Show me). */}
          {intro && runSheets ? <ZebriSays text={introFor(sheet, client)} /> : null}
          {GROUPS.map(({ title, source }) => {
            const list = docs.filter((d) => sourceOf(d) === source);
            return list.length ? (
              <ProfileGroup key={source} title={title}>
                <ul className="-mx-3">
                  {list.map((d) => (
                    <DocRow
                      key={d.id}
                      doc={d}
                      onOpen={() => openDoc(d)}
                      action={action(d)}
                      open={!hasEditor(d) && d.id === picked}
                      detail={<DocDetail doc={d} />}
                    />
                  ))}
                </ul>
              </ProfileGroup>
            ) : null;
          })}
        </div>
      </div>
      <RunSheetDialog
        key={editing}
        open={editing > 0}
        client={client}
        when={when}
        onClose={() => setEditing(0)}
      />
      <ScriptDialog
        key={scripts.writing ?? 'shut'}
        client={client}
        scriptId={scripts.writing}
        when={when}
        onClose={scripts.close}
      />
      {forms.dialogs}
      {paperwork.dialog}
    </>
  );
}
