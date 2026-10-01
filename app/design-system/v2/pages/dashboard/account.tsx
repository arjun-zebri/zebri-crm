'use client';

import { createContext, useContext } from 'react';

import type { DemoPackage } from '../onboarding/packages';
import type { Brand } from '../onboarding/use-onboarding-state';

import { CLIENTS, type Client } from './clients/clients-data';
import type { Span } from './payments/dates';
import { BUSINESS, CONTRACTS, INVOICE_SEEDS, coupleName, type Contract, type InvoiceSeed } from './payments/payments-data';
import { generatedProposals } from './proposals/generated-proposals';
import { NAMED } from './proposals/named-proposals';
import type { ProposalSeed } from './proposals/proposals-data';
import { DEPOSIT, PACKAGES, type TemplateId } from './proposals/templates-data';

/**
 * The account the v2 dashboard's pages show: its clients, proposals,
 * invoices and contracts, and what New can create. Clients, Proposals
 * and Payments read it through {@link useAccount} rather than importing
 * their demo data, so the same real pages can show the full demo
 * business (the default, `/design-system/v2/dashboard`) or a brand new
 * account that the first-run guide fills in
 * (`/design-system/v2/dashboard/new`).
 *
 * The create actions are optional: the demo account leaves them out,
 * so its New buttons behave as before (view only); an account that has
 * them gets working New flows.
 *
 * @module app/design-system/v2/pages/dashboard/account
 */

/** A contract clause: its heading and wording. */
export type Clause = [title: string, text: string];

/** What the proposal editor sends: the template, the MC's package and their words. */
export interface ProposalDraft {
  template: TemplateId;
  offer: DemoPackage;
  headline: string;
  welcome: string;
}

/** What the invoice editor sends: the deposit share, when it is due, and a note. */
export interface InvoiceDraft {
  percent: number;
  dueDays: number;
  note: string;
  /** When the deposit is due, as the MC set it (`dueDays` is the same in days). */
  due?: Span | undefined;
  /** How long before the event the balance falls due; 14 days when left out. */
  balance?: Span | undefined;
}

/** What New client collects. */
export interface NewClient {
  names: [string, string];
  email: string;
  /** ISO date of their event, or empty. */
  date: string;
  venue: string;
  phone?: string | undefined;
  /** Roughly how many guests, as typed. */
  guests?: string | undefined;
  /** The package they asked about, by name. */
  interest?: string | undefined;
  /** How they found the MC: Instagram, Google, a referral… */
  source?: string | undefined;
  /** The MC's own notes on the enquiry. */
  notes?: string | undefined;
}

export interface Account {
  /** The MC's business, as it heads documents. */
  business: string;
  /**
   * How couples reach and pay the business, printed on invoices and
   * contracts: ABN, email, phone and bank. The demo business has them; a
   * new account has not given them yet, so its documents leave them off.
   */
  contact?: { abn: string; email: string; phone: string; bank: string } | undefined;
  /** The MC themselves, as a proposal signs off: their name and what they are to the couple. */
  mc?: { name: string; role: string } | undefined;
  /** Deposit that holds a date, as a percent of the package. */
  deposit: number;
  clients: Client[];
  proposals: ProposalSeed[];
  invoices: InvoiceSeed[];
  contracts: Contract[];
  /** Adds a client; returns the new client's id. */
  addClient?: ((c: NewClient) => string) | undefined;
  /** Sends a proposal made in the editor to a client. An account with this gets the editor after New proposal. */
  sendProposal?: ((clientId: string, draft: ProposalDraft) => void) | undefined;
  /**
   * The MC's brand (logo, colours, fonts), which every document wears.
   * Null until they set it, the first time they open the proposal editor.
   */
  brand?: Brand | null | undefined;
  saveBrand?: ((brand: Brand) => void) | undefined;
  /** The MC's contract wording, saved from the first contract they send. Null until then. */
  terms?: Clause[] | null | undefined;
  saveTerms?: ((terms: Clause[]) => void) | undefined;
  /**
   * The MC's packages. An account that can save one (`savePackage`) asks
   * "What does it cost?" inside New proposal, the first time it matters,
   * instead of in setup.
   */
  packages?: DemoPackage[] | undefined;
  savePackage?: ((pkg: DemoPackage, deposit: number) => void) | undefined;
  /**
   * The MC's signature (a PNG data URL), or null before they have signed.
   * An account that can save one asks for it inside New contract, once.
   */
  signature?: string | null | undefined;
  saveSignature?: ((png: string) => void) | undefined;
  /** Sends the contract for a client's accepted proposal, with the clauses as edited. */
  sendContract?: ((clientId: string, clauses: Clause[]) => void) | undefined;
  /** Sends the deposit invoice for a client's accepted proposal. */
  sendInvoice?: ((clientId: string, draft: InvoiceDraft) => void) | undefined;
}

/** The demo business every v2 page was designed against. */
export const DEMO_ACCOUNT: Account = {
  business: 'Arjun Punekar MC',
  contact: { abn: BUSINESS.abn, email: BUSINESS.email, phone: '0400 123 456', bank: 'BSB 062-000 · Acc 1234 5678' },
  deposit: DEPOSIT,
  clients: CLIENTS,
  proposals: [...NAMED, ...generatedProposals()],
  invoices: INVOICE_SEEDS,
  contracts: CONTRACTS,
};

/**
 * What a client has accepted, for their contract and invoices: the
 * package and its price from their accepted proposal. Null until one
 * is accepted, because both are made from it.
 */
export function acceptedFor(account: Account, name: string) {
  const p = account.proposals.find((x) => coupleName(x.names) === name && x.acceptedOn && x.chosen);
  if (!p?.chosen) return null;
  const pkg = p.offer ?? PACKAGES[p.chosen];
  return { proposal: p, pkg, deposit: Math.round((pkg.price * account.deposit) / 100) };
}

export const AccountContext = createContext<Account>(DEMO_ACCOUNT);

/** The account on screen: the demo one unless a provider says otherwise. */
export const useAccount = () => useContext(AccountContext);
