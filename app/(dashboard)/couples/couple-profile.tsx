/**
 * Couple Profile — the centered full-screen modal (not a slide-in
 * drawer; see Phase 4 plan §2 decision 6a) that opens when a couple
 * is clicked in the list/kanban.
 *
 * Tabs nesting every per-couple feature: Overview, Tasks, Contacts,
 * Timeline, Songs, Files, Vows, Payments, Contracts, Questionnaires,
 * Automations, Emails. Contracts
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
  CheckSquare,
  ClipboardList,
  Clock,
  FileSignature,
  Heart,
  LayoutDashboard,
  Mail,
  Music,
  Paperclip,
  Receipt,
  Sparkles,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { getOpenModalDepth } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { Couple } from '@/types/couple';

import { rotateCouplePortalTokenAction } from './actions';
import { CoupleProfileBody } from './couple-profile-body';
import { CoupleProfileHeader } from './couple-profile-header';
import { CoupleProfileNav } from './couple-profile-nav';
import { orderedTabKeys, visibleTabKeys } from './couple-profile-tabs';
import type {
  CoupleProfileNavItem,
  CoupleProfileSection,
} from './couple-profile-types';
import { PersonModal, SongModal } from './portal-modals';
import { useCoupleProfileTabsConfig } from './use-couple-profile-tabs';
import { useCoupleStatuses } from './use-couple-statuses';
import { usePortalData } from './use-portal-data';

const NAV_ITEMS: CoupleProfileNavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: <LayoutDashboard size={18} strokeWidth={1.5} />,
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
    key: 'vows',
    label: 'Vows',
    icon: <Heart size={18} strokeWidth={1.5} />,
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
    key: 'questionnaires',
    label: 'Questionnaires',
    icon: <ClipboardList size={18} strokeWidth={1.5} />,
  },
  {
    key: 'automations',
    label: 'Automations',
    icon: <Sparkles size={18} strokeWidth={1.5} />,
  },
  {
    key: 'emails',
    label: 'Emails',
    icon: <Mail size={18} strokeWidth={1.5} />,
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

  // Per-user, global-across-couples tab layout (hide + reorder). `draftConfig`
  // is the live working copy: edits in settings mode mutate it and the nav
  // reflects them immediately (no flicker on toggling the gear). It is seeded
  // from the saved `tabsConfig` on open and persisted when the modal closes.
  // Contracts stays in the list on every plan — the Starter 5-couple cap is
  // enforced inside `CoupleContracts` at create time.
  const { config: tabsConfig, saveConfig } = useCoupleProfileTabsConfig();
  const [settingsMode, setSettingsMode] = useState(false);
  const [draftConfig, setDraftConfig] = useState(tabsConfig);

  // Both lists derive from the draft so the live nav and the settings list
  // stay in lock-step. `orderedNavItems` is the full set (settings mode);
  // `navItems` drops hidden tabs (the live nav).
  const orderedNavItems = useMemo(
    () =>
      orderedTabKeys(draftConfig)
        .map((key) => NAV_ITEMS.find((item) => item.key === key))
        .filter((item): item is CoupleProfileNavItem => Boolean(item)),
    [draftConfig],
  );
  const navItems = useMemo(
    () =>
      visibleTabKeys(draftConfig)
        .map((key) => NAV_ITEMS.find((item) => item.key === key))
        .filter((item): item is CoupleProfileNavItem => Boolean(item)),
    [draftConfig],
  );

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

  // Hold the latest saved config in a ref so the open effect can seed the draft
  // without depending on it (saving must not retrigger the open reset). Synced
  // in its own effect — never assigned during render.
  const tabsConfigRef = useRef(tabsConfig);
  useEffect(() => {
    tabsConfigRef.current = tabsConfig;
  }, [tabsConfig]);

  // Reset state when the user opens a different couple: land on the caller's
  // tab (default Overview), dismiss any delete confirmation, leave settings
  // mode, and reseed the draft from the saved layout. The setState-in-effect is
  // intentional — the source of truth for "which couple is open" lives in the
  // parent's selectedCouple state.
  useEffect(() => {
    if (couple) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSection(defaultTab);
      setDeleteConfirm(false);
      setSettingsMode(false);
      setDraftConfig(tabsConfigRef.current);
    }
  }, [couple, defaultTab]);

  // If the active tab gets hidden while editing, fall the body back to the
  // first still-visible tab (Overview can never be hidden, so this is safe).
  useEffect(() => {
    const fallback = navItems[0];
    if (fallback && !navItems.some((n) => n.key === activeSection)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSection(fallback.key);
    }
  }, [navItems, activeSection]);

  // Persist the draft layout if it changed since the last save. The nav reads
  // from the draft (not the saved config), so saving never flickers the rows.
  const persistDraft = useCallback(
    (opts?: { toast?: boolean }) => {
      if (JSON.stringify(draftConfig) === JSON.stringify(tabsConfig)) return;
      saveConfig.mutate(draftConfig, {
        onSuccess: () => {
          if (opts?.toast) toast('Tab layout saved');
        },
        onError: () => toast('Could not save tab layout'),
      });
    },
    [draftConfig, tabsConfig, saveConfig, toast],
  );

  // Gear toggles settings mode; exiting it persists the layout with a
  // confirmation toast so the change clearly "lands".
  const handleSettingsToggle = () => {
    if (settingsMode) persistDraft({ toast: true });
    setSettingsMode((on) => !on);
  };

  // Persist (silently) as the modal closes too — covers closing while still in
  // settings mode. Every close path — overlay, Esc, the header ✕ — routes here.
  const handleClose = useCallback(() => {
    persistDraft();
    onClose();
  }, [persistDraft, onClose]);

  // Read the latest `handleClose` from a ref so the Esc/scroll-lock effect can
  // depend only on `couple` (a changing draft must not re-bind the listener).
  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  }, [handleClose]);

  // Esc-closes-the-modal — but only when no nested modal is open
  // (the modal stack via `getOpenModalDepth()` prevents the profile
  // from closing under a confirm dialog or portal-people picker).
  // Lock body scroll while open.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && getOpenModalDepth() === 0) handleCloseRef.current();
    };
    if (couple) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    }
  }, [couple]);

  if (!couple) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
        onClick={handleClose}
      />

      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
        onClick={handleClose}
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
            onClose={handleClose}
            onRotateLinks={() => setRotateConfirm(true)}
            onDeleteRequest={() => setDeleteConfirm(true)}
            settingsMode={settingsMode}
            onSettingsToggle={handleSettingsToggle}
          />

          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
            <CoupleProfileNav
              navItems={navItems}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              settingsMode={settingsMode}
              settingsItems={orderedNavItems}
              draftConfig={draftConfig}
              onDraftChange={setDraftConfig}
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
