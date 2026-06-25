/**
 * `/couples` — list/kanban orchestrator.
 *
 * The page is a thin composition of:
 * - `<CouplesHeader>` (toolbar + view-mode toggle + filters + sort)
 * - `<CouplesList>` / `<CouplesKanban>` (the two view modes)
 * - `<CoupleProfile>` (the centered full-screen modal that opens
 *    when a couple is clicked — **not** a slide-in drawer; see
 *    Phase 4 plan §2 decision 6a)
 * - `<CoupleModal>` (the create/edit form)
 * - `<BulkActionBar>` (multi-select operations)
 * - `<StarterCapLockModal>` (paywall when the user is at the Starter
 *    couple cap)
 *
 * View state (search/filter/sort) lives in `useCouplesView()`.
 * Profile selection + deep-link sync in `useCoupleProfileSync()`.
 * Keyboard shortcuts in `useCouplesShortcuts()`. Kanban drop math
 * in `lib/couples/kanban-positions.ts`. Mutations in
 * `use-couples.ts` (React Query) → `actions.ts` (server actions).
 * No business logic lives inline.
 *
 * @module app/(dashboard)/couples/page
 */
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { computeKanbanUpdates } from '@/lib/couples/kanban-positions';
import { downloadCsv } from '@/lib/utils/csv';
import { Couple, ViewMode } from '@/types/couple';

import type { CoupleInput } from './actions';
import { BulkActionBar } from './bulk-action-bar';
import { CoupleModal, type CoupleEventInput } from './couple-modal';
import { CoupleProfile } from './couple-profile';
import { CouplesHeader } from './couples-header';
import { CouplesImportModal } from './couples-import-modal';
import { CouplesKanban } from './couples-kanban';
import { CouplesList } from './couples-list';
import { StarterCapLockModal } from './starter-cap-lock-modal';
import { StatusesModal } from './statuses-modal';
import { useCoupleProfileSync } from './use-couple-profile-sync';
import { useCoupleStatuses } from './use-couple-statuses';
import {
  useCouples,
  useCreateCouple,
  useUpdateCouple,
  useDeleteCouple,
  useBulkMoveCouples,
  useBulkUpdateCouplesStatus,
  useBulkDeleteCouples,
  useBulkCreateCouples,
  useUpsertCoupleEventDate,
  StarterLimitError,
} from './use-couples';
import { useCouplesShortcuts } from './use-couples-shortcuts';
import { useCouplesView } from './use-couples-view';
import { useStarterCapLock } from './use-starter-cap-lock';

function CouplesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');
  const viewMode: ViewMode = viewParam === 'list' ? 'list' : 'kanban';

  const { data: couples, isLoading } = useCouples();
  const { data: statuses } = useCoupleStatuses();
  const createCouple = useCreateCouple();
  const updateCouple = useUpdateCouple();
  const deleteCouple = useDeleteCouple();
  const bulkMoveCouples = useBulkMoveCouples();
  const bulkUpdateStatus = useBulkUpdateCouplesStatus();
  const bulkDeleteCouples = useBulkDeleteCouples();
  const bulkCreateCouples = useBulkCreateCouples();
  const upsertEventDate = useUpsertCoupleEventDate();

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortField,
    sortDirection,
    setSort,
    filteredCouples,
    kanbanCouples,
  } = useCouplesView(couples);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [capLockOpen, setCapLockOpen] = useState(false);
  const [statusesOpen, setStatusesOpen] = useState(false);
  const { toast } = useToast();
  const capLock = useStarterCapLock(couples.length);
  const { selectedCouple, setSelectedCouple } = useCoupleProfileSync(couples);

  // The Starter-cap trigger in Postgres rejects new INSERTs; this
  // guard mirrors the rule on the modal-open paths so we don't even
  // surface the form for an MC who's already at the cap.
  function tryOpenCouple(couple: Couple) {
    if (capLock.locked) {
      setCapLockOpen(true);
      return;
    }
    setSelectedCouple(couple);
  }
  function tryOpenAdd(statusSlug?: string) {
    if (capLock.locked) {
      setCapLockOpen(true);
      return;
    }
    if (statusSlug) setDefaultStatus(statusSlug);
    setAddModalOpen(true);
  }

  // Redirect bare /couples to /couples?view=board (the kanban
  // default). Pure side effect; doesn't write component state, so
  // no setState-in-effect issue.
  useEffect(() => {
    if (!viewParam) {
      router.replace('/couples?view=board');
    }
  }, [viewParam, router]);

  const handleViewModeChange = (mode: ViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', mode === 'kanban' ? 'board' : mode);
    router.replace(`/couples?${params.toString()}`);
    setSelectedIds(new Set());
  };

  useCouplesShortcuts({
    hasSelection: selectedIds.size > 0,
    onClearSelection: () => setSelectedIds(new Set()),
    onAdd: () => tryOpenAdd(),
  });

  // Clicking the page background (not on a card / bulk-bar / modal)
  // clears the multi-selection.
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (selectedIds.size === 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-couple-id]') ||
      target.closest('[data-bulk-action-bar]') ||
      target.closest('[data-couple-checkbox]') ||
      target.closest("[role='dialog']") ||
      target.closest('[data-modal]')
    ) {
      return;
    }
    setSelectedIds(new Set());
  };

  const handleAddCouple = async (
    data: Omit<Couple, 'id' | 'user_id' | 'created_at'> & { id?: string },
    event: CoupleEventInput,
  ) => {
    const positionsInStatus = couples
      .filter((c) => c.status === data.status)
      .map((c) => c.kanban_position ?? 0);
    const nextPosition =
      positionsInStatus.length > 0 ? Math.max(...positionsInStatus) + 1 : 0;
    try {
      const created = await createCouple.mutateAsync({
        ...data,
        kanban_position: nextPosition,
      });
      // A wedding date entered in the modal becomes the couple's first
      // real event with its venue (the legacy `event_date` / `venue`
      // columns aren't displayed).
      if (event.date) {
        await upsertEventDate.mutateAsync({
          coupleId: created.id,
          date: event.date,
          venue: event.venue || null,
          venue_phone: event.venue_phone,
          venue_website: event.venue_website,
          venue_lat: event.venue_lat,
          venue_lng: event.venue_lng,
        });
      }
      toast('Couple added');
      setAddModalOpen(false);
    } catch (e) {
      if (e instanceof StarterLimitError) {
        toast(e.message, 'error');
        router.push('/settings?tab=billing');
        return;
      }
      toast(e instanceof Error ? e.message : 'Failed to add couple', 'error');
    }
  };

  // CSV import: the modal hands us the validated, status-resolved
  // rows; we own the mutation + result toast + cap surface. The server
  // action slices to the plan quota, so a Starter overflow comes back
  // as `skippedForLimit` rather than an error — we then surface the
  // existing upgrade modal for the rows that didn't fit.
  const handleImportCouples = async (rows: CoupleInput[]) => {
    try {
      const summary = await bulkCreateCouples.mutateAsync(rows);
      setImportModalOpen(false);
      const parts = [
        `${summary.created} ${summary.created === 1 ? 'couple' : 'couples'} imported`,
      ];
      if (summary.skippedForLimit > 0)
        parts.push(`${summary.skippedForLimit} skipped (couple limit)`);
      if (summary.invalidRows.length > 0)
        parts.push(`${summary.invalidRows.length} invalid`);
      toast(parts.join(', '));
      if (summary.skippedForLimit > 0) setCapLockOpen(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to import couples', 'error');
    }
  };

  const handleUpdateCouple = async (
    data: Omit<Couple, 'id' | 'user_id' | 'created_at'> & { id?: string },
  ) => {
    const existing = couples.find((c) => c.id === data.id);
    if (!existing) return;
    const updated = { ...existing, ...data } as Couple;
    await updateCouple.mutateAsync(updated);
    // Don't `setSelectedCouple(updated)` here - the cache-sync
    // effect in useCoupleProfileSync rebinds the open profile to
    // the fresh cache row. Setting it explicitly after the await
    // races against a concurrent Close click: the user closes
    // before the save resolves, then this line reopens the modal
    // with the post-save data.
    toast('Couple updated');
  };

  const handleDeleteCouple = async (id: string) => {
    await deleteCouple.mutateAsync(id);
    setSelectedCouple(null);
    toast('Couple deleted');
  };

  const handleDragEnd = async (
    source: string,
    destination: string,
    destinationIndex: number,
    coupleId: string,
    selectedAtStart: Set<string>,
  ) => {
    const updates = computeKanbanUpdates({
      couples,
      statuses,
      source,
      destination,
      destinationIndex,
      coupleId,
      selectedAtStart,
    });
    if (updates.length === 0) return;

    const isMultiDrag =
      selectedAtStart.has(coupleId) && selectedAtStart.size > 1;

    if (isMultiDrag) {
      await bulkMoveCouples.mutateAsync(updates);
      setSelectedIds(new Set());
      toast(`${updates.length} couples moved`);
    } else {
      const couple = couples.find((c) => c.id === coupleId);
      const update = updates[0];
      if (!couple || !update) return;
      await updateCouple.mutateAsync({
        ...couple,
        status: update.status,
        kanban_position: update.kanban_position,
      });
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    await bulkUpdateStatus.mutateAsync({ ids: [...selectedIds], status });
    setSelectedIds(new Set());
    toast('Status updated');
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    await bulkDeleteCouples.mutateAsync([...selectedIds]);
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    toast(`${count} couples deleted`);
  };

  const handleExportCSV = () => {
    const selected = couples.filter((c) => selectedIds.has(c.id));
    downloadCsv({
      headers: ['Name', 'Email', 'Phone', 'Event Date', 'Venue', 'Status'],
      rows: selected.map((c) => [
        c.name,
        c.email || '',
        c.phone || '',
        c.event_date || '',
        c.venue || '',
        c.status,
      ]),
      filename: 'couples',
    });
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      onClick={handleBackgroundClick}
    >
      <div className="px-6 sm:px-[3.75rem] pt-6 pb-2 flex-shrink-0">
        <CouplesHeader
          couples={couples}
          statuses={statuses}
          onAddClick={() => tryOpenAdd()}
          onImportClick={() => setImportModalOpen(true)}
          onManageStatuses={() => setStatusesOpen(true)}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={setSort}
        />
      </div>

      <div
        className={`flex-1 min-h-0 overflow-hidden pl-6 pr-6 sm:pr-[3.75rem] ${
          viewMode === 'list' ? 'sm:pl-[3.75rem]' : 'sm:pl-12 pb-14'
        }`}
      >
        {viewMode === 'list' ? (
          <CouplesList
            couples={filteredCouples}
            statuses={statuses}
            onRowClick={tryOpenCouple}
            loading={isLoading}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        ) : (
          <div className="overflow-x-auto overflow-y-auto h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pt-2">
            <CouplesKanban
              couples={kanbanCouples}
              statuses={statuses}
              onCardClick={tryOpenCouple}
              onDragEnd={handleDragEnd}
              onAddClick={(statusSlug) => tryOpenAdd(statusSlug)}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              loading={isLoading}
            />
          </div>
        )}
      </div>

      <CoupleProfile
        couple={selectedCouple}
        onClose={() => setSelectedCouple(null)}
        onSave={handleUpdateCouple}
        onDelete={handleDeleteCouple}
        loading={updateCouple.isPending || deleteCouple.isPending}
      />

      <CoupleModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddCouple}
        onDelete={() => {}}
        statuses={statuses}
        defaultStatus={defaultStatus}
        loading={createCouple.isPending}
      />

      <CouplesImportModal
        key={importModalOpen ? 'import-open' : 'import-closed'}
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        statuses={statuses}
        existing={couples.map((c) => ({
          name: c.name,
          primary_email: c.primary_email ?? null,
        }))}
        defaultStatusSlug={statuses[0]?.slug ?? 'new'}
        importing={bulkCreateCouples.isPending}
        onImport={handleImportCouples}
      />

      <BulkActionBar
        selectedCount={selectedIds.size}
        statuses={statuses}
        loading={bulkUpdateStatus.isPending || bulkDeleteCouples.isPending}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkStatusChange={handleBulkStatusChange}
        onDeleteClick={() => setBulkDeleteOpen(true)}
        onExportCSV={handleExportCSV}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'couple' : 'couples'}?`}
        description="This action cannot be undone."
        loading={bulkDeleteCouples.isPending}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
      />

      <StarterCapLockModal
        open={capLockOpen}
        onClose={() => setCapLockOpen(false)}
        count={couples.length}
        cap={capLock.cap}
      />

      <StatusesModal
        isOpen={statusesOpen}
        onClose={() => setStatusesOpen(false)}
      />
    </div>
  );
}

export default function CouplesPage() {
  return (
    <Suspense>
      <CouplesPageContent />
    </Suspense>
  );
}
