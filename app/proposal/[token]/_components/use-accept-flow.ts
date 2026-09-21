'use client';

/**
 * Drives the public proposal's Choose -> Sign -> Pay -> Done flow: posts
 * `/api/proposal/accept` and `/api/contract/sign`, and resumes on the
 * right step (see `./resume-flow`) so a reload mid-flow (the couple
 * reopens the email link, or a payment redirect brings them back) lands
 * them where they left off instead of restarting the whole thing.
 *
 * @module app/proposal/[token]/_components/use-accept-flow
 */
import { useEffect, useState } from 'react';

import type { SignatureMode } from '@/lib/contracts/signature-image';
import type { AcceptResponse, PublicProposalInvoice } from '@/lib/proposals/close-types';
import type { PublicProposal } from '@/lib/proposals/public-types';

import { emitEngagement } from './engagement-bus';
import { type AcceptStep, initialFlow, type FlowState } from './resume-flow';

export type { AcceptStep } from './resume-flow';

/** What `useAcceptFlow` returns: the current pane plus the actions that advance it. */
export interface AcceptFlow {
  step: AcceptStep;
  /** True while an `accept()` or `sign()` request is in flight. */
  busy: boolean;
  /** The last request's failure copy, or null once cleared by a new attempt. */
  error: string | null;
  /** The accepted option's draft contract, once `accept()` (or a resume) has one. */
  contract: AcceptResponse | null;
  /** The booking's invoice, once signing (or a resume) has one. */
  invoice: PublicProposalInvoice | null;
  /** Post the couple's choice to `/api/proposal/accept`. No-op without a selected option. */
  accept(): Promise<void>;
  /** Post the signature to `/api/contract/sign`. No-op without a draft contract. */
  sign(input: { signerName: string; signatureMode: SignatureMode; signatureImage: string | null }): Promise<void>;
  /** Move straight to `'done'`, for "pay later by bank transfer". */
  skipPayment(): void;
  /** Jump to a step directly, for the sign step's "Back". */
  goTo(step: AcceptStep): void;
}

/** Copy for every `accept_proposal` error the route can return. */
const ACCEPT_ERROR_COPY: Record<string, string> = {
  expired: 'This proposal has expired.',
  declined: 'This proposal was declined.',
  already_accepted: 'This proposal has already been accepted.',
  not_found: 'This proposal is no longer available.',
  no_template: 'This proposal cannot be accepted yet. Please contact us.',
  invalid_option: 'Please choose a package.',
  invalid_addon: 'One of the extras is no longer available.',
};

/** Copy for the `sign_contract_v2` errors the sign route surfaces verbatim. */
const SIGN_ERROR_COPY: Record<string, string> = {
  already_signed: 'This contract has already been signed.',
  expired: 'This contract has expired.',
};

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** See {@link AcceptFlow}. */
export function useAcceptFlow(input: {
  token: string;
  proposal: PublicProposal;
  selectedOptionId: string | null;
  selectedAddonIds: readonly string[];
  /** Whether the stepper dialog is currently showing, so a step change is only reported while the couple can actually see it. */
  open: boolean;
}): AcceptFlow {
  const { token, proposal, selectedOptionId, selectedAddonIds, open } = input;
  // Lazy initializer: the resume derivation only needs to run once, at
  // mount, from the proposal the page loaded with.
  const [state, setState] = useState<FlowState>(() => initialFlow(proposal));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fires on mount, on every step transition, and whenever the dialog
  // opens on a step it was already at (e.g. a resumed sign step) -- but
  // never while closed, since a step no one can see was not "reached".
  useEffect(() => {
    if (!open) return;
    emitEngagement({ type: 'step_reached', payload: { step: state.step } });
  }, [open, state.step]);

  const accept = async () => {
    if (!selectedOptionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/proposal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, optionId: selectedOptionId, addonIds: selectedAddonIds }),
      });
      const json = (await res.json()) as AcceptResponse | { error?: string };
      if (res.ok) {
        setState({ step: 'sign', contract: json as AcceptResponse, invoice: null });
      } else {
        setError(ACCEPT_ERROR_COPY[(json as { error?: string }).error ?? ''] ?? GENERIC_ERROR);
      }
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const sign: AcceptFlow['sign'] = async ({ signerName, signatureMode, signatureImage }) => {
    if (!state.contract) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/contract/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: state.contract.sign_token,
          signer_name: signerName,
          signature_mode: signatureMode,
          // Only sent for a drawn mark: the sign route treats it as optional
          // and a typed signature has no image to send.
          ...(signatureImage ? { signature_image: signatureImage } : {}),
        }),
      });
      const json = (await res.json()) as { proposal_invoice?: PublicProposalInvoice | null; error?: string };
      if (res.ok) {
        const invoice = json.proposal_invoice ?? null;
        setState((prev) => ({ ...prev, invoice, step: invoice?.first_stage ? 'pay' : 'done' }));
        emitEngagement({ type: 'accepted', payload: {} });
      } else {
        setError(SIGN_ERROR_COPY[json.error ?? ''] ?? GENERIC_ERROR);
      }
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const skipPayment = () => setState((prev) => ({ ...prev, step: 'done' }));
  const goTo = (step: AcceptStep) => setState((prev) => ({ ...prev, step }));

  return { step: state.step, busy, error, contract: state.contract, invoice: state.invoice, accept, sign, skipPayment, goTo };
}
