/**
 * Inline "Pick a couple for this contract" popover.
 *
 * Triggered by the New button on the Contracts tab. Search-filters
 * the user's couples + on selection creates a draft contract via
 * `generate_contract_number` + a direct insert. The newly created
 * contract opens immediately in the contract builder modal — handled
 * by the parent via `onCreated`.
 *
 * Contracts hardening belongs to Phase 3, so this file mirrors the
 * pre-2C behaviour exactly. It's extracted only to keep the page
 * orchestrator small.
 *
 * @module app/(dashboard)/payments/new-contract-popover
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useToast } from '@/components/ui/toast';
import {
  contractCoupleLimit,
  STARTER_CONTRACT_COUPLE_LIMIT,
} from '@/lib/payments/subscription';
import { createClient } from '@/lib/supabase/client';

export interface NewContractPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  onCreated: (created: { id: string; coupleId: string; coupleName: string }) => void;
}

export function NewContractPopover({
  open,
  onOpenChange,
  trigger,
  onCreated,
}: NewContractPopoverProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState('');

  const { data: couples } = useQuery({
    queryKey: ['all-couples-for-new-contract'],
    enabled: open,
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('couples')
        .select('id, name')
        .eq('user_id', user.user.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data as { id: string; name: string }[]) || [];
    },
  });

  // Starter-plan cap: contracts for max 5 distinct couples. Pro/Max
  // are uncapped. We fetch every contract.couple_id for the user
  // (cheap — even prolific MCs have at most a few hundred) so we can
  // tell which couples in the picker would consume a new "slot" vs.
  // already use one.
  const { data: limitInfo } = useQuery({
    queryKey: ['contracts-couple-limit', 'popover'],
    enabled: open,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) throw new Error('Not authenticated');
      const limit = contractCoupleLimit(user);
      if (limit === null) {
        return { limit: null, idsWithContracts: new Set<string>() };
      }
      const { data, error } = await supabase
        .from('contracts')
        .select('couple_id')
        .eq('user_id', user.id);
      if (error) throw error;
      const idsWithContracts = new Set<string>();
      for (const row of data ?? []) idsWithContracts.add(row.couple_id as string);
      return { limit, idsWithContracts };
    },
  });

  const distinctCount = limitInfo?.idsWithContracts.size ?? 0;
  const limit = limitInfo?.limit ?? null;
  const atLimit = limit !== null && distinctCount >= limit;

  function isLockedForCouple(coupleId: string): boolean {
    if (!atLimit) return false;
    return !limitInfo!.idsWithContracts.has(coupleId);
  }

  async function createForCouple(coupleId: string, coupleName: string) {
    if (isLockedForCouple(coupleId)) {
      toast(`Free plan limit: contracts for ${STARTER_CONTRACT_COUPLE_LIMIT} couples`, 'error');
      return;
    }
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data: num, error: numErr } = await supabase.rpc('generate_contract_number', {
      p_user_id: user.user.id,
    });
    if (numErr) {
      toast('Failed to create contract', 'error');
      return;
    }
    const { data, error } = await supabase
      .from('contracts')
      .insert({
        user_id: user.user.id,
        couple_id: coupleId,
        title: `Contract for ${coupleName}`,
        contract_number: num as string,
        status: 'draft',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
      })
      .select('id')
      .single();
    if (error || !data) {
      toast('Failed to create contract', 'error');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['contracts-couple-limit'] });
    onOpenChange(false);
    setFilter('');
    onCreated({ id: data.id, coupleId, coupleName });
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-[90] w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-2 animate-fade-in"
        >
          <p className="text-xs font-medium text-gray-500 px-2 py-1">
            Pick a couple for this contract
          </p>
          {atLimit && (
            <div className="mx-1 mb-1 px-2 py-1.5 rounded-md bg-gray-50 border border-gray-200 text-[11px] text-gray-600 leading-snug">
              Free plan: {distinctCount}/{limit} couples with contracts.{' '}
              <Link
                href="/settings/billing"
                className="text-gray-900 underline cursor-pointer"
              >
                Upgrade to Pro
              </Link>{' '}
              to add more.
            </div>
          )}
          <input
            type="text"
            autoFocus
            placeholder="Search couples…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg mb-1 focus:outline-none focus:border-gray-400"
          />
          <div className="max-h-64 overflow-y-auto">
            {(couples || [])
              .filter((c) => !filter || c.name.toLowerCase().includes(filter.toLowerCase()))
              .map((c) => {
                const locked = isLockedForCouple(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => createForCouple(c.id, c.name)}
                    disabled={locked}
                    title={locked ? 'Free plan limit reached' : undefined}
                    className={`w-full text-left px-2 py-1.5 text-sm rounded-md flex items-center justify-between gap-2 ${
                      locked
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-900 hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1 min-w-0">
                      {locked ? (
                        <Lock size={12} strokeWidth={1.5} className="text-gray-300 shrink-0" />
                      ) : (
                        <Plus size={12} strokeWidth={1.5} className="text-gray-400 shrink-0" />
                      )}
                      <span className="truncate">{c.name}</span>
                    </span>
                  </button>
                );
              })}
            {couples && couples.length === 0 && (
              <p className="text-sm text-gray-400 px-2 py-3 text-center">
                Create a couple first.
              </p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
