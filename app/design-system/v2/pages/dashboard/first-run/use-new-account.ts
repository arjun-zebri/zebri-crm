'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { DemoPackage } from '../../onboarding/packages';
import type { Brand } from '../../onboarding/use-onboarding-state';
import type { Account, Clause, NewClient } from '../account';
import type { Tier } from '../blocks/catalog';
import { coupleName } from '../payments/payments-data';

import { REPLY, offerOf, testClient, toClient, toContract, toInvoice, toProposal, type Sent, type Stored } from './derive';
import { readSaved, roleOf, writeProgress, type Handoff } from './handoff';
import { starterFor } from './starter';

/** What the MC is to the couple, as a proposal signs off: "MC", "celebrant", "DJ". */
const roleWord = (roles: string[]) => {
  const r = roleOf(roles);
  return r === 'Celebrant' ? 'celebrant' : r;
};

/**
 * A brand new account for the first-run dashboard, and the {@link Account}
 * the real Clients, Proposals and Payments pages read. It arrives with
 * the test client (Clara & Felix) already in, so the first thing the MC does
 * is send a proposal, not fill in a form. Prices and the signature are
 * saved where they are first asked (New proposal, New contract).
 *
 * The plan gate: anything done for a REAL client (adding one, or sending
 * them anything) waits behind the plan-and-card sheet until the MC has
 * started their free week. The test client never asks. Gated actions are
 * queued and run in order once the plan starts, so the client the MC
 * just typed lands the moment the card goes in.
 *
 * Saved beside the onboarding handoff, so a reload keeps it all (except
 * a gate left open, which is dropped).
 *
 * @module app/design-system/v2/pages/dashboard/first-run/use-new-account
 */

export interface Progress {
  clients: Stored[];
  proposals: Sent[];
  contracts: Sent[];
  invoices: Sent[];
  /** Who the guide follows: the test client, then the first real client after it. */
  round: { clientId: string | null; practised: boolean };
  /** The MC's packages, saved from New proposal; empty until the first. */
  packages: DemoPackage[];
  /** Deposit percent, from setup until New proposal changes it. */
  deposit: number | null;
  signature: string | null;
  /** The plan, once the free week has started. */
  plan: Tier | null;
  /** The MC's brand, set in the first proposal editor; null until then. */
  brand: Brand | null;
  /** The MC's contract wording, saved from their first contract. */
  terms: Clause[] | null;
  /** The blocks in the sidebar, once the MC has changed them; the handoff's until then. */
  blocks: string[] | null;
  /** Whether the MC has been through Build your Zebri. */
  toolsPicked: boolean;
  /**
   * Whether the MC has seen the test client's booking celebrated. Until
   * then, Home holds as it was when the deposit landed; a reload before
   * it shows the celebration again. Missing (false) in older saves.
   */
  celebrated?: boolean | undefined;
}

function fresh(): Progress {
  const sam = testClient(Date.now());
  return {
    clients: [sam],
    proposals: [],
    contracts: [],
    invoices: [],
    round: { clientId: sam.id, practised: false },
    packages: [],
    deposit: null,
    signature: null,
    plan: null,
    brand: null,
    terms: null,
    blocks: null,
    toolsPicked: false,
    celebrated: false,
  };
}

/** The progress less the test client and everything sent to them. */
function withoutTest(s: Progress): Progress {
  const real = (x: { clientId: string }) => !isTest(x.clientId);
  return {
    ...s,
    clients: s.clients.filter((c) => !isTest(c.id)),
    proposals: s.proposals.filter(real),
    contracts: s.contracts.filter(real),
    invoices: s.invoices.filter(real),
  };
}

/**
 * A saved progress as it loads. A save from after the practice run that
 * still holds the test client (made before closing the celebration
 * cleared it) is cleared now, so Clara & Felix never linger as a booking.
 */
function loaded(saved: Progress | null): Progress {
  if (!saved) return fresh();
  if (!saved.celebrated && !saved.round.practised) return saved;
  // Still following the test client means the practice run just ended: follow the next client added.
  const round = saved.round.clientId && isTest(saved.round.clientId) ? { clientId: null, practised: true } : saved.round;
  return { ...withoutTest(saved), round };
}

/** The last reply a send gets, in ms after it: when the test client is done with it. */
const LAST = { proposals: REPLY.proposal.accepted, contracts: REPLY.contract.signed, invoices: REPLY.invoice.paid };
const isTest = (clientId: string) => clientId.startsWith('test-');

/** The new account, its progress and the guide's actions. */
export function useNewAccount() {
  const [{ handoff, progress: saved }] = useState(() => readSaved<Progress>());
  const [p, setP] = useState<Progress>(() => loaded(saved));
  const [now, setNow] = useState(() => Date.now());
  // Who the open gate is for ("Priya & Dev"; empty when the MC opened it
  // from Home with nothing waiting), and what waits behind it.
  const [gate, setGate] = useState<string | null>(null);
  const queue = useRef<(() => void)[]>([]);
  useEffect(() => writeProgress<Progress>(handoff, p), [handoff, p]);

  const pending = (['proposals', 'contracts', 'invoices'] as const).some((k) =>
    p[k].some((s) => isTest(s.clientId) && now - s.at < LAST[k]),
  );
  // Ticks only while a reply is still due; nothing runs once they are all in.
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [pending]);

  const byId = new Map(p.clients.map((c) => [c.id, c]));
  const nameOf = (id: string) => {
    const c = byId.get(id);
    return c ? coupleName(c.names) : 'your client';
  };
  const deposit = p.deposit ?? handoff.deposit;
  const update = (fn: (s: Progress) => Partial<Progress>) => setP((s) => ({ ...s, ...fn(s) }));
  /** Runs `action` now for the test client or a paid-up account; otherwise queues it behind the gate. */
  const gated = (clientId: string, who: string, action: () => void) => {
    if (isTest(clientId) || p.plan) return action();
    queue.current.push(action);
    setGate((g) => g ?? who);
  };
  const send = (key: 'proposals' | 'contracts' | 'invoices', clientId: string, extra: Partial<Sent> = {}) =>
    gated(clientId, nameOf(clientId), () => {
      const at = Date.now();
      setNow(at);
      update((s) => ({ [key]: [...s[key], { id: `${key}-${at}`, clientId, at, ...extra }] }));
    });

  const account = useMemo<Account>(() => {
    const clientOf = (s: Sent) => byId.get(s.clientId)!;
    const latest = (id: string) => [...p.proposals].reverse().find((s) => s.clientId === id);
    const mc = handoff.profile.name.trim() || 'You';
    const invoices = p.invoices.map((s, n) => toInvoice(s, n, clientOf(s), offerOf(latest(s.clientId)), deposit, now));
    const paid = new Set(invoices.filter((i) => i.paidOn).map((i) => coupleName(i.names)));
    return {
      business: handoff.profile.business.trim() || mc,
      mc: { name: mc, role: roleWord(handoff.profile.roles) },
      deposit,
      clients: p.clients.map((c) => toClient(c, p.proposals.some((s) => s.clientId === c.id), paid.has(coupleName(c.names)))),
      proposals: p.proposals.map((s) => toProposal(s, clientOf(s), now)),
      contracts: p.contracts.map((s) => toContract(s, clientOf(s), offerOf(latest(s.clientId)), mc, now)),
      invoices,
      packages: p.packages.length ? p.packages : [starterFor(handoff.profile.roles)],
      savePackage: (pkg, percent) => update((s) => ({ packages: [pkg, ...s.packages.slice(1)], deposit: percent })),
      signature: p.signature,
      saveSignature: (png) => update(() => ({ signature: png })),
      brand: p.brand,
      saveBrand: (brand) => update(() => ({ brand })),
      terms: p.terms,
      saveTerms: (terms) => update(() => ({ terms })),
      addClient(c: NewClient) {
        const id = `client-${Date.now()}`;
        gated(id, coupleName(c.names), () =>
          update((s) => ({
            clients: [...s.clients, { id, ...c, test: false, addedAt: Date.now() }],
            round: s.round.clientId ? s.round : { ...s.round, clientId: id },
          })),
        );
        return id;
      },
      sendProposal: (id, d) => send('proposals', id, d),
      sendContract: (id, clauses) => send('contracts', id, { clauses }),
      sendInvoice: (id, d) => send('invoices', id, d),
    };
    // `byId`, `gated` and `send` are rebuilt from `p` every render; `p`, `now` and the handoff are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, now, handoff]);

  return {
    handoff: handoff satisfies Handoff,
    account,
    progress: p,
    now,
    pending,
    /** Who the plan sheet is open for, or null when it is closed. */
    gate,
    /** The card went in: start the plan and run what was waiting on it. */
    startPlan(plan: Tier) {
      update(() => ({ plan }));
      const waiting = queue.current;
      queue.current = [];
      setGate(null);
      // After the plan lands in state, so each queued action sees it.
      window.setTimeout(() => waiting.forEach((run) => run()), 0);
    },
    /** Closed without a card: nothing that was waiting happens. */
    closeGate() {
      queue.current = [];
      setGate(null);
    },
    /** The sidebar's blocks, kept so a reload shows the same ones. */
    saveBlocks: (ids: string[]) => update(() => ({ blocks: ids })),
    /** Build your Zebri is done (added or not): the guide moves on to the proposal. */
    pickedTools: () => update(() => ({ toolsPicked: true })),
    /**
     * The booking celebration was closed: the practice run is over. The
     * test client and everything sent to them are cleared, so Home,
     * Clients, Proposals and Payments start empty for real work (a test
     * couple left in the lists read as a real booking), and the guide
     * follows the next client added. What the MC made along the way (brand,
     * packages, signature, contract wording, blocks) stays.
     */
    celebrate: () => update((s) => ({ ...withoutTest(s), celebrated: true, round: { clientId: null, practised: true } })),
    /** Opens the plan sheet with nothing waiting on it: the MC chose to start their week from Home. */
    askPlan: () => setGate((g) => g ?? ''),
    /** After the practice run: the guide follows the next client added. */
    startReal: () => update(() => ({ round: { clientId: null, practised: true } })),
  };
}

export type NewAccount = ReturnType<typeof useNewAccount>;
