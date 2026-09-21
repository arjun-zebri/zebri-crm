/**
 * Commercial terms row: deposit %, payment schedule, contract template.
 * The template is required to send (D5); the schedule is optional and
 * falls back to the deposit % at invoice time (Phase C).
 *
 * The expiry date lives in {@link BuilderMetaRow} (shared with the Quote
 * and Invoice builders), so it is not repeated here.
 *
 * @module components/builders/parts/proposal-terms
 */
'use client';

import { useQuery } from '@tanstack/react-query';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';

/** Radix Select cannot take an empty-string option; use a sentinel. */
const NONE = '__none__';

export interface ProposalTermsProps {
  depositPercent: number | null;
  paymentScheduleId: string | null;
  contractTemplateId: string | null;
  canEdit: boolean;
  onChange: (patch: Partial<{ depositPercent: number | null; paymentScheduleId: string | null; contractTemplateId: string | null }>) => void;
}

/** See {@link ProposalTermsProps}. */
export function ProposalTerms({ depositPercent, paymentScheduleId, contractTemplateId, canEdit, onChange }: ProposalTermsProps) {
  const supabase = createClient();
  const { data: templates } = useQuery({
    queryKey: ['contract-templates-for-proposal'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contract_templates').select('id, name, is_default').order('position');
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: schedules } = useQuery({
    queryKey: ['payment-schedules-for-proposal'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_schedules').select('id, name, is_default').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-2">
      <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">Terms</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          value={depositPercent ?? ''}
          onChange={(e) => onChange({ depositPercent: e.target.value === '' ? null : Number(e.target.value) })}
          placeholder="Deposit %"
          aria-label="Deposit percent"
          disabled={!canEdit}
        />
        <Select
          ariaLabel="Payment schedule"
          placeholder="Payment schedule (optional)"
          value={paymentScheduleId ?? NONE}
          onValueChange={(v) => onChange({ paymentScheduleId: v === NONE ? null : v })}
          options={[{ value: NONE, label: 'Deposit % only' }, ...(schedules ?? []).map((s) => ({ value: s.id, label: s.name }))]}
          disabled={!canEdit}
          contentClassName="z-[90]"
        />
        <Select
          ariaLabel="Contract template"
          placeholder="Contract template"
          value={contractTemplateId ?? NONE}
          onValueChange={(v) => onChange({ contractTemplateId: v === NONE ? null : v })}
          options={[{ value: NONE, label: 'Choose a contract template' }, ...(templates ?? []).map((t) => ({ value: t.id, label: t.name }))]}
          disabled={!canEdit}
          contentClassName="z-[90]"
        />
      </div>
    </div>
  );
}
