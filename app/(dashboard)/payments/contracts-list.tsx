/**
 * Contracts tab content for the /payments page.
 *
 * **Phase 2C scope note:** Contracts hardening belongs to Phase 3.
 * This file extracts the contracts row rendering for the page
 * decomposition (so quotes-list / invoices-list aren't entangled
 * with contracts code) without changing any behaviour. The contract
 * builder modal and the inline "new contract" popover live with the
 * page orchestrator for now and get their full DoD treatment in
 * Phase 3.
 *
 * @module app/(dashboard)/payments/contracts-list
 */
'use client';

import { Calendar, FileSignature } from 'lucide-react';
import type { ReactNode } from 'react';

import { PaymentsTable } from './payments-table';
import type { Contract } from './use-payments-data';

const CONTRACT_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-600',
  signed: 'bg-emerald-50 text-emerald-600',
  declined: 'bg-red-50 text-red-600',
  expired: 'bg-gray-100 text-gray-500',
  revoked: 'bg-gray-100 text-gray-500',
};

function pill(status: string, opts?: { wrap?: boolean }): ReactNode {
  const className = `inline-flex items-center px-2 py-0.5 rounded-pill text-xs font-medium capitalize${opts?.wrap === false ? ' whitespace-nowrap' : ''} ${CONTRACT_STATUS_STYLES[status] || CONTRACT_STATUS_STYLES.draft}`;
  return <span className={className}>{status}</span>;
}

export interface ContractsListProps {
  loading: boolean;
  contracts: Contract[];
  searching: boolean;
  onOpen: (contract: { id: string; coupleId: string; coupleName: string }) => void;
}

export function ContractsList({ loading, contracts, searching, onOpen }: ContractsListProps) {
  return (
    <PaymentsTable
      loading={loading}
      rows={contracts}
      emptyIcon={<FileSignature size={32} strokeWidth={1} className="text-gray-200 mx-auto mb-3" />}
      emptyMessage={
        searching
          ? 'No contracts match your search.'
          : 'No contracts yet. Create one from a couple or the + New button.'
      }
      lastColLabel="Date"
      lastColIcon={<Calendar size={12} strokeWidth={1.5} />}
      valueColLabel="Signed"
      valueColIcon={<Calendar size={12} strokeWidth={1.5} />}
      renderRow={(contract) => ({
        key: contract.id,
        onClick: () =>
          onOpen({
            id: contract.id,
            coupleId: contract.couple.id,
            coupleName: contract.couple.name,
          }),
        number: contract.contract_number,
        title: contract.title,
        coupleName: contract.couple.name,
        statusPill: pill(contract.status),
        valueCell: (
          <span className="text-sm text-gray-500 group-hover:text-gray-900">
            {contract.signed_at
              ? new Date(contract.signed_at).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                })
              : ' - '}
          </span>
        ),
        lastCell: (
          <span className="text-sm text-gray-500 group-hover:text-gray-900">
            {new Date(contract.created_at).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        ),
        mobileSecondary: null,
        mobileValueRight: null,
        mobileStatus: pill(contract.status, { wrap: false }),
      })}
    />
  );
}
