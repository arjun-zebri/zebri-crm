import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { Input } from '@/components/ui-v2/input';

import { useAccount } from '../../account';
import { STAGES, clientName } from '../../clients/clients-data';
import { coupleName } from '../../payments/payments-data';

/**
 * The first step of New proposal: who it is for. The leads on the
 * Clients page who have no proposal yet, each with their wedding and
 * where they are up to, then Someone new, which opens two name fields
 * for an enquiry that is not in Zebri yet.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/new/couple-step
 */

/** The pick: a lead's display name, or `NEW` with typed names. */
export const NEW = 'new';

/** The account's leads before the Proposal stage with nothing drafted or sent. */
export function useLeads() {
  const { clients, proposals } = useAccount();
  const taken = new Set(proposals.map((p) => coupleName(p.names)));
  return clients.filter((c) => STAGES.indexOf(c.stage) < STAGES.indexOf('Proposal') && !taken.has(clientName(c)));
}

export interface CoupleStepProps {
  value: string | null;
  onChange: (v: string) => void;
  names: [string, string];
  onNames: (n: [string, string]) => void;
}

/** The couple step. See {@link CoupleStepProps}. */
export function CoupleStep({ value, onChange, names, onNames }: CoupleStepProps) {
  const LEADS = useLeads();
  return (
    <fieldset className="space-y-2">
      <legend className="pb-2 type-body text-zebra-500">Who is it for?</legend>
      {LEADS.map((c) => (
        <ChoiceCard key={c.id} selected={value === clientName(c)} onClick={() => onChange(clientName(c))} className="py-3">
          <span className="type-label">{clientName(c)}</span>
          <span className="type-body text-zebra-500">
            {c.date} · {c.venue} · {c.stage}
          </span>
        </ChoiceCard>
      ))}
      <ChoiceCard selected={value === NEW} onClick={() => onChange(NEW)} className="py-3">
        <span className="type-label">Someone new</span>
        <span className="type-body text-zebra-500">An enquiry that isn&rsquo;t in Zebri yet</span>
      </ChoiceCard>
      {value === NEW ? (
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <Input label="First partner" placeholder="First name" value={names[0]} onChange={(e) => onNames([e.target.value, names[1]])} data-autofocus />
          <Input label="Second partner" placeholder="First name" value={names[1]} onChange={(e) => onNames([names[0], e.target.value])} />
        </div>
      ) : null}
    </fieldset>
  );
}
