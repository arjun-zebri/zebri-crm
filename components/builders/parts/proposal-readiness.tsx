/**
 * "Ready to send" checklist for the proposal builder.
 *
 * Send is gated on every check passing: a proposal with no contract
 * template would dead-end the couple at the Sign step (D5), and one with
 * no option has nothing to choose (D7). Phase B adds a fifth check for the
 * Proposal design surface.
 *
 * @module components/builders/parts/proposal-readiness
 */
'use client';

import { Check, Circle } from 'lucide-react';

export interface ReadinessCheck {
  key: 'couple' | 'title' | 'option' | 'contractTemplate';
  label: string;
  /**
   * Imperative, short message for {@link sendBlockReason} to surface next to
   * the disabled Send button when this is the first failing check. Distinct
   * from `label`, which is declarative and reads naturally in a checklist
   * ("Couple selected") rather than as an instruction ("Choose a couple").
   */
  blockedMessage: string;
  ok: boolean;
}

/** The slice of form state the checks read. */
export interface ReadinessInput {
  coupleId: string | null;
  title: string;
  contractTemplateId: string | null;
  options: { id: string; items: { id: string }[] }[];
}

/**
 * Evaluate every readiness check against the current form. This is the one
 * source of truth for what "ready to send" means: {@link ProposalReadiness},
 * {@link isReadyToSend}, and {@link sendBlockReason} all read this list
 * rather than re-deriving the predicates.
 */
export function readinessChecks(form: ReadinessInput): ReadinessCheck[] {
  return [
    { key: 'couple', label: 'Couple selected', blockedMessage: 'Choose a couple first', ok: !!form.coupleId },
    {
      key: 'title',
      label: 'Title written',
      blockedMessage: 'Give the proposal a title',
      ok: form.title.trim().length > 0,
    },
    {
      key: 'option',
      label: 'At least one package option',
      blockedMessage: 'Add at least one package',
      ok: form.options.length > 0,
    },
    {
      key: 'contractTemplate',
      label: 'Contract template chosen',
      blockedMessage: 'Choose a contract template below',
      ok: !!form.contractTemplateId,
    },
  ];
}

/** Whether every readiness check passes, i.e. Send may be enabled. */
export function isReadyToSend(form: ReadinessInput): boolean {
  return readinessChecks(form).every((c) => c.ok);
}

/**
 * The first failing check's imperative message, or `null` once every check
 * passes. Drives the inline "why is Send disabled" hint in `ShareAndSend`
 * so an MC does not have to scroll up to the checklist to find out.
 */
export function sendBlockReason(form: ReadinessInput): string | null {
  const firstFailing = readinessChecks(form).find((c) => !c.ok);
  return firstFailing ? firstFailing.blockedMessage : null;
}

/** Checklist rendering of {@link readinessChecks}. */
export function ProposalReadiness({ form }: { form: ReadinessInput }) {
  const checks = readinessChecks(form);
  return (
    <div className="space-y-2">
      <h4 className="text-body font-medium uppercase tracking-wide text-text-muted">Ready to send</h4>
      <ul className="space-y-1">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-body">
            {c.ok ? (
              <Check size={14} strokeWidth={1.5} className="text-success" aria-label="Done" />
            ) : (
              <Circle size={14} strokeWidth={1.5} className="text-text-subtle" aria-label="Not yet" />
            )}
            <span className={c.ok ? 'text-text' : 'text-text-muted'}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
