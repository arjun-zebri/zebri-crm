/**
 * React Query hooks for the /payments page data sources.
 *
 * Three lists share the same shape (id, title, status, couple, …) but
 * have tab-specific extras: quotes carry a subtotal, invoices add a
 * due-date + overdue derivation, contracts add a signed_at timestamp.
 *
 * Hooks live in a single module so the parent page can call all
 * three side-by-side and the list components stay purely
 * presentational. The supabase client is created lazily inside each
 * `queryFn` so the hooks don't run any Supabase code at import-time.
 *
 * @module app/(dashboard)/payments/use-payments-data
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';

export interface Proposal {
  id: string;
  proposal_number: string;
  title: string;
  status: string;
  /** Primary option total pre-acceptance; accepted total after. */
  subtotal: number;
  expires_at: string | null;
  created_at: string;
  couple: { id: string; name: string };
}

export interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  subtotal: number;
  created_at: string;
  couple: { id: string; name: string };
}

export interface Invoice {
  id: string;
  invoice_number: string;
  title: string;
  status: string;
  subtotal: number;
  due_date: string | null;
  created_at: string;
  couple: { id: string; name: string };
}

export interface Contract {
  id: string;
  contract_number: string;
  title: string;
  status: string;
  signed_at: string | null;
  created_at: string;
  couple: { id: string; name: string };
}

/** Proposals owned by the current user, newest first. */
export function useProposals() {
  const supabase = createClient();
  return useQuery({
    queryKey: ['all-proposals'],
    queryFn: async (): Promise<Proposal[]> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('proposals')
        .select(
          'id, proposal_number, title, status, subtotal, expires_at, created_at, couple:couple_id(id, name)',
        )
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Proposal[]) || [];
    },
  });
}

/** Quotes owned by the current user, newest first. */
export function useQuotes() {
  const supabase = createClient();
  return useQuery({
    queryKey: ['all-quotes'],
    queryFn: async (): Promise<Quote[]> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, title, status, subtotal, created_at, couple:couple_id(id, name)')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Quote[]) || [];
    },
  });
}

/** Invoices owned by the current user, newest first. */
export function useInvoices() {
  const supabase = createClient();
  return useQuery({
    queryKey: ['all-invoices'],
    queryFn: async (): Promise<Invoice[]> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('invoices')
        .select(
          'id, invoice_number, title, status, subtotal, due_date, created_at, couple:couple_id(id, name)',
        )
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Invoice[]) || [];
    },
  });
}

/** Contracts owned by the current user, newest first. */
export function useContracts() {
  const supabase = createClient();
  return useQuery({
    queryKey: ['all-contracts'],
    queryFn: async (): Promise<Contract[]> => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('contracts')
        .select(
          'id, contract_number, title, status, signed_at, created_at, couple:couple_id(id, name)',
        )
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Contract[]) || [];
    },
  });
}
