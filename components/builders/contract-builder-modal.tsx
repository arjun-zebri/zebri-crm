/**
 * Contract builder modal.
 *
 * Phase 3.1 rewrite — orchestrator over the shared
 * `components/builders/parts/*` set + the new contract-specific
 * parts (`contract-body-editor`, `contract-quote-link`,
 * `contract-signature-display`, `contract-preview-pane`).
 *
 * Mirrors the post-2C.2 quote/invoice modal shape:
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
import { ContractBodyEditor } from '@/components/builders/parts/contract-body-editor';
import { ContractPreviewPane } from '@/components/builders/parts/contract-preview-pane';
import {
  ContractQuoteLink,
  type ContractQuoteLinkOption,
} from '@/components/builders/parts/contract-quote-link';
import { ContractSignatureDisplay } from '@/components/builders/parts/contract-signature-display';
import type { JSONContent } from '@/components/builders/parts/contract-types';
import { ShareAndSend } from '@/components/builders/parts/share-and-send';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { StatePillProps } from '@/components/ui/state-pill';
import { useToast } from '@/components/ui/toast';
import {
  buildContractVariables,
  renderContractHtml,
} from '@/lib/contracts/contract-variables';
import { generateAndPrintPdf } from '@/lib/pdf/generate-pdf';
import { createClient } from '@/lib/supabase/client';

interface Contract {
  id: string;
  title: string;
  contract_number: string;
  status: string;
  content: JSONContent;
  expires_at: string | null;
  share_token: string;
  share_token_enabled: boolean;
  quote_id: string | null;
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

interface LinkedQuoteRow {
  subtotal: number;
  tax_rate: number | null;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
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
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Wedding MC Service Agreement' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'This agreement is between ' },
        { type: 'mention', attrs: { id: 'mc_business_name', label: 'Your business name' } },
        { type: 'text', text: ' ("the MC") and ' },
        { type: 'mention', attrs: { id: 'couple_name', label: 'Couple name' } },
        { type: 'text', text: ' ("the Couple") for wedding MC services on ' },
        { type: 'mention', attrs: { id: 'event_date', label: 'Event date' } },
        { type: 'text', text: ' at ' },
        { type: 'mention', attrs: { id: 'venue', label: 'Venue' } },
        { type: 'text', text: '.' },
      ],
    },
  ],
};

export interface ContractBuilderModalProps {
  contractId: string;
  coupleId: string;
  coupleName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ContractBuilderModal({
  contractId,
  coupleId,
  coupleName,
  isOpen,
  onClose,
}: ContractBuilderModalProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /* ─── form state ────────────────────────────────────────────── */
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<JSONContent>(DEFAULT_TEMPLATE);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /* ─── data ──────────────────────────────────────────────────── */
  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    enabled: isOpen && !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contractId)
        .single();
      if (error) throw error;
      return data as Contract;
    },
  });

  const { data: quotes } = useQuery({
    queryKey: ['couple-accepted-quotes', coupleId],
    enabled: isOpen && !!coupleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, title, status, subtotal')
        .eq('couple_id', coupleId)
        .in('status', ['accepted', 'sent'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as ContractQuoteLinkOption[]) || [];
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
        .eq('couple_id', coupleId)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle();
      return (data as FirstEventRow | null) ?? null;
    },
  });

  // Optional: the linked quote — used to substitute the
  // `{{total_amount}}` / `{{deposit_amount}}` mentions.
  const { data: linkedQuote } = useQuery({
    queryKey: ['contract-linked-quote', quoteId],
    enabled: isOpen && !!quoteId,
    queryFn: async () => {
      if (!quoteId) return null;
      const { data } = await supabase
        .from('quotes')
        .select('subtotal, tax_rate, discount_type, discount_value')
        .eq('id', quoteId)
        .maybeSingle();
      return (data as LinkedQuoteRow | null) ?? null;
    },
  });

  /* ─── hydrate state from DB ─────────────────────────────────── */
  useEffect(() => {
    if (!contract) return;
    setTitle(contract.title);
    setContent(
      contract.content && Object.keys(contract.content).length > 0
        ? contract.content
        : DEFAULT_TEMPLATE,
    );
    setExpiresAt(contract.expires_at);
    setQuoteId(contract.quote_id);
    setDirty(false);
  }, [contract?.id]);

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
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserMeta((user?.user_metadata ?? {}) as Record<string, unknown>);
    };
    void fetchUser();
  }, [supabase]);

  const previewHtml = useMemo(() => {
    // Locked snapshot wins when present — that's the legally-binding
    // text the couple actually saw, byte for byte.
    if (!canEdit && contract?.locked_content_html) {
      return contract.locked_content_html;
    }
    const depositPercent = Number(
      (userMeta.default_deposit_percent as number | undefined) ?? 25,
    );
    const vars = buildContractVariables({
      couple: { name: coupleName, email: null },
      firstEvent: firstEvent ?? null,
      quote: linkedQuote ?? null,
      userMeta,
      depositPercent,
    });
    return renderContractHtml(content, vars);
  }, [canEdit, contract?.locked_content_html, content, coupleName, firstEvent, linkedQuote, userMeta]);

  /* ─── mutations ─────────────────────────────────────────────── */
  const save = useMutation({
    mutationFn: async () => {
      const input: SaveContractInput = {
        contractId,
        title: title || `Contract for ${coupleName}`,
        content,
        expiresAt: expiresAt,
        quoteId,
      };
      const result = await saveContractAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data.id;
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
      queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] });
      queryClient.invalidateQueries({ queryKey: ['all-contracts'] });
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : 'Failed to save contract', 'error'),
  });

  const send = async () => {
    if (!contract) return;
    if (dirty) await save.mutateAsync();
    setSending(true);
    try {
      const res = await fetch('/api/email/send-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Failed to send contract', 'error');
      } else {
        toast('Contract sent');
        queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
        queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] });
        queryClient.invalidateQueries({ queryKey: ['all-contracts'] });
      }
    } finally {
      setSending(false);
    }
  };

  const revoke = useMutation({
    mutationFn: async () => {
      const result = await revokeContractAction(contractId);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      toast('Contract revoked — you can now edit');
      setConfirmingRevoke(false);
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
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
      const result = await deleteContractAction(contractId);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      toast('Contract deleted');
      setConfirmingDelete(false);
      queryClient.invalidateQueries({ queryKey: ['couple-contracts', coupleId] });
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
    if (!contract) return;
    generateAndPrintPdf({
      type: 'contract',
      documentNumber: contract.contract_number,
      title: contract.title,
      status: contract.status,
      coupleName,
      businessName: (userMeta.business_name as string | undefined) ?? '',
      items: [],
      subtotal: 0,
      total: 0,
      contractHtml: previewHtml,
      signerName: contract.signer_name,
      signedAt: contract.signed_at,
      signerIp: contract.signer_ip,
      signerUserAgent: contract.signer_user_agent,
      mcSignatureName: contract.mc_signature_name,
    });
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
        deleteLabel="Delete contract"
        loading={isLoading && !contract}
        title={title}
        onTitleChange={(v) => {
          setTitle(v);
          setDirty(true);
        }}
        titlePlaceholder={`Contract for ${coupleName}`}
        titleReadOnly={!canEdit}
        previewPane={
          <ContractPreviewPane
            html={previewHtml}
            documentNumber={contract?.contract_number ?? 'CTR-…'}
          />
        }
        footer={
          <ShareAndSend
            dirty={dirty}
            shareEnabled={contract?.share_token_enabled ?? false}
            shareUrl={shareUrl}
            lastSentAt={contract?.email_sent_at ?? null}
            locked={!canEdit}
            saving={save.isPending}
            sending={sending}
            hasCouple={true}
            onSave={() => save.mutate()}
            onSend={() => void send()}
          />
        }
      >
        {/* Meta row — couple is read-only (contract is bound to one
            couple at creation), expiry is editable. */}
        <BuilderMetaRow
          selectedCoupleId={coupleId}
          selectedCoupleName={coupleName}
          coupleOptions={[]}
          canEditCouple={false}
          onSelectCouple={() => {
            /* couple isn't editable on contracts */
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

        {/* Linked-quote picker — separate row since it needs more
            width than the meta-row's date / terms slots. */}
        <div className="mt-3">
          <ContractQuoteLink
            selectedQuoteId={quoteId}
            options={quotes ?? []}
            canEdit={canEdit}
            onSelect={(id) => {
              setQuoteId(id);
              setDirty(true);
            }}
          />
        </div>

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
        title="Delete this contract?"
        description="This removes the contract permanently."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
