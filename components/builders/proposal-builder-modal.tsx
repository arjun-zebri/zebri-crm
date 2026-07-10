/**
 * Proposal builder modal.
 *
 * The composer for the packages → send → accept → invoice workflow
 * (spec: .claude/docs/proposals.md). Composition over the shared
 * builder parts, with the proposal-specific concept — **options** —
 * as a stack of {@link ProposalOptionCard}s: each option snapshots a
 * package (items, add-ons, commercial terms) and stays editable per
 * couple until sent. No document-level discount/tax controls: GST
 * treatment rides on each option's snapshot, and per-couple pricing
 * tweaks are just item edits.
 *
 * Saves flow through `saveProposalAction`; accepted/declined
 * proposals are locked server-side, so the modal offers
 * "Duplicate to revise" instead of editing.
 *
 * @module components/builders/proposal-builder-modal
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  deleteProposalAction,
  duplicateProposalAction,
  saveProposalAction,
  type SaveProposalInput,
} from '@/app/(dashboard)/payments/actions';
import { BuilderMetaRow } from '@/components/builders/parts/builder-meta-row';
import {
  BuilderModalShell,
  type OverflowMenuItem,
} from '@/components/builders/parts/builder-modal-shell';
import { NotesField } from '@/components/builders/parts/notes-field';
import {
  ProposalOptionCard,
  type ProposalOptionDraft,
} from '@/components/builders/parts/proposal-option-card';
import { ProposalPreviewPane } from '@/components/builders/parts/proposal-preview-pane';
import { ShareAndSend } from '@/components/builders/parts/share-and-send';
import { TemplatePicker } from '@/components/builders/parts/template-picker';
import { useApplySources } from '@/components/builders/parts/use-apply-sources';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { StatePillProps } from '@/components/ui/state-pill';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';

import { useProposalDetail } from './parts/use-proposal-detail';

export interface ProposalBuilderModalProps {
  /** 'new' / null composes a fresh draft. */
  proposalId: string | null;
  initialCoupleId?: string;
  isOpen: boolean;
  onClose: () => void;
  /** Fired with the new draft's id after "Duplicate to revise". */
  onDuplicated?: (proposalId: string) => void;
  onDelete?: () => void;
}

const STATE_PILL: Record<string, StatePillProps> = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info', dot: 'hollow' },
  accepted: { label: 'Accepted', tone: 'success', dot: 'filled' },
  declined: { label: 'Declined', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
};

function blankOption(): ProposalOptionDraft {
  return {
    key: `new-${crypto.randomUUID()}`,
    title: '',
    description: null,
    sourcePackageId: null,
    depositPercent: null,
    gstInclusive: true,
    weekendLoadingPercent: null,
    items: [],
    addOns: [],
  };
}

export function ProposalBuilderModal({
  proposalId,
  initialCoupleId,
  isOpen,
  onClose,
  onDuplicated,
  onDelete,
}: ProposalBuilderModalProps) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isNew = proposalId === 'new' || proposalId === null;
  const effectiveId = isNew ? null : proposalId;

  /* ─── form state ────────────────────────────────────────────── */
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [coupleName, setCoupleName] = useState<string | null>(null);
  const [options, setOptions] = useState<ProposalOptionDraft[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /* ─── data ──────────────────────────────────────────────────── */
  const { proposal, optionDrafts, loading } = useProposalDetail(effectiveId);

  const { data: couples } = useQuery({
    queryKey: ['all-couples-for-proposal'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];
      const { data, error } = await supabase
        .from('couples')
        .select('id, name')
        .eq('user_id', user.user.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  // Options snapshot PACKAGES (the catalog with commercial terms);
  // flat quote/invoice templates aren't offered here.
  const { data: applySources } = useApplySources();
  const packageOptions = (applySources?.options ?? []).filter((o) => o.id.startsWith('pkg:'));

  /* ─── hydrate from DB ───────────────────────────────────────── */
  useEffect(() => {
    if (isNew) {
      setTitle('');
      setNotes('');
      setExpiresAt(null);
      setCoupleId(initialCoupleId ?? null);
      setCoupleName(
        initialCoupleId ? couples?.find((c) => c.id === initialCoupleId)?.name ?? null : null,
      );
      setOptions([]);
      setDirty(false);
      return;
    }
    if (proposal) {
      setTitle(proposal.title);
      setNotes(proposal.notes ?? '');
      setExpiresAt(proposal.expires_at);
      setCoupleId(proposal.couple_id);
      setCoupleName(proposal.couple_name);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on identity, not object refs
  }, [proposal?.id, isNew, initialCoupleId, couples]);

  useEffect(() => {
    if (optionDrafts) setOptions(optionDrafts);
  }, [optionDrafts]);

  /* ─── computed ──────────────────────────────────────────────── */
  const status = proposal?.status ?? 'draft';
  const canEdit = !['accepted', 'declined'].includes(status);
  const shareUrl =
    typeof window !== 'undefined' && proposal?.share_token
      ? `${window.location.origin}/proposal/${proposal.share_token}`
      : null;

  const invalidate = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: ['proposal', id] });
    void queryClient.invalidateQueries({ queryKey: ['all-proposals'] });
    void queryClient.invalidateQueries({ queryKey: ['couple-proposals'] });
  };

  /* ─── mutations ─────────────────────────────────────────────── */
  const save = useMutation({
    mutationFn: async () => {
      if (!coupleId) throw new Error('Please select a couple first');
      if (options.length === 0) throw new Error('Add at least one package option');
      const input: SaveProposalInput = {
        proposalId: effectiveId,
        coupleId,
        title,
        notes: notes || null,
        expiresAt,
        options: options.map((option) => ({
          title: option.title.trim() || 'Package',
          description: option.description,
          sourcePackageId: option.sourcePackageId,
          depositPercent: option.depositPercent,
          gstInclusive: option.gstInclusive,
          weekendLoadingPercent: option.weekendLoadingPercent,
          items: [
            ...option.items.map((item) => ({
              id: item.id,
              description: item.description,
              amount: Number(item.amount || 0),
              isAddon: false,
              defaultIncluded: false,
            })),
            ...option.addOns.map((addOn) => ({
              id: addOn.id,
              description: addOn.description,
              amount: Number(addOn.amount || 0),
              isAddon: true,
              defaultIncluded: addOn.defaultIncluded,
            })),
          ],
        })),
      };
      const result = await saveProposalAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data.id;
    },
    onSuccess: (id) => {
      invalidate(id);
      toast('Proposal saved');
      setDirty(false);
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : 'Could not save the proposal', 'error'),
  });

  const sendEmail = useMutation({
    mutationFn: async () => {
      let targetId = effectiveId;
      if (dirty || !targetId) targetId = await save.mutateAsync();
      if (!targetId) throw new Error('No proposal to send');
      const res = await fetch('/api/email/send-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: targetId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to send email');
      return targetId;
    },
    onSuccess: (id) => {
      toast('Sent to couple');
      invalidate(id);
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Failed to send', 'error'),
  });

  // Shared-out-of-band path: flips draft→sent + enables the link
  // without emailing (mirrors the quote builder's markSent).
  const markSent = useMutation({
    mutationFn: async () => {
      let targetId = effectiveId;
      if (dirty || !targetId) targetId = await save.mutateAsync();
      if (!targetId) throw new Error('No proposal to mark as sent');
      const { error } = await supabase
        .from('proposals')
        .update({ status: 'sent', share_token_enabled: true })
        .eq('id', targetId);
      if (error) throw error;
      return targetId;
    },
    onSuccess: (id) => {
      invalidate(id);
      toast('Marked as sent');
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : 'Failed to mark as sent', 'error'),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!effectiveId) return;
      const result = await deleteProposalAction(effectiveId);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['all-proposals'] });
      void queryClient.invalidateQueries({ queryKey: ['couple-proposals'] });
      toast('Proposal deleted');
      setConfirmingDelete(false);
      onDelete?.();
      onClose();
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Could not delete the proposal', 'error');
      setConfirmingDelete(false);
    },
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      if (!effectiveId) throw new Error('Nothing to duplicate');
      const result = await duplicateProposalAction(effectiveId);
      if (!result.ok) throw new Error(result.error);
      return result.data.id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ['all-proposals'] });
      toast('Draft created — edit and resend');
      onDuplicated?.(id);
    },
    onError: (err) =>
      toast(err instanceof Error ? err.message : 'Could not duplicate', 'error'),
  });

  /* ─── option handlers ───────────────────────────────────────── */
  function addPackageOption(sourceId: string) {
    const source = applySources?.applyMap[sourceId];
    if (!source) return;
    const name = applySources?.options.find((o) => o.id === sourceId)?.name ?? 'Package';
    setOptions((prev) => [
      ...prev,
      {
        key: `new-${crypto.randomUUID()}`,
        title: name,
        description: null,
        sourcePackageId: source.package?.id ?? null,
        depositPercent: source.package?.depositPercent ?? null,
        gstInclusive: source.package?.gstInclusive ?? true,
        weekendLoadingPercent: source.package?.weekendLoadingPercent ?? null,
        items: source.items.map((item, idx) => ({
          id: `new-${crypto.randomUUID()}`,
          description: item.description,
          amount: item.amount,
          position: idx,
        })),
        // All add-ons come along unticked; the MC pre-ticks in the card.
        addOns: source.addOns.map((addOn) => ({
          id: `new-${crypto.randomUUID()}`,
          description: addOn.description,
          amount: addOn.amount,
          defaultIncluded: false,
        })),
      },
    ]);
    // The package's customer-facing prose seeds the proposal notes once.
    if (source.notes && !notes) setNotes(source.notes);
    setDirty(true);
  }

  /* ─── shell wiring ──────────────────────────────────────────── */
  const pillKey = (status in STATE_PILL ? status : 'draft') as keyof typeof STATE_PILL;
  const overflowItems: OverflowMenuItem[] = [];
  if (effectiveId && !canEdit) {
    overflowItems.push({ label: 'Duplicate to revise', onClick: () => duplicate.mutate() });
  }

  return (
    <>
      <BuilderModalShell
        isOpen={isOpen}
        onClose={onClose}
        documentNumber={proposal?.proposal_number ?? 'Proposal'}
        statePill={STATE_PILL[pillKey]}
        overflowItems={overflowItems}
        {...(effectiveId && canEdit
          ? { onDelete: () => setConfirmingDelete(true), deleteLabel: 'Delete proposal' }
          : {})}
        loading={!!effectiveId && loading && !proposal}
        title={title}
        onTitleChange={(v) => {
          setTitle(v);
          setDirty(true);
        }}
        titlePlaceholder={coupleName ? `Proposal for ${coupleName}` : 'Wedding proposal title'}
        titleReadOnly={!canEdit}
        previewPane={
          <ProposalPreviewPane
            proposalNumber={proposal?.proposal_number ?? 'DRAFT'}
            title={title || 'Wedding Proposal'}
            coupleName={coupleName}
            businessName={null}
            notes={notes || null}
            options={options}
            shareUrl={shareUrl ?? 'https://example.com/proposal/preview'}
          />
        }
        footer={
          <ShareAndSend
            dirty={dirty}
            shareEnabled={proposal?.share_token_enabled ?? false}
            shareUrl={shareUrl}
            lastSentAt={proposal?.email_sent_at ?? null}
            locked={!canEdit}
            saving={save.isPending}
            sending={sendEmail.isPending}
            hasCouple={!!coupleId}
            onSave={() => save.mutate()}
            onSend={() => sendEmail.mutate()}
            canMarkSent={status === 'draft'}
            markingSent={markSent.isPending}
            onMarkSent={() => markSent.mutate()}
          />
        }
      >
        <BuilderMetaRow
          selectedCoupleId={coupleId}
          selectedCoupleName={coupleName}
          coupleOptions={couples ?? []}
          canEditCouple={canEdit}
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

        {/* Options — the heart of a proposal. */}
        <div className="mt-6 space-y-4">
          {options.map((option, index) => (
            <ProposalOptionCard
              key={option.key}
              option={option}
              index={index}
              showIndex={options.length > 1}
              canEdit={canEdit}
              canRemove={options.length > 1}
              onChange={(next) => {
                setOptions((prev) => prev.map((o) => (o.key === option.key ? next : o)));
                setDirty(true);
              }}
              onRemove={() => {
                setOptions((prev) => prev.filter((o) => o.key !== option.key));
                setDirty(true);
              }}
            />
          ))}

          {options.length === 0 && (
            <TemplatePicker
              variant="empty-state"
              templates={packageOptions}
              canApply={canEdit}
              onApply={addPackageOption}
            />
          )}
          {/* Always reachable while editable — a package-less account
              must still be able to compose its first option. */}
          {canEdit && (
            <div className="flex items-center gap-4">
              {options.length > 0 && packageOptions.length > 0 && (
                <TemplatePicker
                  variant="inline"
                  templates={packageOptions}
                  canApply={canEdit}
                  onApply={addPackageOption}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  setOptions((prev) => [...prev, blankOption()]);
                  setDirty(true);
                }}
                className="flex cursor-pointer items-center gap-1 py-1 text-caption text-text-muted transition hover:text-text"
              >
                <Plus size={13} strokeWidth={1.5} />
                Add blank option
              </button>
            </div>
          )}
        </div>

        <div className="mt-6">
          <NotesField
            value={notes}
            onChange={(v) => {
              setNotes(v);
              setDirty(true);
            }}
            canEdit={canEdit}
            label="Notes"
            placeholder="Anything you want the couple to see alongside the options."
          />
        </div>
      </BuilderModalShell>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this proposal?"
        description="The proposal and all its options will be removed. This can't be undone."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
