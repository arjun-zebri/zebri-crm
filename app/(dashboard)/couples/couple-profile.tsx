/**
 * Couple Profile — the centered full-screen modal (not a slide-in
 * drawer; see Phase 4 plan §2 decision 6a) that opens when a couple
 * is clicked in the list/kanban.
 *
 * 9 tabs nesting every per-couple feature: Overview, Pulse, Tasks,
 * Contacts, Timeline, Songs, Files, Payments, Contracts. Contracts
 * is available on every plan; the Starter-plan cap (5 distinct
 * couples) is enforced at contract creation inside `CoupleContracts`,
 * not by hiding the tab.
 *
 * Composition only — chrome lives in `couple-profile-header`,
 * `couple-profile-nav`, `couple-profile-body`. Mutations route
 * through React Query hooks (which call the server actions in
 * `./actions.ts`).
 *
 * @module app/(dashboard)/couples/couple-profile
 */
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CheckSquare,
  Clock,
  FileSignature,
  LayoutDashboard,
  Music,
  Paperclip,
  Receipt,
  Sparkles,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { getOpenModalDepth } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { Couple } from '@/types/couple';

import { rotateCouplePortalTokenAction } from './actions';
import { CoupleProfileBody } from './couple-profile-body';
import { CoupleProfileHeader } from './couple-profile-header';
import { CoupleProfileNav } from './couple-profile-nav';
import type {
  CoupleProfileNavItem,
  CoupleProfileSection,
} from './couple-profile-types';
import { PersonModal, SongModal } from './portal-modals';
import { useCoupleStatuses } from './use-couple-statuses';
import { usePortalData } from './use-portal-data';

const NAV_ITEMS: CoupleProfileNavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: <LayoutDashboard size={18} strokeWidth={1.5} />,
  },
  {
    key: 'pulse',
    label: 'Pulse',
    icon: <Activity size={18} strokeWidth={1.5} />,
  },
  {
    key: 'tasks',
    label: 'Tasks',
    icon: <CheckSquare size={18} strokeWidth={1.5} />,
  },
  {
    key: 'contacts',
    label: 'Contacts',
    icon: <Users size={18} strokeWidth={1.5} />,
  },
  {
    key: 'timeline',
    label: 'Timeline',
    icon: <Clock size={18} strokeWidth={1.5} />,
  },
  {
    key: 'songs',
    label: 'Songs',
    icon: <Music size={18} strokeWidth={1.5} />,
  },
  {
    key: 'files',
    label: 'Files',
    icon: <Paperclip size={18} strokeWidth={1.5} />,
  },
  {
    key: 'payments',
    label: 'Payments',
    icon: <Receipt size={18} strokeWidth={1.5} />,
  },
  {
    key: 'contracts',
    label: 'Contracts',
    icon: <FileSignature size={18} strokeWidth={1.5} />,
  },
  {
    key: 'automations',
    label: 'Automations',
    icon: <Sparkles size={18} strokeWidth={1.5} />,
  },
];

interface CoupleProfileProps {
  couple: Couple | null;
  onClose: () => void;
  onSave: (
    data: Omit<Couple, 'id' | 'user_id' | 'created_at'> & { id?: string },
  ) => void;
  onDelete: (id: string) => void;
  loading: boolean;
  defaultTab?: CoupleProfileSection;
}

export function CoupleProfile({
  couple,
  onClose,
  onSave,
  onDelete,
  loading,
  defaultTab = 'overview',
}: CoupleProfileProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: statuses } = useCoupleStatuses();

  // Contracts is available on every plan (2026-06-03). The Starter
  // 5-couple cap is enforced inside `CoupleContracts` at create time
  // — hiding the tab would conceal couples that already have
  // contracts when an MC downgrades.
  const navItems = NAV_ITEMS;

  const [activeSection, setActiveSection] =
    useState<CoupleProfileSection>(defaultTab);
  const [rotateConfirm, setRotateConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const portal = usePortalData(couple?.id ?? '');

  const rotateToken = useMutation({
    mutationFn: async () => {
      if (!couple) throw new Error('No couple');
      const result = await rotateCouplePortalTokenAction(couple.id);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['couples'] });
      toast('New links generated. Old links are now invalid.');
    },
    onError: () => toast('Failed to rotate links'),
  });

  // Reset to the default tab when the user opens a different couple,
  // and dismiss any in-flight delete confirmation. The
  // setState-in-effect is intentional — the source of truth for
  // "which couple is open" lives outside this component (in the
  // parent's selectedCouple state), and we need to react to that
  // change.
  useEffect(() => {
    if (couple) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSection(defaultTab);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeleteConfirm(false);
    }
  }, [couple, defaultTab]);

  // Esc-closes-the-modal — but only when no nested modal is open
  // (the modal stack via `getOpenModalDepth()` prevents the profile
  // from closing under a confirm dialog or portal-people picker).
  // Lock body scroll while open.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && getOpenModalDepth() === 0) onClose();
    };
    if (couple) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }
  }, [couple, onClose]);

  if (!couple) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
        onClick={onClose}
      >
        <div
          data-testid="couple-profile-panel"
          className="bg-white rounded-2xl shadow-xl w-full sm:w-[90vw] sm:max-w-[1400px] h-full sm:h-[90vh] flex flex-col overflow-hidden animate-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          <CoupleProfileHeader
            couple={couple}
            statuses={statuses}
            onSave={onSave}
            onClose={onClose}
            onRotateLinks={() => setRotateConfirm(true)}
            onDeleteRequest={() => setDeleteConfirm(true)}
          />

          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
            <CoupleProfileNav
              navItems={navItems}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />

            <CoupleProfileBody
              couple={couple}
              activeSection={activeSection}
              onSave={onSave}
              portal={portal}
            />
          </div>
        </div>
      </div>

      <PersonModal
        isOpen={portal.personModal}
        onClose={() => {
          portal.setPersonModal(false);
          portal.setEditingPerson(null);
        }}
        onSave={portal.savePerson}
        onDelete={portal.editingPerson ? portal.deletePerson : undefined}
        person={portal.editingPerson}
        roleOptions={portal.personRoles}
        coupleId={couple.id}
        saving={portal.personSaving}
        categoryLabel={portal.personCategoryLabel}
      />

      <SongModal
        isOpen={portal.songModal}
        onClose={() => {
          portal.setSongModal(false);
          portal.setEditingSong(null);
        }}
        onSave={portal.saveSong}
        onDelete={portal.editingSong ? portal.deleteSong : undefined}
        song={portal.editingSong}
        categoryLabel={portal.songCategoryLabel}
        saving={portal.songSaving}
      />

      <ConfirmDialog
        open={rotateConfirm}
        title="Rotate links"
        description="This will generate new portal links. Anyone with the old links will lose access. Continue?"
        onConfirm={() => {
          rotateToken.mutate();
          setRotateConfirm(false);
        }}
        onCancel={() => setRotateConfirm(false)}
        loading={rotateToken.isPending}
        confirmLabel="Rotate"
        loadingLabel="Rotating..."
      />

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete Couple"
        description="Are you sure you want to delete this couple? This cannot be undone."
        onConfirm={() => {
          if (couple) onDelete(couple.id);
        }}
        onCancel={() => setDeleteConfirm(false)}
        loading={loading}
      />
    </>
  );
}
