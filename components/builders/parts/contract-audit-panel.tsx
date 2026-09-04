/**
 * The contract's activity trail, for the MC.
 *
 * `contract_audit_log` has recorded every send, view, signature, decline,
 * reminder and revoke since May 2026 and, until this component, absolutely
 * nothing ever read it. The sign route even carried a comment claiming "the
 * in-product dashboard surfaces the audit trail", which was not true. This
 * makes it true.
 *
 * The owner sees UNREDACTED IPs here, unlike the public certificate: this is
 * their own record, read under the table's owner-only SELECT policy, not a
 * document handed to whoever holds a link.
 *
 * @module components/builders/parts/contract-audit-panel
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import { describeEvent, type AuditTrailEvent } from '@/lib/contracts/audit-trail';
import { describeUserAgent } from '@/lib/contracts/user-agent';
import { createClient } from '@/lib/supabase/client';

export interface ContractAuditPanelProps {
  contractId: string;
  /** The MC's trade noun, for the event wording. */
  vendorRole: string;
}

/** "12 Aug, 9:04am", compact enough for a dense timeline. */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ContractAuditPanel({ contractId, vendorRole }: ContractAuditPanelProps) {
  const supabase = createClient();

  const { data: events, isPending } = useQuery({
    queryKey: ['contract-audit', contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_audit_log')
        .select(
          'event_type, actor, event_at, signer_name_typed, decline_reason, reminder_number, actor_ip, actor_user_agent',
        )
        .eq('contract_id', contractId)
        .order('event_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (isPending) {
    return <p className="text-body text-text-subtle">Loading activity…</p>;
  }
  if (!events || events.length === 0) {
    return <p className="text-body text-text-subtle">No activity recorded yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {events.map((event, i) => {
        const agent = describeUserAgent(event.actor_user_agent);
        return (
          <li key={`${event.event_type}-${event.event_at}-${String(i)}`} className="flex gap-3">
            <span className="shrink-0 text-body tabular-nums text-text-subtle">
              {formatWhen(event.event_at)}
            </span>
            <span className="min-w-0">
              <span className="block text-body text-text">
                {describeEvent(event as AuditTrailEvent, vendorRole)}
              </span>
              {event.actor_ip || agent ? (
                <span className="block text-body text-text-subtle">
                  {[event.actor_ip, agent].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
