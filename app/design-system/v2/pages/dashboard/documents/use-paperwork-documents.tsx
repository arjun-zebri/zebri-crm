'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';

import { remind, useAllPaperwork } from '../bdm/bdm-store';
import { PaperworkDialog } from '../bdm/paperwork-dialog';
import { useSendForm } from '../bdm/send-form-dialog';
import { lineOf } from '../bdm/status';
import { Spotlight } from '../first-run/spotlight';
import { openSettings } from '../settings/settings-store';

import { RemindAction } from './doc-actions';
import type { TemplateRow } from './kind-section';

/**
 * Marriage paperwork (the Lodge with BDM block) as one kind of document
 * on the Documents page, and where adding the block lands. Unlike the
 * other kinds it has no template: the form is set by the Marriage Act,
 * so its rows are the couples instead, each opening their paperwork; one
 * not sent yet has Send form on its row, one with the couple Remind.
 *
 * Landing here from Blocks (`intro`), the first Send form gets the
 * spotlight: the first thing to do, on the real page.
 * A couple's paperwork starts from them, never from here, so there is no New.
 *
 * @module app/design-system/v2/pages/dashboard/documents/use-paperwork-documents
 */
export function usePaperworkDocuments({ intro = false }: { intro?: boolean } = {}) {
  const papers = useAllPaperwork();
  const [open, setOpen] = useState<string | null>(null);
  const [guiding, setGuiding] = useState(intro);
  const sender = useSendForm();
  const firstDraft = papers.find((p) => p.stage === 'draft');
  const rows: TemplateRow[] = papers.map((p) => ({
    key: `paperwork-${p.client}`,
    name: `${p.names[0]} & ${p.names[1]}`,
    detail: `${p.date} · ${p.venue}`,
    note: lineOf(p),
    onOpen: () => setOpen(p.client),
    action:
      p.stage === 'draft' ? (
        <Button variant="secondary" data-tour={p === firstDraft ? 'bdm-send' : undefined} onClick={() => (sender.open(p.client), setGuiding(false))}>
          Send form
        </Button>
      ) : p.stage === 'sent' ? (
        <RemindAction remindedOn={p.remindedOn} onRemind={() => remind(p.client)} />
      ) : undefined,
  }));
  return {
    rows,
    // No Zebri line on arrival (founder, 2026-10-12): the list and Start here say it.
    lead: null,
    newDocument: () => undefined,
    // Nothing to write: setting up is the celebrant's details BDM needs.
    newTemplate: () => openSettings('lodge-with-bdm'),
    dialogs: (
      <>
        <PaperworkDialog client={open} onClose={() => setOpen(null)} />
        {sender.dialog}
        {guiding && firstDraft ? (
          <Spotlight
            target="bdm-send"
            title="Start here"
            body={`Send ${firstDraft.names[0]} and ${firstDraft.names[1]} their form. Open any couple to see their three steps.`}
            actions={
              <Button variant="secondary" onClick={() => setGuiding(false)}>
                Got it
              </Button>
            }
          />
        ) : null}
      </>
    ),
  };
}
