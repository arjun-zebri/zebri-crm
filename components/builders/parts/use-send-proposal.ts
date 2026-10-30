'use client';

/**
 * State and data behind the Send a proposal modal.
 *
 * The modal itself is three rows of UI; everything that decides what those
 * rows show lives here: the couples and templates to choose between, the
 * expiry the chosen template implies, why Send is blocked, and the two
 * actions (send now, or open the new proposal in the design editor).
 *
 * Only Send creates anything. It goes through `ensureProposal`, which
 * remembers what it made: a send that fails at the email step leaves a
 * perfectly good draft behind, and clicking Send again must reuse it
 * rather than mint the couple a second proposal.
 *
 * "Make edits" creates nothing at all. It hands back a link to
 * `/proposals/design/new`, where the editor mounts on the template's
 * layout in memory and the row appears only once the MC actually changes
 * something (founder, 2026-09-23: "it increases the proposal count when
 * youve quit out of it").
 *
 * @module components/builders/parts/use-send-proposal
 */
import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';
import { useState } from 'react';

import { createProposalFromTemplateAction } from '@/app/(dashboard)/proposals/create-from-template';
import { useProposalTemplates } from '@/app/(dashboard)/proposals/templates/use-proposal-templates';
import { getProposalSettingsAction, type TemplateListItem } from '@/features/proposals';
import { resolveCoupleEmail } from '@/lib/couples/email';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/supabase/current-user';

import type { CoupleOption } from './builder-meta-row';

/** A couple in the picker, plus the two fields the preview fills into the template's variables. */
export interface SendCoupleOption extends CoupleOption {
  /** `YYYY-MM-DD`, or null when the couple has no date yet. */
  event_date: string | null;
  venue: string | null;
}

/** Options for {@link useSendProposal}. */
export interface UseSendProposalOptions {
  /** Preselected couple (the modal was opened from a couple's profile). */
  initialCoupleId?: string | null | undefined;
  /** Preselected template (the modal was opened from a template card). Falls back to the account default. */
  initialTemplateId?: string | null | undefined;
}

/** Everything {@link useSendProposal} hands the modal. */
export interface UseSendProposalResult {
  couples: SendCoupleOption[];
  couple: SendCoupleOption | null;
  templates: TemplateListItem[];
  template: TemplateListItem | null;
  /** True while the templates list is still loading; the preview shows its skeleton. */
  loadingTemplates: boolean;
  /**
   * True until everything Send depends on has loaded (the couples list, the
   * contract templates). The footer disables both actions while it is set
   * and shows no reason: a preselected couple would otherwise flash
   * "Choose a couple first" before its row arrives.
   */
  loading: boolean;
  /** Set when the templates list failed; the preview shows `ErrorState`. */
  templatesError: Error | null;
  retryTemplates: () => void;
  /** The expiry the proposal would be created with (`YYYY-MM-DD`), or null while the defaults load. */
  expiresAt: string | null;
  /** The deposit the proposal would be created with, or null while the defaults load. The preview resolves `{{ deposit_percent }}` from it. */
  depositPercent: number | null;
  selectCouple: (couple: CoupleOption) => void;
  selectTemplate: (templateId: string) => void;
  setExpiresAt: (next: string | null) => void;
  /** Why Send is disabled, in the imperative voice, or null when it is ready. */
  sendBlockReason: string | null;
  /** Whether "Make edits" can run: it needs the same couple and template, but not an email address. */
  canEdit: boolean;
  /** Creates the proposal (once) then emails the couple; resolves with the proposal's id. */
  send: UseMutationResult<string, Error, void>;
  /**
   * Where "Make edits" goes: the design editor for a proposal that does
   * not exist yet, carrying the couple, the template and the expiry. Null
   * until there is something to edit.
   */
  editHref: string | null;
}

/**
 * The "Make edits" destination. A link rather than a create: see the
 * module doc, and `app/(dashboard)/proposals/design/new/page.tsx` for the
 * params it reads back.
 */
function editHrefFor(coupleId: string, templateId: string, expiresAt: string | null): string {
  const params = new URLSearchParams({ couple: coupleId, template: templateId });
  if (expiresAt) params.set('expires', expiresAt);
  return `/proposals/design/new?${params.toString()}`;
}

/** `days` from today as `YYYY-MM-DD`, UTC throughout so the date does not shift with the browser's timezone. Mirrors `create-from-template.ts`'s own `inDays`. */
function inDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** See {@link UseSendProposalResult}. */
export function useSendProposal({ initialCoupleId, initialTemplateId }: UseSendProposalOptions): UseSendProposalResult {
  const supabase = createClient();
  const [coupleId, setCoupleId] = useState<string | null>(initialCoupleId ?? null);
  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId ?? null);
  const [expiryOverride, setExpiryOverride] = useState<string | null>(null);
  // The proposal a first attempt already created, so a retry reuses it.
  const [createdId, setCreatedId] = useState<string | null>(null);

  const { data: couples } = useQuery({
    queryKey: ['couples-for-send-proposal'],
    queryFn: async (): Promise<SendCoupleOption[]> => {
      const user = await getCurrentUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from('couples')
        .select('id, name, primary_email, email, event_date, venue')
        .eq('user_id', user.id)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const templatesQuery = useProposalTemplates();
  const templates = templatesQuery.data ?? [];
  // Default first, then freshest: the same order `create-from-template.ts`
  // resolves "the default" in, so the preview and the server agree on
  // which template an MC who never touched the picker is sending.
  const template = templates.find((t) => t.id === templateId) ?? templates[0] ?? null;

  const { data: accountSettings } = useQuery({
    queryKey: ['proposal-settings'],
    queryFn: async () => {
      const result = await getProposalSettingsAction();
      if (!result.ok) throw new Error(result.error);
      return result.settings;
    },
  });

  // A template's own settings snapshot is always complete, so it replaces
  // the account defaults outright rather than merging (`resolveTemplateSettings`).
  const expiryDays = template?.settings?.expiry_days ?? accountSettings?.expiry_days ?? null;
  const expiresAt = expiryOverride ?? (expiryDays === null ? null : inDays(expiryDays));
  const depositPercent: number | null = template?.settings?.deposit_percent ?? accountSettings?.deposit_percent ?? null;

  // The send route refuses a proposal with no contract template, and the
  // create path can only inherit one the account actually has. Asking here
  // turns that late 400 into a reason the MC can read before clicking.
  const contractTemplatesQuery = useQuery({
    queryKey: ['has-contract-template'],
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase.from('contract_templates').select('id', { count: 'exact', head: true });
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const couple = couples?.find((c) => c.id === coupleId) ?? null;
  // A failed contract-templates read leaves `data` undefined without
  // pending: that must not block sending, so only the pending state waits
  // and only an explicit `false` blocks. The send route is still the
  // authority and will say so if it really is missing.
  const hasContractTemplate = contractTemplatesQuery.data;
  const loading = couples === undefined || contractTemplatesQuery.isPending || templatesQuery.isPending;
  const sendBlockReason = loading
    ? null
    : !couple
    ? 'Choose a couple first'
    : !template
      ? 'Create a proposal template first'
      : !resolveCoupleEmail(couple)
        ? `${couple.name} has no email address yet`
        : hasContractTemplate === false
          ? 'Add a contract template in Templates first'
          : null;

  /** Create the proposal once, then hand back its id on every later call. */
  const ensureProposal = async (): Promise<string> => {
    if (createdId) return createdId;
    if (!couple || !template) throw new Error('Choose a couple and a template first.');
    const result = await createProposalFromTemplateAction({ coupleId: couple.id, templateId: template.id, expiresAt });
    if (!result.ok) throw new Error(result.error);
    setCreatedId(result.proposalId);
    return result.proposalId;
  };

  const send = useMutation<string, Error, void>({
    mutationFn: async () => {
      const id = await ensureProposal();
      const response = await fetch('/api/email/send-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: id }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error ?? 'Failed to send');
      return id;
    },
  });

  // Any change to what would be created invalidates the remembered draft:
  // reusing it would send the couple the previous choice.
  const forget = () => setCreatedId(null);

  return {
    couples: couples ?? [],
    couple,
    templates,
    template,
    loadingTemplates: templatesQuery.isPending,
    loading,
    templatesError: templatesQuery.error,
    retryTemplates: () => void templatesQuery.refetch(),
    expiresAt,
    depositPercent,
    selectCouple: (next) => { setCoupleId(next.id); forget(); },
    selectTemplate: (next) => { setTemplateId(next); setExpiryOverride(null); forget(); },
    setExpiresAt: (next) => { setExpiryOverride(next); forget(); },
    sendBlockReason,
    // "Make edits" only needs something to edit: no email address and no
    // contract template are send-time concerns, fixable before sending.
    canEdit: !loading && couple !== null && template !== null,
    send,
    editHref: couple && template ? editHrefFor(couple.id, template.id, expiresAt) : null,
  };
}
