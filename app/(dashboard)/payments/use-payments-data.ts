/**
 * React Query hooks for the /payments page data sources.
 *
 * Both lists share the same shape (id, title, status, couple, …) but
 * have tab-specific extras: invoices add a due-date + overdue
 * derivation, contracts add a signed_at timestamp.
 *
 * Hooks live in a single module so the parent page can call both
 * side-by-side and the list components stay purely presentational.
 * The supabase client is created lazily inside each `queryFn` so the
 * hooks don't run any Supabase code at import-time.
 *
 * @module app/(dashboard)/payments/use-payments-data
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';

/** A row from `invoice_payment_stages`, as fetched for balance + reporting math. */
export interface InvoiceStage {
  amount_cents: number;
  paid_at: string | null;
  due_date: string | null;
  label: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  title: string;
  status: string;
  subtotal: number;
  /** GST percentage; see `lib/payments/invoice-total`. */
  tax_rate: number;
  discount_type: string | null;
  discount_value: number | null;
  due_date: string | null;
  /** Set when a stageless invoice is marked paid. */
  paid_at: string | null;
  created_at: string;
  couple: { id: string; name: string };
  /** Empty for a stageless invoice (single up-front payment). */
  invoice_payment_stages: InvoiceStage[];
}

export interface Contract {
  id: string;
  contract_number: string;
  /** Null until the sender titles it. Never auto-generated. */
  title: string | null;
  status: string;
  signed_at: string | null;
  created_at: string;
  couple: { id: string; name: string };
  /** Signing progress, so a part-signed contract is visible at a glance. */
  contract_signers: { signed_at: string | null; required: boolean }[];
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
          'id, invoice_number, title, status, subtotal, tax_rate, discount_type, discount_value, due_date, paid_at, created_at, couple:couple_id(id, name), invoice_payment_stages(amount_cents, paid_at, due_date, label)',
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
          'id, contract_number, title, status, signed_at, created_at, couple:couple_id(id, name), contract_signers(signed_at, required)',
        )
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Contract[]) || [];
    },
  });
}
