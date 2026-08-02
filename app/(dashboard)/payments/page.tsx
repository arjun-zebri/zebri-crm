/**
 * /payments — Invoices / Contracts tabbed list.
 *
 * Orchestrator only: owns tab + search + active-modal state, calls
 * the two data hooks side-by-side, and composes the header /
 * list / footer / modal pieces. List rendering and row mapping live
 * in co-located files so this page stays close to the §5 DoD's
 * "page is an orchestrator" rule.
 *
 * Both tabs create the same way: New opens the builder modal on
 * an unsaved draft and the couple is picked inside it. Nothing is
 * written until the MC saves.
 *
 * @module app/(dashboard)/payments/page
 */
'use client';

import { useMemo, useRef, useState } from 'react';

import { ContractBuilderModal } from '@/components/builders/contract-builder-modal';
import { InvoiceBuilderModal } from '@/components/builders/invoice-builder-modal';

import { ContractsList } from './contracts-list';
import { deriveInvoices, InvoicesList } from './invoices-list';
import { PaymentsFooter } from './payments-footer';
import { PaymentsHeader } from './payments-header';
import { useContracts, useInvoices } from './use-payments-data';
import { type PaymentsTab, usePaymentsShortcut } from './use-payments-shortcut';

export default function PaymentsPage() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<PaymentsTab>('invoices');
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  // `{ id: null }` is a fresh draft: the contract builder opens
  // straight away and the couple is chosen inside it.
  const [activeContract, setActiveContract] = useState<{
    id: string | null;
    coupleId?: string;
    coupleName?: string;
  } | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [contractSearch, setContractSearch] = useState('');

  // Contracts is available on every plan (2026-06-03). The Starter
  // 5-couple cap is enforced by `saveContractAction` at create time,
  // not by hiding the tab.

  // Keyboard shortcut + Escape-to-clear-search.
  usePaymentsShortcut({
    searchInputRef,
    onClearSearch: () => {
      setInvoiceSearch('');
      setContractSearch('');
    },
  });

  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const { data: contracts, isLoading: contractsLoading } = useContracts();

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

  const currentSearch = activeTab === 'invoices' ? invoiceSearch : contractSearch;

  function setCurrentSearch(value: string) {
    if (activeTab === 'invoices') setInvoiceSearch(value);
    else setContractSearch(value);
  }

  const count =
    activeTab === 'invoices' ? filteredInvoices.length : filteredContracts.length;

  const total =
    activeTab === 'invoices'
      ? filteredInvoices.reduce((sum, inv) => sum + inv.subtotal, 0)
      : undefined;

  const isLoading = activeTab === 'invoices' ? invoicesLoading : contractsLoading;

  function handleNew() {
    if (activeTab === 'invoices') setActiveInvoiceId('new');
    else setActiveContract({ id: null });
  }

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
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 sm:px-[3.75rem] pb-28">
          {activeTab === 'invoices' && (
            <InvoicesList
              loading={isLoading}
              invoices={filteredInvoices}
              searching={Boolean(invoiceSearch)}
              onOpen={setActiveInvoiceId}
            />
          )}
          {activeTab === 'contracts' && (
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
          {...(activeContract.coupleId ? { initialCoupleId: activeContract.coupleId } : {})}
          {...(activeContract.coupleName ? { initialCoupleName: activeContract.coupleName } : {})}
          isOpen
          onClose={() => setActiveContract(null)}
        />
      )}
    </div>
  );
}
