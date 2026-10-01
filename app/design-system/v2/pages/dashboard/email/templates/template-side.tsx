'use client';

import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';

import { DrawnCheck } from '@/components/ui-v2/drawn-check';
import { Dropdown } from '@/components/ui-v2/dropdown';

import { shortDate } from '../../payments/dates';
import { SIGNATURES, fieldsIn, fillFields, pct, type EmailTemplate, type SignatureId } from '../email-data';
import { checksFor, clientName, type Client, type Device } from '../render/quirks';
import type { EmailState } from '../use-email-state';

/**
 * The template dialog's side column: bare facts, no boxes, sections
 * apart by space. First how it has done (sent, then open, click and
 * reply rates with their counts, so a percentage is never read alone),
 * then what it says (subject, preview text), the signature it signs off
 * with (a `Dropdown`, picked per template; the preview follows), the
 * fields it fills per couple (the MC's own fields marked), which
 * workflows send it, and the checks for the inbox on screen.
 *
 * @module app/design-system/v2/pages/dashboard/email/templates/template-side
 */

export interface TemplateSideProps {
  template: EmailTemplate;
  state: EmailState;
  client: Client;
  device: Device;
}

/** A label over its value. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5 type-body">
      <p className="text-zebra-500">{label}</p>
      <div className="text-zebra-950">{children}</div>
    </div>
  );
}

/** The side column. See {@link TemplateSideProps}. */
export function TemplateSide({ template: t, state, client, device }: TemplateSideProps) {
  const stats: [string, number][] = [['Opened', t.opened], ['Clicked', t.clicked], ['Replied', t.replied]];
  const fields = fieldsIn(t.blocks, t.subject);
  return (
    <div className="space-y-8">
      {t.archivedOn ? (
        <p className="type-body text-zebra-600">
          Archived {shortDate(t.archivedOn)} {t.archivedOn.slice(0, 4)}. Emails already sent stay on each client.
        </p>
      ) : null}
      <dl className="grid grid-cols-4 gap-3">
        <div>
          <dt className="type-body text-zebra-500">Sent</dt>
          <dd className="type-heading tabular-nums text-zebra-950">{t.sent}</dd>
        </div>
        {stats.map(([label, n]) => (
          <div key={label}>
            <dt className="type-body text-zebra-500">{label}</dt>
            <dd className="type-heading tabular-nums text-zebra-950">{pct(n, t.sent) ?? 0}%</dd>
            <dd className="type-body tabular-nums text-zebra-400">{n}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-4">
        <Fact label="Subject">{fillFields(t.subject)}</Fact>
        <Fact label="Preview text">{t.preheader}</Fact>
        <Dropdown
          label="Signature"
          options={SIGNATURES.map((s) => ({ value: s.id, label: s.name }))}
          value={t.signature}
          onChange={(v) => state.setSignature(t.id, v as SignatureId)}
        />
        <Fact label="Fields">
          {fields.length === 0 ? (
            <span className="text-zebra-500">None, the same for everyone</span>
          ) : (
            <ul className="space-y-1">
              {fields.map((f) => (
                <li key={f.token}>
                  {f.token}
                  {f.custom ? <span className="text-zebra-500"> · your field</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Fact>
        <Fact label="Used in">{t.usedIn.length ? t.usedIn.join(', ') : <span className="text-zebra-500">Not in a workflow</span>}</Fact>
      </div>
      <section aria-labelledby="template-checks" className="space-y-3">
        <h3 id="template-checks" className="type-subheading text-zebra-950">
          In {clientName(client)}
        </h3>
        <ul className="space-y-2.5 type-body">
          {checksFor(t, client, device).map((c) => (
            <li key={c.text} className="flex gap-2">
              {c.ok ? (
                <DrawnCheck className="mt-0.5 size-4 text-grass-700" />
              ) : (
                <AlertCircle aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-warning-ink" />
              )}
              <span className={c.ok ? 'text-zebra-700' : 'text-warning-ink'}>{c.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
