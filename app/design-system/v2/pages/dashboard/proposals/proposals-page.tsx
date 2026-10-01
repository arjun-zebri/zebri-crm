'use client';

import { useDeferredValue, useEffect, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Panel } from '@/components/ui-v2/panel';
import { RowSections } from '@/components/ui-v2/row-sections';
import { Tabs, tabId } from '@/components/ui-v2/tabs';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { useAccount } from '../account';
import { clientName } from '../clients/clients-data';
import { EmptyState } from '../empty-state';
import { PageBar } from '../page-bar';
import { coupleName, money, unfolded } from '../payments/payments-data';
import { PRESETS, type Range } from '../payments/reports-data';

import { ProposalEditor } from './editor/proposal-editor';
import { BuilderStub, type StubFor } from './modal/builder-stub';
import { ProposalModal } from './modal/proposal-modal';
import { NewProposalDialog } from './new/new-proposal-dialog';
import { OverviewView } from './overview/overview-view';
import { ProposalRow } from './proposal-row';
import { PROPOSAL_GROUPS } from './proposals-data';
import { ProposalsToolbar, type Tab } from './proposals-toolbar';
import { TemplateDialog } from './templates/template-dialog';
import { TemplatesView } from './templates/templates-view';
import { templateOf, type TemplateId } from './templates-data';
import { useProposalsState } from './use-proposals-state';

/**
 * The v2 Proposals page, shown when Proposals is picked in the dashboard
 * sidebar, behind three tabs. Overview comes first and answers "how is
 * selling going?", laid out as the Payments Overview: the period's
 * figures, the sent-to-booked chart, and beside it a What's next rail of
 * who opened and has not accepted (to nudge) and what is about to expire. Proposals is every proposal in sections by what needs
 * the MC (opened first, settled ones folded away); a row opens the
 * proposal in a modal as the couple sees it. Templates shows each
 * template with how it converts. Chrome is two lines, as on Payments.
 * New, Edit and the builder open a "coming soon" stub; for an account
 * that can send (`useAccount`), the stub after New proposal sends the
 * template as it is. The proposals are the account's: the demo
 * business by default, and a new account with none sees an empty state.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/proposals-page
 */

const TAB_ID = 'proposals-tab';

export interface ProposalsPageProps {
  heading?: 'h1' | 'h2';
  /** The dashboard's top-right icons, at the end of the title row. */
  actions?: ReactNode;
  /** The tab to open on (Home's counts lead straight to a list); Overview by default. */
  initialTab?: Tab | undefined;
  /** Opens on New proposal: with this client (display name) picked for Home's to-do, or none (`true`) for a quick start. */
  startNew?: string | true | undefined;
}

/** The Proposals page. See {@link ProposalsPageProps}. */
export function ProposalsPage({ heading: Heading = 'h1', actions, initialTab = 'overview', startNew }: ProposalsPageProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<Range>(PRESETS[0]!);
  const [open, setOpen] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [creating, setCreating] = useState<{ template: TemplateId | null; couple?: string } | null>(
    startNew ? { template: null, ...(typeof startNew === 'string' ? { couple: startNew } : {}) } : null,
  );
  const [previewing, setPreviewing] = useState<TemplateId | null>(null);
  const [stub, setStub] = useState<StubFor | null>(null);
  // The editor, for an account that can send: who for (and their typed names, when new) and the template.
  const [editing, setEditing] = useState<{ couple: string; names: [string, string] | undefined; template: TemplateId } | null>(null);
  const account = useAccount();
  const state = useProposalsState(account.proposals);
  const none = account.proposals.length === 0;
  const q = useDeferredValue(query.trim().toLowerCase());
  // The previews and thumbnails set the MC's brand fonts, which only the brand editors load.
  useEffect(() => ensureBrandFontsStylesheet(), []);

  // Newest activity first inside each section.
  const rows = state.proposals
    .filter(
      (p) =>
        q === '' ||
        `${coupleName(p.names)} ${p.venue} ${templateOf(p.template).name}`
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) =>
      (b.lastOpenedOn ?? b.acceptedOn ?? b.sentOn ?? b.createdOn).localeCompare(
        a.lastOpenedOn ?? a.acceptedOn ?? a.sentOn ?? a.createdOn,
      ),
    );
  // The event a proposal in the editor is for, as the page writes it.
  const weddingFor = (couple: string) => {
    const c = account.clients.find((x) => clientName(x) === couple);
    return { couple, greet: couple.replace(' & ', ' and '), date: c?.date ?? 'Date to come', venue: c?.venue ?? 'Venue to come' };
  };
  const waiting = state.proposals.filter((p) => p.group === 'opened').length;
  const openProposal = (id: string, nudge = false) => {
    setOpen(id);
    setComposing(nudge);
  };

  return (
    <section
      aria-labelledby="proposals-title"
      className="flex flex-1 flex-col gap-6 px-3 pb-8 md:py-3 md:pl-5 md:pr-2"
    >
      <PageBar
        title={
          <Heading id="proposals-title" className="type-title text-zebra-950">
            Proposals
          </Heading>
        }
        tabs={
          <Tabs
            id={TAB_ID}
            label="Proposals"
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'proposals', label: 'Proposals', count: waiting },
              { value: 'templates', label: 'Templates' },
            ]}
            value={tab}
            onChange={(t) => {
              setTab(t);
              setQuery('');
            }}
          />
        }
        toolbar={
          <ProposalsToolbar
            tab={tab}
            query={query}
            onQuery={setQuery}
            onNew={() =>
              tab === 'templates'
                ? setStub({ title: 'New template', context: 'Starts from your brand and packages' })
                : setCreating({ template: null })
            }
            range={range}
            onRange={setRange}
          />
        }
        actions={actions}
      />
      <div role="tabpanel" aria-labelledby={tabId(TAB_ID, tab)} className="flex flex-1 flex-col">
        {none && tab !== 'templates' ? (
          <EmptyState title="No proposals yet" body="Every proposal you send shows here, with who opened it and what they chose." />
        ) : tab === 'overview' ? (
          <OverviewView
            range={range}
            state={state}
            onOpen={openProposal}
            onViewAll={() => setTab('proposals')}
            onEditTemplate={(t) => setStub({ title: 'Edit template', context: templateOf(t).name })}
          />
        ) : tab === 'templates' ? (
          <TemplatesView proposals={state.proposals} onOpen={setPreviewing} />
        ) : rows.length === 0 ? (
          <Panel className="space-y-3 py-16 text-center">
            <p className="type-body text-zebra-500">Nothing matches that search.</p>
            <Button variant="secondary" onClick={() => setQuery('')}>
              Clear search
            </Button>
          </Panel>
        ) : (
          <RowSections
            sections={unfolded(PROPOSAL_GROUPS, rows.length)}
            items={rows}
            sectionOf={(p) => p.group}
            note={(xs) => money(xs.reduce((s, p) => s + p.value, 0))}
            renderRow={(p) => (
              <ProposalRow
                key={p.id}
                proposal={p}
                onOpen={() => openProposal(p.id)}
                onNudge={() => openProposal(p.id, true)}
              />
            )}
          />
        )}
      </div>
      <ProposalModal
        id={open}
        composing={composing}
        onCompose={setComposing}
        state={state}
        onEdit={(p) =>
          setStub({
            title: `Edit proposal`,
            context: `${coupleName(p.names)} · ${templateOf(p.template).name}`,
          })
        }
        onClose={() => setOpen(null)}
      />
      <TemplateDialog
        id={previewing}
        proposals={state.proposals}
        onUse={(t) => setCreating({ template: t })}
        onEdit={(t) => setStub({ title: 'Edit template', context: templateOf(t).name })}
        onClose={() => setPreviewing(null)}
      />
      <NewProposalDialog
        key={creating ? `new-${creating.template ?? 'none'}` : 'closed'}
        open={creating !== null}
        template={creating?.template ?? null}
        couple={creating?.couple}
        onClose={() => setCreating(null)}
        onCreate={(couple, t, names) => {
          setCreating(null);
          setPreviewing(null);
          if (account.sendProposal) return setEditing({ couple, names, template: t });
          setStub({ title: 'New proposal', context: `${couple} · ${templateOf(t).name}` });
        }}
      />
      <ProposalEditor
        key={editing ? `editor-${editing.couple}-${editing.template}` : 'editor-closed'}
        target={editing ? { ...editing, wedding: weddingFor(editing.couple) } : null}
        onClose={() => setEditing(null)}
        onSend={(draft) => {
          const { addClient, sendProposal } = account;
          if (!editing || !sendProposal || !addClient) return;
          // Someone new is added as a client first, as the real flow would.
          const id =
            account.clients.find((c) => clientName(c) === editing.couple)?.id ??
            addClient({ names: editing.names ?? [editing.couple, ''], email: '', date: '', venue: '' });
          sendProposal(id, draft);
          setEditing(null);
          setTab('proposals');
        }}
      />
      <BuilderStub stub={stub} onClose={() => setStub(null)} />
    </section>
  );
}
