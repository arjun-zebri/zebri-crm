'use client';

import { useDeferredValue, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { EmptyState } from '@/components/ui-v2/empty-state';
import { PillTabs } from '@/components/ui-v2/pill-tabs';
import { RowSections } from '@/components/ui-v2/row-sections';

import { useAccount } from '../account';
import { PageBar } from '../page-bar';
import { PageFrame } from '../page-frame';

import { InvoiceRow } from './invoice-row';
import { DocumentModal, type OpenDoc } from './modal/document-modal';
import { OverviewView } from './overview/overview-view';
import { INVOICE_GROUPS, coupleName, money, unfolded } from './payments-data';
import { PaymentsToolbar, type Tab } from './payments-toolbar';
import { PRESETS, type Range } from './reports-data';
import { usePaymentsState } from './use-payments-state';

/**
 * The v2 Payments page, shown when Payments is picked in the dashboard
 * sidebar, behind two tabs. Overview comes first and answers "how am
 * I doing?": the period's figures, cash flow by month, then what is
 * overdue and what is due next, for a period the MC picks (Export gives
 * the accountant the payments and GST as CSV). Invoices are sections
 * of rows by what needs the MC (overdue first, settled ones folded
 * away); a row opens the invoice in a modal as the couple sees it.
 * Contracts moved to Documents; Overview still opens one it mentions.
 * Chrome is one line (`PageBar`): the title, the tabs, then
 * the toolbar and the dashboard's icons. The invoices are the account's (`useAccount`): the demo business by default. A new
 * account sees empty states until its first ones go out, and New sends
 * one when the account can.
 *
 * @module app/design-system/v2/pages/dashboard/payments/payments-page
 */

const TABS: readonly Tab[] = ['overview', 'invoices'];

export interface PaymentsPageProps {
  heading?: 'h1' | 'h2';
  /** The dashboard's top-right icons, at the end of the title row. */
  actions?: ReactNode;
  /** The tab to open on (Home's counts lead straight to a list); Overview by default. */
  initialTab?: Tab | undefined;
  /** Opens on a new invoice: Home's next move. */
  startNew?: 'invoice' | undefined;
}

/** The Payments page. See {@link PaymentsPageProps}. */
export function PaymentsPage({
  heading: Heading = 'h1',
  actions,
  initialTab = 'overview',
  startNew,
}: PaymentsPageProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<Range>(PRESETS[0]!);
  const [open, setOpen] = useState<OpenDoc | null>(startNew ? { kind: startNew, id: null } : null);
  const [composing, setComposing] = useState(false);
  const account = useAccount();
  const state = usePaymentsState(account.invoices);
  const q = useDeferredValue(query.trim().toLowerCase());
  const match = (names: [string, string], extra: string) =>
    q === '' || `${coupleName(names)} ${extra}`.toLowerCase().includes(q);

  // Soonest due first; Paid newest first, since the latest payments are the ones checked.
  const invoices = state.invoices
    .filter((i) => match(i.names, `${i.number} ${i.label}`))
    .sort((a, b) =>
      a.paidOn && b.paidOn ? b.paidOn.localeCompare(a.paidOn) : a.dueOn.localeCompare(b.dueOn),
    );
  const overdue = state.invoices.filter((i) => i.group === 'overdue');
  const openDoc = (doc: OpenDoc, compose = false) => {
    setOpen(doc);
    setComposing(compose);
  };
  const empty = tab !== 'overview' && invoices.length === 0;
  // Nothing at all, as against nothing matching a search.
  const none = account.invoices.length === 0;
  const NONE = {
    overview: [
      'Nothing to report yet',
      'What you are owed, what came in and what is late, as soon as your first invoice goes out.',
    ],
    invoices: ['No invoices yet', 'Deposits and payments, sorted by what needs you.'],
  } as const;

  return (
    <PageFrame
      labelledBy="payments-title"
      bar={
        <PageBar
          title={
            <Heading id="payments-title" className="sr-only">
              Payments
            </Heading>
          }
          tabs={
            <PillTabs
              label="Payments"
              options={TABS}
              labels={{ overview: 'Overview', invoices: 'Invoices' }}
              counts={{ invoices: overdue.length }}
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
              onNew={() => openDoc({ kind: 'invoice', id: null })}
              range={range}
              onRange={setRange}
              invoices={state.invoices}
            />
          }
          actions={actions}
        />
      }
    >
      <div className="flex flex-1 flex-col">
        {none ? (
          <EmptyState title={NONE[tab][0]} body={NONE[tab][1]} />
        ) : empty ? (
          <EmptyState
            compact
            title="Nothing matches that search"
            body="Try a couple's name, an invoice number or a payment."
            action={
              <Button variant="secondary" onClick={() => setQuery('')}>
                Clear search
              </Button>
            }
          />
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
        ) : (
          <OverviewView
            range={range}
            state={state}
            onOpen={(id, remind) => openDoc({ kind: 'invoice', id }, remind)}
            onOpenContract={(id, remind) => openDoc({ kind: 'contract', id }, remind)}
            onViewAll={() => setTab('invoices')}
          />
        )}
      </div>
      <DocumentModal
        doc={open}
        composing={composing}
        onCompose={setComposing}
        state={state}
        onClose={() => setOpen(null)}
      />
    </PageFrame>
  );
}
