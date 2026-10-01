'use client';

import { useDeferredValue, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Panel } from '@/components/ui-v2/panel';
import { RowSections } from '@/components/ui-v2/row-sections';
import { Tabs, tabId } from '@/components/ui-v2/tabs';

import { useAccount } from '../account';
import { EmptyState } from '../empty-state';
import { PageBar } from '../page-bar';

import { ContractRow } from './contract-row';
import { InvoiceRow } from './invoice-row';
import { DocumentModal, type OpenDoc } from './modal/document-modal';
import { OverviewView } from './overview/overview-view';
import { CONTRACT_GROUPS, INVOICE_GROUPS, coupleName, money, unfolded } from './payments-data';
import { PaymentsToolbar, type Tab } from './payments-toolbar';
import { PRESETS, type Range } from './reports-data';
import { usePaymentsState } from './use-payments-state';

/**
 * The v2 Payments page, shown when Payments is picked in the dashboard
 * sidebar, behind three tabs. Overview comes first and answers "how am
 * I doing?": the period's figures, cash flow by month, then what is
 * overdue and what is due next, for a period the MC picks (Export gives
 * the accountant the payments and GST as CSV). Invoices and Contracts
 * are sections of rows by what needs the MC (overdue first, settled
 * ones folded away); a row opens the document in a modal as the couple
 * sees it. Chrome is one line (`PageBar`): the title, the tabs, then
 * the toolbar and the dashboard's icons. The invoices and contracts are
 * the account's (`useAccount`): the demo business by default. A new
 * account sees empty states until its first ones go out, and New sends
 * one when the account can.
 *
 * @module app/design-system/v2/pages/dashboard/payments/payments-page
 */

const TAB_ID = 'payments-tab';

export interface PaymentsPageProps {
  heading?: 'h1' | 'h2';
  /** The dashboard's top-right icons, at the end of the title row. */
  actions?: ReactNode;
  /** The tab to open on (Home's counts lead straight to a list); Overview by default. */
  initialTab?: Tab | undefined;
  /** Opens on a new invoice or contract: Home's next move. */
  startNew?: 'invoice' | 'contract' | undefined;
}

/** The Payments page. See {@link PaymentsPageProps}. */
export function PaymentsPage({ heading: Heading = 'h1', actions, initialTab = 'overview', startNew }: PaymentsPageProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<Range>(PRESETS[0]!);
  const [open, setOpen] = useState<OpenDoc | null>(startNew ? { kind: startNew, id: null } : null);
  const [composing, setComposing] = useState(false);
  const account = useAccount();
  const { contracts: allContracts } = account;
  const state = usePaymentsState(account.invoices);
  const q = useDeferredValue(query.trim().toLowerCase());
  const match = (names: [string, string], extra: string) =>
    q === '' || `${coupleName(names)} ${extra}`.toLowerCase().includes(q);

  // Soonest due first; Paid newest first, since the latest payments are the ones checked.
  const invoices = state.invoices
    .filter((i) => match(i.names, `${i.number} ${i.label}`))
    .sort((a, b) => (a.paidOn && b.paidOn ? b.paidOn.localeCompare(a.paidOn) : a.dueOn.localeCompare(b.dueOn)));
  const contracts = allContracts.filter((c) => match(c.names, c.title));
  const overdue = state.invoices.filter((i) => i.group === 'overdue');
  const waiting = allContracts.filter((c) => c.group === 'waiting').length;
  const openDoc = (doc: OpenDoc, compose = false) => {
    setOpen(doc);
    setComposing(compose);
  };
  const empty = tab !== 'overview' && (tab === 'invoices' ? invoices : contracts).length === 0;
  // Nothing of this kind at all, as against nothing matching a search.
  const none =
    tab === 'contracts' ? allContracts.length === 0 : account.invoices.length === 0;
  const NONE = {
    overview: ['Nothing to report yet', 'What you are owed, what came in and what is late, as soon as your first invoice goes out.'],
    invoices: ['No invoices yet', 'Deposits and payments, sorted by what needs you.'],
    contracts: ['No contracts yet', 'Who has signed, and who Zebri is still waiting on.'],
  } as const;

  return (
    <section aria-labelledby="payments-title" className="flex flex-1 flex-col gap-6 px-3 pb-8 md:py-3 md:pl-5 md:pr-2">
      <PageBar
        title={
          <Heading id="payments-title" className="type-title text-zebra-950">
            Payments
          </Heading>
        }
        tabs={
          <Tabs
            id={TAB_ID}
            label="Payments"
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'invoices', label: 'Invoices', count: overdue.length, countOf: { word: 'overdue', tone: 'danger' } },
              { value: 'contracts', label: 'Contracts', count: waiting, countOf: { word: 'waiting on a signature', tone: 'warning' } },
            ]}
            value={tab}
            onChange={(t) => {
              setTab(t);
              setQuery('');
            }}
          />
        }
        toolbar={
          <PaymentsToolbar
            tab={tab}
            query={query}
            onQuery={setQuery}
            onNew={() => openDoc({ kind: tab === 'contracts' ? 'contract' : 'invoice', id: null })}
            range={range}
            onRange={setRange}
            invoices={state.invoices}
          />
        }
        actions={actions}
      />
      <div role="tabpanel" aria-labelledby={tabId(TAB_ID, tab)} className="flex flex-1 flex-col">
        {none ? (
          <EmptyState title={NONE[tab][0]} body={NONE[tab][1]} />
        ) : empty ? (
          <Panel className="space-y-3 py-16 text-center">
            <p className="type-body text-zebra-500">Nothing matches that search.</p>
            <Button variant="secondary" onClick={() => setQuery('')}>
              Clear search
            </Button>
          </Panel>
        ) : tab === 'invoices' ? (
          <RowSections
            sections={unfolded(INVOICE_GROUPS, invoices.length)}
            items={invoices}
            sectionOf={(i) => i.group}
            note={(rows) => money(rows.reduce((s, i) => s + i.amount, 0))}
            renderRow={(i) => (
              <InvoiceRow
                key={i.id}
                invoice={i}
                reminded={state.reminded.has(i.id)}
                onOpen={() => openDoc({ kind: 'invoice', id: i.id })}
                onRemind={() => openDoc({ kind: 'invoice', id: i.id }, true)}
              />
            )}
          />
        ) : tab === 'contracts' ? (
          <RowSections
            sections={unfolded(CONTRACT_GROUPS, contracts.length)}
            items={contracts}
            sectionOf={(c) => c.group}
            renderRow={(c) => <ContractRow key={c.id} contract={c} onOpen={() => openDoc({ kind: 'contract', id: c.id })} />}
          />
        ) : (
          <OverviewView
            range={range}
            state={state}
            onOpen={(id, chase) => openDoc({ kind: 'invoice', id }, chase)}
            onOpenContract={(id) => openDoc({ kind: 'contract', id })}
            onViewAll={() => setTab('invoices')}
          />
        )}
      </div>
      <DocumentModal doc={open} composing={composing} onCompose={setComposing} state={state} onClose={() => setOpen(null)} />
    </section>
  );
}
