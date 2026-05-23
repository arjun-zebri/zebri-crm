/**
 * /payments — Quotes / Invoices / Contracts tabbed list.
 *
 * Orchestrator only: owns tab + search + active-modal state, calls
 * the three data hooks side-by-side, and composes the header /
 * list / footer / modal pieces. List rendering, row mapping, and
 * the new-contract popover live in co-located files so this page
 * stays close to the §5 DoD's "page is an orchestrator" rule.
 *
 * Contracts hardening (the modal + per-row server actions) is
 * Phase 3. This decomposition keeps the existing contract UI
 * working unchanged so the Contracts tab doesn't regress.
 *
 * @module app/(dashboard)/payments/page
 */
'use client';

import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ContractBuilderModal } from '@/components/builders/contract-builder-modal';
import { InvoiceBuilderModal } from '@/components/builders/invoice-builder-modal';
import { QuoteBuilderModal } from '@/components/builders/quote-builder-modal';
import { createClient } from '@/lib/supabase/client';
import { hasContractsAccess } from '@/lib/payments/subscription';

import { ContractsList } from './contracts-list';
import { deriveInvoices, InvoicesList } from './invoices-list';
import { NewContractPopover } from './new-contract-popover';
import { PaymentsFooter } from './payments-footer';
import { PaymentsHeader } from './payments-header';
import { QuotesList } from './quotes-list';
import { useContracts, useInvoices, useQuotes } from './use-payments-data';
import { type PaymentsTab, usePaymentsShortcut } from './use-payments-shortcut';

export default function PaymentsPage() {
  const supabase = createClient();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<PaymentsTab>('quotes');
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [activeContract, setActiveContract] = useState<{
    id: string;
    coupleId: string;
    coupleName: string;
  } | null>(null);
  const [quoteSearch, setQuoteSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [contractSearch, setContractSearch] = useState('');
  const [newContractOpen, setNewContractOpen] = useState(false);
  const [contractsEnabled, setContractsEnabled] = useState(false);

  // Contracts entitlement reads from `hasContractsAccess(user)` —
  // gated to Pro/Max via the entitlements helper (post-§7.4 fix).
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setContractsEnabled(hasContractsAccess(data.user));
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Demote off the Contracts tab if the user loses access while
  // viewing it (e.g. subscription lapses in another tab).
  useEffect(() => {
    if (!contractsEnabled && activeTab === 'contracts') setActiveTab('quotes');
  }, [contractsEnabled, activeTab]);

  // Keyboard shortcut + Escape-to-clear-search.
  usePaymentsShortcut({
    searchInputRef,
    onClearSearch: () => {
      setQuoteSearch('');
      setInvoiceSearch('');
      setContractSearch('');
    },
  });

  const { data: quotes, isLoading: quotesLoading } = useQuotes();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const { data: contracts, isLoading: contractsLoading } = useContracts();

  const filteredQuotes = useMemo(() => {
    const list = quotes ?? [];
    if (!quoteSearch) return list;
    const s = quoteSearch.toLowerCase();
    return list.filter(
      (q) =>
        q.title.toLowerCase().includes(s) ||
        q.quote_number.toLowerCase().includes(s) ||
        q.couple.name.toLowerCase().includes(s) ||
        q.status.toLowerCase().includes(s),
    );
  }, [quotes, quoteSearch]);

  const filteredInvoices = useMemo(() => {
    const derived = deriveInvoices(invoices ?? []);
    if (!invoiceSearch) return derived;
    const s = invoiceSearch.toLowerCase();
    return derived.filter(
      (inv) =>
        inv.title.toLowerCase().includes(s) ||
        inv.invoice_number.toLowerCase().includes(s) ||
        inv.couple.name.toLowerCase().includes(s) ||
        inv.status.toLowerCase().includes(s),
    );
  }, [invoices, invoiceSearch]);

  const filteredContracts = useMemo(() => {
    const list = contracts ?? [];
    if (!contractSearch) return list;
    const s = contractSearch.toLowerCase();
    return list.filter(
      (c) =>
        c.title.toLowerCase().includes(s) ||
        c.contract_number.toLowerCase().includes(s) ||
        c.couple.name.toLowerCase().includes(s) ||
        c.status.toLowerCase().includes(s),
    );
  }, [contracts, contractSearch]);

  const currentSearch =
    activeTab === 'quotes'
      ? quoteSearch
      : activeTab === 'invoices'
        ? invoiceSearch
        : contractSearch;

  function setCurrentSearch(value: string) {
    if (activeTab === 'quotes') setQuoteSearch(value);
    else if (activeTab === 'invoices') setInvoiceSearch(value);
    else setContractSearch(value);
  }

  const count =
    activeTab === 'quotes'
      ? filteredQuotes.length
      : activeTab === 'invoices'
        ? filteredInvoices.length
        : filteredContracts.length;

  const total =
    activeTab === 'quotes'
      ? filteredQuotes.reduce((sum, q) => sum + q.subtotal, 0)
      : activeTab === 'invoices'
        ? filteredInvoices.reduce((sum, inv) => sum + inv.subtotal, 0)
        : undefined;

  const isLoading =
    activeTab === 'quotes'
      ? quotesLoading
      : activeTab === 'invoices'
        ? invoicesLoading
        : contractsLoading;

  function handleNew() {
    if (activeTab === 'quotes') setActiveQuoteId('new');
    else if (activeTab === 'invoices') setActiveInvoiceId('new');
    else setNewContractOpen(true);
  }

  // Contracts tab needs a popover-anchored New button; quotes/
  // invoices use the standard button. Build both forms here so the
  // header's `newButtonOverride` either receives the popover or
  // falls through to its default.
  const contractsNewButton = (
    <NewContractPopover
      open={newContractOpen}
      onOpenChange={setNewContractOpen}
      onCreated={(c) => setActiveContract(c)}
      trigger={
        <button
          onClick={() => setNewContractOpen(true)}
          className="hidden sm:inline-flex items-center gap-1 px-2 py-2 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-700 transition cursor-pointer"
        >
          <Plus size={11} strokeWidth={2} />
          New contract
        </button>
      }
    />
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PaymentsHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        count={count}
        search={currentSearch}
        onSearchChange={setCurrentSearch}
        searchInputRef={searchInputRef}
        onNew={handleNew}
        newButtonOverride={activeTab === 'contracts' ? contractsNewButton : undefined}
        contractsEnabled={contractsEnabled}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 sm:px-[3.75rem] pb-28">
          {activeTab === 'quotes' && (
            <QuotesList
              loading={isLoading}
              quotes={filteredQuotes}
              searching={Boolean(quoteSearch)}
              onOpen={setActiveQuoteId}
            />
          )}
          {activeTab === 'invoices' && (
            <InvoicesList
              loading={isLoading}
              invoices={filteredInvoices}
              searching={Boolean(invoiceSearch)}
              onOpen={setActiveInvoiceId}
            />
          )}
          {activeTab === 'contracts' && contractsEnabled && (
            <ContractsList
              loading={isLoading}
              contracts={filteredContracts}
              searching={Boolean(contractSearch)}
              onOpen={setActiveContract}
            />
          )}
        </div>
      </div>

      <PaymentsFooter tab={activeTab} count={count} total={total} />

      {!!activeQuoteId && (
        <QuoteBuilderModal
          quoteId={activeQuoteId}
          isOpen
          onClose={() => setActiveQuoteId(null)}
          onCreateInvoice={(invId) => {
            setActiveQuoteId(null);
            setActiveInvoiceId(invId);
          }}
        />
      )}

      {!!activeInvoiceId && (
        <InvoiceBuilderModal
          invoiceId={activeInvoiceId}
          isOpen
          onClose={() => setActiveInvoiceId(null)}
        />
      )}

      {!!activeContract && (
        <ContractBuilderModal
          contractId={activeContract.id}
          coupleId={activeContract.coupleId}
          coupleName={activeContract.coupleName}
          isOpen
          onClose={() => setActiveContract(null)}
        />
      )}
    </div>
  );
}
