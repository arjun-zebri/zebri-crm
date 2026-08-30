/**
 * Contract builder modal.
 *
 * Phase 3.1 rewrite — orchestrator over the shared
 * `components/builders/parts/*` set + the new contract-specific
 * parts (`contract-body-editor`, `contract-signature-display`,
 * `contract-preview-pane`).
 *
 * Mirrors the post-2C.2 invoice modal shape:
 * - `BuilderModalShell` provides the modal frame, hero title input,
 *   state pill, overflow menu, trash icon.
 * - Right-pane preview shows the rendered contract HTML (live JSON
 *   for drafts, locked snapshot for sent+).
 * - All mutations route through server actions in
 *   `app/(dashboard)/payments/actions.ts` — no inline supabase
 *   calls. Send still goes through `/api/email/send-contract`
 *   (authenticated + plan-gated route from Phase 2C).
 *
 * Status state machine:
 * - draft (neutral) — editable
 * - sent (info + hollow dot) — locked, can be revoked
 * - signed (success + filled dot) — locked, PDF available
 * - declined (danger) — locked, terminal
 * - expired (neutral) — locked, terminal
 * - revoked (warning + filled dot) — back to draft semantically; the
 *   underlying RPC also clears the snapshot so it's identical to
 *   draft from an edit perspective. The "revoked" label only shows
 *   transiently after an MC clicks Revoke & Edit before the modal
 *   re-fetches.
 *
 * @module components/builders/contract-builder-modal
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';


import {
  deleteContractAction,
  revokeContractAction,
  saveContractAction,
  type SaveContractInput,
} from '@/app/(dashboard)/payments/actions';
import { BuilderMetaRow } from '@/components/builders/parts/builder-meta-row';
import {
  type BuilderModalPrimaryAction,
  BuilderModalShell,
  type OverflowMenuItem,
} from '@/components/builders/parts/builder-modal-shell';
import { BuilderPreviewPane } from '@/components/builders/parts/builder-preview-pane';
import { ContractBodyEditor } from '@/components/builders/parts/contract-body-editor';
import { ContractSignatureDisplay } from '@/components/builders/parts/contract-signature-display';
import type { JSONContent } from '@/components/builders/parts/contract-types';
import { toPublicContract, type PreviewDoc } from '@/components/builders/parts/preview-shared';
import { ShareAndSend } from '@/components/builders/parts/share-and-send';
import { printContract } from '@/components/print/print-contract';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { StatePillProps } from '@/components/ui/state-pill';
import { useToast } from '@/components/ui/toast';
import { useCurrentBranding } from '@/lib/branding/use-current-branding';
import {
  buildContractVariables,
  findUnknownVariables,
  renderContractHtml,
} from '@/lib/contracts/contract-variables';
import { pendingSignerLinks, signerLinks } from '@/lib/contracts/signer-links';
import { coupleDisplayName } from '@/lib/couples/display-name';
import { resolveCoupleEmail } from '@/lib/couples/email';
import { createClient } from '@/lib/supabase/client';

interface Contract {
  id: string;
  /** Null until the sender titles it; never auto-generated. */
  title: string | null;
  contract_number: string;
  status: string;
  content: JSONContent;
  expires_at: string | null;
  share_token: string;
  share_token_enabled: boolean;
  couple_id: string;
  signed_at: string | null;
  signer_name: string | null;
  signer_ip: string | null;
  signer_user_agent: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  mc_signature_name: string | null;
  locked_content_html: string | null;
  email_sent_at: string | null;
}

interface ContractTemplate {
  id: string;
  name: string;
  description: string | null;
  content: JSONContent;
}

interface FirstEventRow {
  date: string | null;
  venue: string | null;
}

const STATE_PILL: Record<string, StatePillProps> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info', dot: 'hollow' },
  signed: { label: 'Signed', tone: 'success', dot: 'filled' },
  declined: { label: 'Declined', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
  revoked: { label: 'Revoked', tone: 'warning', dot: 'filled' },
};

const DEFAULT_TEMPLATE: JSONContent = {
  type: 'doc',
  content: [
    // No leading heading: the Contract header block in Branding owns the
    // document's title. A heading here would print a second one under it.
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'This agreement is between ' },
        { type: 'mention', attrs: { id: 'mc_business_name', label: 'Your business name' } },
        { type: 'text', text: ' ("the ' },
        { type: 'mention', attrs: { id: 'vendor_role', label: 'Your role' } },
        { type: 'text', text: '") and ' },
        { type: 'mention', attrs: { id: 'couple_name', label: 'Couple name' } },
        { type: 'text', text: ' ("the Couple") for wedding ' },
        { type: 'mention', attrs: { id: 'vendor_role', label: 'Your role' } },
        { type: 'text', text: ' services on ' },
        { type: 'mention', attrs: { id: 'event_date', label: 'Event date' } },
        { type: 'text', text: ' at ' },
        { type: 'mention', attrs: { id: 'venue', label: 'Venue' } },
        { type: 'text', text: '.' },
      ],
    },
  ],
};

export interface ContractBuilderModalProps {
  /** `null` composes a fresh draft; the couple is picked in the modal. */
  contractId: string | null;
  /** Pre-selects the couple, e.g. when opened from a couple profile. */
  initialCoupleId?: string;
  initialCoupleName?: string;
  isOpen: boolean;
  onClose: () => void;
  /** Fired with the new contract's id the first time a fresh draft is
   *  saved, so a parent list can pick the row up. */
  onCreated?: (contractId: string) => void;
}

export function ContractBuilderModal({
  contractId,
  initialCoupleId,
  initialCoupleName,
  isOpen,
  onClose,
  onCreated,
}: ContractBuilderModalProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Adopt the id of a contract first saved from the "new" state so the
  // detail query — and with it the share link, Send, and PDF actions —
  // light up without reopening the modal.
  const [savedId, setSavedId] = useState<string | null>(null);
  const effectiveId = contractId ?? savedId;
  const isNew = !effectiveId;

  /* ─── form state ────────────────────────────────────────────── */
  const [coupleId, setCoupleId] = useState<string | null>(initialCoupleId ?? null);
  const [coupleName, setCoupleName] = useState<string | null>(initialCoupleName ?? null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<JSONContent>(DEFAULT_TEMPLATE);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /* ─── data ──────────────────────────────────────────────────── */
  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', effectiveId],
    enabled: isOpen && !!effectiveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', effectiveId!)
        .single();
      if (error) throw error;
      return data as Contract;
    },
  });

  // Couples for the in-modal picker. Only needed while the couple is
  // still changeable, i.e. before the draft has been saved.
  const { data: couples } = useQuery({
    queryKey: ['all-couples-for-contract'],
    enabled: isOpen && isNew,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return [];
      const { data, error } = await supabase
        .from('couples')
        .select('id, name')
        .eq('user_id', userRes.user.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  // The address the send route will mail. Fetched separately from the
  // picker list because that list is only loaded while the contract is
  // still a draft, and the preview needs the recipient at every stage.
  const { data: coupleDetails } = useQuery({
    queryKey: ['couple-contract-details', coupleId],
    enabled: isOpen && !!coupleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('couples')
        .select('primary_email, email, primary_name, secondary_name')
        .eq('id', coupleId!)
        .single();
      if (error) throw error;
      return {
        email: resolveCoupleEmail(data),
        primaryName: data.primary_name,
        secondaryName: data.secondary_name,
      };
    },
  });
  const coupleEmail = coupleDetails?.email;

  // Signing roster. Only meaningful once a contract exists and has been sent;
  // on a draft the signers are seeded but nobody has been asked yet.
  const { data: signers } = useQuery({
    queryKey: ['contract-signers', effectiveId],
    enabled: isOpen && !!effectiveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_signers')
        .select('id, name, role, required, signed_at, declined_at, sign_token')
        .eq('contract_id', effectiveId!)
        .order('signing_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: templates } = useQuery({
    queryKey: ['contract-templates'],
    enabled: isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('id, name, description, content')
        .order('position', { ascending: true });
      if (error) throw error;
      return (data as ContractTemplate[]) || [];
    },
  });

  // Pulled so the preview can substitute the `{{event_date}}` /
  // `{{venue}}` mentions with real values during draft editing.
  const { data: firstEvent } = useQuery({
    queryKey: ['couple-first-event', coupleId],
    enabled: isOpen && !!coupleId,
    queryFn: async () => {
      const { data } = await supabase
        .from('events')
        .select('date, venue')
        .eq('couple_id', coupleId!)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle();
      return (data as FirstEventRow | null) ?? null;
    },
  });

  /* ─── hydrate state from DB ─────────────────────────────────── */
  useEffect(() => {
    if (!contract) return;
    // `contracts.title` is nullable now that nothing auto-generates one; the
    // title input is controlled, so null would make React drop to uncontrolled.
    setTitle(contract.title ?? '');
    setContent(
      contract.content && Object.keys(contract.content).length > 0
        ? contract.content
        : DEFAULT_TEMPLATE,
    );
    setExpiresAt(contract.expires_at);
    setCoupleId(contract.couple_id);
    setDirty(false);
  }, [contract]);

  // A saved contract carries only `couple_id`, so resolve the name for
  // the picker + preview from whichever source knows it.
  useEffect(() => {
    if (!coupleId) {
      setCoupleName(null);
      return;
    }
    const match = couples?.find((c) => c.id === coupleId);
    if (match) setCoupleName(match.name);
    else if (coupleId === initialCoupleId && initialCoupleName) setCoupleName(initialCoupleName);
  }, [coupleId, couples, initialCoupleId, initialCoupleName]);

  // Start clean on the next open rather than reloading the draft that
  // was just saved from the "new" state.
  useEffect(() => {
    if (isOpen) return;
    setSavedId(null);
    setCoupleId(initialCoupleId ?? null);
    setCoupleName(initialCoupleName ?? null);
    setTitle('');
    setContent(DEFAULT_TEMPLATE);
    setExpiresAt(null);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on close only
  }, [isOpen]);

  /* ─── derived ───────────────────────────────────────────────── */
  const status = contract?.status ?? 'draft';
  const canEdit = status === 'draft' || status === 'revoked';
  const isSigned = status === 'signed';
  const isDeclined = status === 'declined';

  /* ─── preview HTML (substituted) ────────────────────────────── */
  // Build the preview HTML lazily — for locked statuses we use the
  // server-side snapshot directly; for draft we substitute against
  // whatever we can resolve client-side (couple + event + quote +
  // user_metadata) so the preview reflects the real document.
  const [userMeta, setUserMeta] = useState<Record<string, unknown>>({});
  const [userEmail, setUserEmail] = useState<string | null>(null);
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserMeta((user?.user_metadata ?? {}) as Record<string, unknown>);
      setUserEmail(user?.email ?? null);
    };
    void fetchUser();
  }, [supabase]);

  // Both partners in full, for the preview header, the PDF and the
  // {{couple_name}} variable alike. Derived once: when this was inlined at
  // each call site, one of them kept the couple's short list label.
  // The Contract header block supplies the heading when a contract has no
  // title of its own; the PDF needs the same tree the page renders from.
  const { branding, blocks: brandingBlocks } = useCurrentBranding('contract');

  const coupleFullName = coupleDisplayName({
    name: coupleName,
    primary_name: coupleDetails?.primaryName,
    secondary_name: coupleDetails?.secondaryName,
  });

  // Merge fields in the body that no variable resolves. Drives both the
  // pre-send block and the inline warning under the editor.
  const unknownVars = useMemo(
    () => (canEdit ? findUnknownVariables(content) : []),
    [canEdit, content],
  );

  const previewHtml = useMemo(() => {
    // Locked snapshot wins when present — that's the legally-binding
    // text the couple actually saw, byte for byte.
    if (!canEdit && contract?.locked_content_html) {
      return contract.locked_content_html;
    }

    const vars = buildContractVariables({
      couple: {
        name: coupleName ?? '',
        email: coupleDetails?.email ?? null,
        primary_name: coupleDetails?.primaryName ?? null,
        secondary_name: coupleDetails?.secondaryName ?? null,
      },
      firstEvent: firstEvent ?? null,
      userMeta,
      userEmail,
    });
    return renderContractHtml(content, vars);
  }, [
    canEdit,
    contract?.locked_content_html,
    content,
    coupleName,
    coupleDetails,
    firstEvent,
    userMeta,
    userEmail,
  ]);

  /* ─── mutations ─────────────────────────────────────────────── */
  const save = useMutation({
    mutationFn: async () => {
      if (!coupleId) throw new Error('Pick a couple for this contract first');
      const input: SaveContractInput = {
        contractId: effectiveId,
        coupleId,
        title,
        content,
        expiresAt: expiresAt,
      };
      const result = await saveContractAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data.id;
    },
    onSuccess: (id) => {
      setDirty(false);
      // First save of a fresh draft: adopt the new id so the detail
      // query hydrates and the send/share actions become available.
      if (!effectiveId) {
        setSavedId(id);
        onCreated?.(id);
      }
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contract-signers', id] });
      queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] });
      queryClient.invalidateQueries({ queryKey: ['contracts-couple-limit'] });
      queryClient.invalidateQueries({ queryKey: ['all-contracts'] });
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : 'Failed to save contract', 'error'),
  });

  const send = async () => {
    if (!coupleId) {
      toast('Pick a couple for this contract first', 'error');
      return;
    }
    // Catch unresolvable merge fields here as well as server-side, so the MC
    // is told which field to remove before the save/send round trip rather
    // than after it. The send route enforces the same rule authoritatively.
    if (unknownVars.length > 0) {
      toast(
        `Remove ${unknownVars.map((v) => `{{${v}}}`).join(', ')} from the body ` +
          'before sending. Those merge fields no longer exist.',
        'error',
      );
      return;
    }
    // A never-saved draft has no row (and so no share token) for the
    // send route to work against, so always save it first. `save`
    // surfaces its own error toast; bail out rather than send on a
    // stale document.
    let idToSend = effectiveId;
    if (!idToSend || dirty) {
      try {
        idToSend = await save.mutateAsync();
      } catch {
        return;
      }
    }
    setSending(true);
    try {
      const res = await fetch('/api/email/send-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: idToSend }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Failed to send contract', 'error');
      } else {
        toast('Contract sent');
        queryClient.invalidateQueries({ queryKey: ['contract', idToSend] });
        queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] });
        queryClient.invalidateQueries({ queryKey: ['all-contracts'] });
      }
    } finally {
      setSending(false);
    }
  };

  const revoke = useMutation({
    mutationFn: async () => {
      if (!effectiveId) return;
      const result = await revokeContractAction(effectiveId);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      toast('Contract revoked — you can now edit');
      setConfirmingRevoke(false);
      queryClient.invalidateQueries({ queryKey: ['contract', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] });
      queryClient.invalidateQueries({ queryKey: ['all-contracts'] });
    },
    onError: (err) => {
      toast(
        err instanceof Error ? err.message : 'Failed to revoke contract',
        'error',
      );
      setConfirmingRevoke(false);
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      // Nothing persisted yet — discarding is just closing the modal.
      if (!effectiveId) return;
      const result = await deleteContractAction(effectiveId);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      toast(effectiveId ? 'Contract deleted' : 'Draft discarded');
      setConfirmingDelete(false);
      queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] });
      queryClient.invalidateQueries({ queryKey: ['contracts-couple-limit'] });
      queryClient.invalidateQueries({ queryKey: ['all-contracts'] });
      onClose();
    },
    onError: (err) => {
      toast(
        err instanceof Error ? err.message : 'Failed to delete contract',
        'error',
      );
      setConfirmingDelete(false);
    },
  });

  /* ─── PDF download ──────────────────────────────────────────── */
  const downloadPdf = () => {
    if (!contract || !branding) return;
    // Prints the same `ContractBrandedCard` the public link renders, so the
    // PDF cannot drift from what the couple signed.
    printContract(
      toPublicContract(previewDoc, branding, brandingBlocks, {
        id: contract.id,
        expiresAt: contract.expires_at,
        declinedAt: contract.declined_at,
        declinedReason: contract.declined_reason,
        emailSentAt: contract.email_sent_at,
        eventDate: firstEvent?.date ?? null,
        venue: firstEvent?.venue ?? null,
      }),
    );
  };

  /* ─── chrome wiring ─────────────────────────────────────────── */
  const pillKey = (status in STATE_PILL ? status : 'draft') as keyof typeof STATE_PILL;

  // Header CTA: Download PDF only when signed. Sent uses the overflow
  // menu's "Revoke & Edit" entry; draft has no header CTA (Send
  // button in the footer is the primary action).
  const primaryAction: BuilderModalPrimaryAction | undefined = isSigned
    ? { label: 'Download PDF', onClick: downloadPdf }
    : undefined;

  const overflowItems: OverflowMenuItem[] = [];
  if (status === 'sent') {
    overflowItems.push({
      label: 'Revoke & Edit',
      danger: true,
      onClick: () => setConfirmingRevoke(true),
    });
  }

  const shareUrl =
    typeof window !== 'undefined' && contract?.share_token
      ? `${window.location.origin}/contract/${contract.share_token}`
      : null;

  // One link per contact for the footer's Copy link popover, offered in every
  // state so the MC can line links up before sending. Tokens are seeded when
  // the contract row is inserted, so an unsaved draft shows the contacts by
  // name and saves itself when the popover opens; the public RPC refuses
  // drafts, so the note says the links go live on send.
  const contactLinks = !coupleId
    ? undefined
    : typeof window !== 'undefined' && signers?.length
      ? signerLinks(signers, window.location.origin)
      : pendingSignerLinks(coupleDetails?.primaryName, coupleDetails?.secondaryName);
  const contactLinksNote = save.isPending
    ? 'Saving the contract to create the links.'
    : status === 'draft'
      ? 'These links go live when you send the contract.'
      : undefined;
  const onContactLinksOpen = () => {
    if (isNew && !save.isPending) save.mutate();
  };

  // PreviewDoc fed to the shared BuilderPreviewPane. Contract-only
  // fields (contractHtml / lockedHtml / signer info) flow through;
  // the unused quote/invoice slots stay at defaults.
  const previewDoc: PreviewDoc = {
    kind: 'contract',
    documentNumber: contract?.contract_number ?? 'CTR-…',
    // Empty until the sender writes one; the preview then shows no heading,
    // which is what the couple would actually receive.
    title,
    status,
    coupleName: coupleFullName,
    businessName: (userMeta.business_name as string | undefined) ?? null,
    items: [],
    taxRate: 0,
    discount: null,
    notes: null,
    expiresAt: expiresAt,
    shareUrl,
    contractHtml: previewHtml,
    lockedHtml: contract?.locked_content_html ?? null,
    signerName: contract?.signer_name ?? null,
    signedAt: contract?.signed_at ?? null,
    signerIp: contract?.signer_ip ?? null,
    signerUserAgent: contract?.signer_user_agent ?? null,
    mcSignatureName:
      contract?.mc_signature_name ??
      (userMeta.mc_signature_name as string | undefined) ??
      (userMeta.display_name as string | undefined) ??
      null,
  };

  return (
    <>
      <BuilderModalShell
        isOpen={isOpen}
        onClose={onClose}
        documentNumber={contract?.contract_number ?? 'Contract'}
        statePill={STATE_PILL[pillKey]}
        primaryAction={primaryAction}
        overflowItems={overflowItems}
        onDelete={() => setConfirmingDelete(true)}
        deleteLabel={isNew ? 'Discard draft' : 'Delete contract'}
        loading={isLoading && !contract}
        title={title}
        onTitleChange={(v) => {
          setTitle(v);
          setDirty(true);
        }}
        titlePlaceholder="Optional: override the heading from Branding" 
        titleReadOnly={!canEdit}
        previewPane={
          <BuilderPreviewPane doc={previewDoc} surface="contract" coupleEmail={coupleEmail} />
        }
        footer={
          <ShareAndSend
            dirty={dirty}
            // A contract has no body for the couple until send freezes it, so
            // the link (and the public RPC behind it) is live only from 'sent'.
            shareEnabled={(contract?.share_token_enabled ?? false) && contract?.status !== 'draft'}
            shareUrl={shareUrl}
            lastSentAt={contract?.email_sent_at ?? null}
            locked={!canEdit}
            saving={save.isPending}
            sending={sending}
            hasCouple={!!coupleId}
            onSave={() => save.mutate()}
            onSend={() => void send()}
            onDownloadPdf={downloadPdf}
            {...(contactLinks ? { signerLinks: contactLinks } : {})}
            {...(contactLinksNote ? { signerLinksNote: contactLinksNote } : {})}
            onSignerLinksOpen={onContactLinksOpen}
          />
        }
      >
        {/* Meta row — the couple is chosen here on a fresh draft, then
            fixed: a contract is bound to one couple once it exists, so
            the picker locks after the first save. Expiry stays
            editable while the contract is a draft. */}
        <BuilderMetaRow
          selectedCoupleId={coupleId}
          selectedCoupleName={coupleName}
          coupleOptions={couples ?? []}
          canEditCouple={isNew}
          onSelectCouple={(c) => {
            setCoupleId(c.id);
            setCoupleName(c.name);
            setDirty(true);
          }}
          dateValue={expiresAt}
          dateLabel="Set expiry date"
          datePrefix="Expires"
          onDateChange={(d) => {
            setExpiresAt(d);
            setDirty(true);
          }}
          canEdit={canEdit}
        />

        {/* Body */}
        <div className="mt-6">
          <ContractBodyEditor
            content={content}
            onChange={(v) => {
              setContent(v);
              setDirty(true);
            }}
            canEdit={canEdit}
            lockedHtml={contract?.locked_content_html ?? null}
            templates={templates ?? []}
            onApplyTemplate={(tpl) => {
              setContent(
                tpl.content && Object.keys(tpl.content).length > 0
                  ? tpl.content
                  : DEFAULT_TEMPLATE,
              );
              setDirty(true);
            }}
          />
        </div>

        {/* Who still owes a signature. Hidden on a draft (nobody has been
            asked yet) and on a single-signer contract, where the terminal
            signature block below already says everything. */}
        {status !== 'draft' && (signers?.filter((s) => s.required).length ?? 0) > 1 ? (
          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-body text-text-subtle mb-2">Signatures</p>
            <ul className="space-y-1.5">
              {signers?.map((signer) => (
                <li key={signer.id} className="flex items-center gap-2">
                  {signer.declined_at ? (
                    <X size={14} strokeWidth={1.5} className="text-danger shrink-0" />
                  ) : signer.signed_at ? (
                    <Check size={14} strokeWidth={1.5} className="text-success shrink-0" />
                  ) : (
                    <Clock size={14} strokeWidth={1.5} className="text-text-subtle shrink-0" />
                  )}
                  <span className="text-body text-text">{signer.name}</span>
                  <span className="text-body text-text-subtle">
                    {signer.declined_at
                      ? 'Declined'
                      : signer.signed_at
                        ? `Signed ${new Date(signer.signed_at).toLocaleDateString('en-AU', {
                            day: 'numeric',
                            month: 'short',
                          })}`
                        : 'Awaiting signature'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Signature / decline state (terminal states only). */}
        {isSigned ? (
          <div className="mt-6">
            <ContractSignatureDisplay
              kind="signed"
              signerName={contract?.signer_name ?? null}
              signedAt={contract?.signed_at ?? null}
              signerIp={contract?.signer_ip ?? null}
              declinedReason={null}
            />
          </div>
        ) : null}
        {isDeclined ? (
          <div className="mt-6">
            <ContractSignatureDisplay
              kind="declined"
              signerName={null}
              signedAt={null}
              signerIp={null}
              declinedReason={contract?.declined_reason ?? null}
            />
          </div>
        ) : null}
      </BuilderModalShell>

      <ConfirmDialog
        open={confirmingRevoke}
        title="Revoke and edit this contract?"
        description="The current link will stop working and the contract will go back to draft so you can edit it. The couple will need to be re-sent the new link."
        confirmLabel="Revoke & edit"
        loading={revoke.isPending}
        onConfirm={() => revoke.mutate()}
        onCancel={() => setConfirmingRevoke(false)}
      />
      <ConfirmDialog
        open={confirmingDelete}
        title={isNew ? 'Discard this draft?' : 'Delete this contract?'}
        description={
          isNew
            ? "Nothing has been saved yet, so this just closes the builder."
            : 'This removes the contract permanently.'
        }
        confirmLabel={isNew ? 'Discard' : 'Delete'}
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
