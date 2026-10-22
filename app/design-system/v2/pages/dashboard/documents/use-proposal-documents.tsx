'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { useAccount, type ProposalDraft } from '../account';
import { clientName } from '../clients/clients-data';
import { draftKey, clearDraft } from '../doc-builder/doc-types/proposal/drafts';
import { choiceOf, createTemplate } from '../doc-builder/doc-types/proposal/template-store';
import { useTemplateChoices } from '../doc-builder/doc-types/proposal/template-store';
import { isoOf } from '../doc-builder/model/doc-data';
import { kept } from '../doc-builder/state/kept';
import { isTestClient } from '../first-run/derive';
import { TODAY, addDays } from '../payments/dates';
import { FirstProposal } from '../proposals/editor/first-proposal';
import { ProposalEditor, type EditingSent } from '../proposals/editor/proposal-editor';
import { TemplateEditor } from '../proposals/editor/template-editor';
import { templateStats } from '../proposals/insights';
import { NewProposalDialog } from '../proposals/new/new-proposal-dialog';
import type { ProposalSeed } from '../proposals/proposals-data';
import { ReadySheet } from '../proposals/ready/ready-sheet';
import { NewTemplateDialog } from '../proposals/templates/new-template-dialog';
import { TemplateDialog } from '../proposals/templates/template-dialog';
import { packagesOf } from '../proposals/templates-data';
import { useProposalsState } from '../proposals/use-proposals-state';

import type { TemplateRow } from './kind-section';

/**
 * Proposals, as one kind of document on the Documents page: a row per
 * template (opening its preview, which holds Edit and Use for a couple),
 * and every dialog it opens (New proposal, the template preview, Ready
 * to send, the proposal editor, the template editor, New template). The
 * page composes these; the state lives here. Sent proposals are opened
 * from the client they went to, not from here.
 *
 * The preview has no server, so what is sent or
 * changed here is kept in this browser per account (`kept`), and a
 * reload still shows it.
 *
 * @module app/design-system/v2/pages/dashboard/documents/use-proposal-documents
 */

/** Proposals sent or changed in the preview, per account (keyed by business name). */
const SENT = kept<ProposalSeed[]>('zebri-v2-sent-proposals');
const NONE: ProposalSeed[] = [];

export interface ProposalDocumentsArgs {
  /** Opens on New proposal: with this client (display name) picked, or none (`true`). */
  startNew?: string | true | undefined;
  /** A proposal was just sent from the editor. */
  onSent?: (() => void) | undefined;
}

/** Proposals for the Documents page. See {@link ProposalDocumentsArgs}. */
export function useProposalDocuments({ startNew, onSent }: ProposalDocumentsArgs) {
  const choices = useTemplateChoices();
  // A client already named skips New proposal and opens Ready to send on the first template.
  const [creating, setCreating] = useState<{ template: string | null } | null>(startNew === true ? { template: null } : null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  // The proposal open: who for (and their typed names, when new), the template key, the sent proposal being changed, and
  // whether it shows Ready to send or the whole editor (Customise the page), which share one draft.
  const [editing, setEditing] = useState<{ couple: string; names: [string, string] | undefined; template: string; editing?: EditingSent; id?: string; stage: 'ready' | 'customise' } | null>(
    typeof startNew === 'string' && choices[0] ? { couple: startNew, names: undefined, template: choices[0].key, stage: 'ready' } : null,
  );
  const account = useAccount();
  // What was sent or changed here, kept per account so one account's sends never show in another's list.
  const owner = account.business;
  const local = useSyncExternalStore(SENT.subscribe, () => SENT.read(owner) ?? NONE, () => NONE);
  const keepLocal = (fn: (list: ProposalSeed[]) => ProposalSeed[]) => SENT.write(owner, fn(SENT.read(owner) ?? NONE));
  // A seed changed here replaces the account's own; a new one joins the list.
  const seeds = useMemo(() => {
    const byId = new Map(local.map((p) => [p.id, p]));
    const own = account.proposals.map((p) => byId.get(p.id) ?? p);
    return [...own, ...local.filter((p) => !account.proposals.some((o) => o.id === p.id))];
  }, [account.proposals, local]);
  const state = useProposalsState(seeds);
  // The previews and thumbnails set the MC's brand fonts, which only the brand editors load.
  useEffect(() => ensureBrandFontsStylesheet(), []);

  // The event a proposal in the editor is for, as the page writes it.
  const weddingFor = (couple: string) => {
    const c = account.clients.find((x) => clientName(x) === couple);
    return { couple, greet: couple.replace(' & ', ' and '), date: c?.date ?? 'Date to come', venue: c?.venue ?? 'Venue to come' };
  };
  const rows: TemplateRow[] = choices.map((c) => {
    const n = packagesOf(c.template).length;
    const s = c.custom ? { sent: 0, rate: null } : templateStats(state.proposals, c.template.id);
    return {
      key: c.key,
      name: c.template.name,
      // The first clause of when to use it, so the line stays one line beside the package count.
      detail: `${c.template.use.split(',')[0]} · ${n} ${n === 1 ? 'package' : 'packages'}`,
      note: s.sent ? `Sent ${s.sent === 1 ? 'once' : `${s.sent} times`}${s.rate === null ? '' : ` · ${s.rate}% accepted`}` : 'Not sent yet',
      onOpen: () => setPreviewing(c.key),
    };
  });

  // Whether the open proposal is for the practice run's test client.
  const editingClient = editing ? account.clients.find((x) => clientName(x) === editing.couple) : undefined;
  const practice = editingClient ? isTestClient(editingClient.id) : false;

  const editTemplate = (key: string) => (setPreviewing(null), setEditingTemplate(key));
  // A send from the editor: a change to a sent proposal replaces it; a new one joins Sent.
  const sendFromEditor = (draft: ProposalDraft) => {
    if (!editing) return;
    const c = account.clients.find((x) => clientName(x) === editing.couple);
    const names: [string, string] = c?.names ?? editing.names ?? [editing.couple, ''];
    if (editing.id) {
      const before = seeds.find((p) => p.id === editing.id);
      if (before) {
        const changed: ProposalSeed = { ...before, offer: draft.offer, composed: draft.composed, history: [{ when: 'Today', text: 'Changed and sent again' }, ...before.history] };
        keepLocal((list) => [...list.filter((p) => p.id !== changed.id), changed]);
      }
      setEditing(null);
      return onSent?.();
    }
    const { addClient, sendProposal } = account;
    if (sendProposal && addClient) {
      // Someone new is added as a client first, as the real flow would.
      const id = c?.id ?? addClient({ names, email: '', date: '', venue: '' });
      sendProposal(id, draft);
    } else {
      // The seeded demo has no account to send through: the proposal joins Sent here.
      keepLocal((list) => [
        ...list,
        {
          id: `sent-${Date.now()}`,
          names,
          template: draft.template,
          event: c?.date ? isoOf(c.date) : addDays(TODAY, 180),
          venue: c?.venue ?? 'Venue to come',
          createdOn: TODAY,
          sentOn: TODAY,
          expiresOn: addDays(TODAY, 14),
          offer: draft.offer,
          composed: draft.composed,
          history: [{ when: 'Today', text: `Sent to ${editing.couple}` }],
        },
      ]);
    }
    setEditing(null);
    onSent?.();
  };

  const dialogs = (
    <>
      <TemplateDialog id={previewing} proposals={state.proposals} onUse={(t) => setCreating({ template: t })} onEdit={editTemplate} onClose={() => setPreviewing(null)} />
      <NewProposalDialog
        key={creating ? `new-${creating.template ?? 'none'}` : 'closed'}
        open={creating !== null}
        template={creating?.template ?? null}
        onClose={() => setCreating(null)}
        onCreate={(couple, t, names) => {
          setCreating(null);
          setPreviewing(null);
          setEditing({ couple, names, template: t, stage: 'ready' });
        }}
      />
      {/* The practice run's first proposal opens on the original page with Make it yours (founder, 2026-10-08). */}
      {editing?.stage === 'ready' && practice ? (
        <FirstProposal
          key={`first-${editing.couple}`}
          target={{ couple: editing.couple, wedding: weddingFor(editing.couple), template: choiceOf(editing.template).template.id }}
          onClose={() => setEditing(null)}
          onSend={(draft) => (clearDraft(draftKey(editing.couple, editing.template)), sendFromEditor(draft))}
        />
      ) : null}
      {editing?.stage === 'ready' && !practice ? (
        <ReadySheet
          key={`ready-${editing.id ?? editing.couple}-${editing.template}`}
          target={{ ...editing, wedding: weddingFor(editing.couple) }}
          onTemplate={(template) => setEditing({ ...editing, template })}
          onCustomise={() => setEditing({ ...editing, stage: 'customise' })}
          onSend={(message, page) => {
            clearDraft(editing.id ? `sent|${editing.id}` : draftKey(editing.couple, editing.template));
            sendFromEditor({ template: choiceOf(editing.template).template.id, headline: '', welcome: message, offer: page.offer, composed: page.composed });
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ProposalEditor
        key={editing ? `editor-${editing.id ?? editing.couple}-${editing.template}` : 'editor-closed'}
        target={editing?.stage === 'customise' ? { ...editing, wedding: weddingFor(editing.couple) } : null}
        onClose={() => editing && setEditing({ ...editing, stage: 'ready' })}
      />
      <TemplateEditor
        key={editingTemplate ?? 'template-closed'}
        id={editingTemplate}
        onClose={() => setEditingTemplate(null)}
        // Use template: the editor shuts and New proposal asks who it is for, as from the template's preview.
        onUse={(t) => (setEditingTemplate(null), setCreating({ template: t }))}
      />
      <NewTemplateDialog
        key={naming ? 'naming' : 'naming-closed'}
        open={naming}
        onClose={() => setNaming(false)}
        onCreate={(name, base) => {
          setNaming(false);
          setEditingTemplate(createTemplate(name, base));
        }}
      />
    </>
  );

  return {
    rows,
    newDocument: () => setCreating({ template: null }),
    newTemplate: () => setNaming(true),
    dialogs,
  };
}
