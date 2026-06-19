/**
 * Tab-content router for the Couple Profile overlay (modal).
 *
 * Dispatches the active section to the matching tab component.
 * Pure switch — the parent owns the section state + the portal-data
 * hook (which feeds the Contacts / Songs / Files tabs).
 *
 * @module app/(dashboard)/couples/couple-profile-body
 */
'use client';

import type { Couple } from '@/types/couple';

import { CoupleAutomations } from './couple-automations';
import { CoupleContracts } from './couple-contracts';
import { CoupleEmails } from './couple-emails';
import { CoupleOverview } from './couple-overview';
import { CouplePayments } from './couple-payments';
import type { CoupleProfileSection } from './couple-profile-types';
import { CouplePulse } from './couple-pulse';
import { CoupleTasks } from './couple-tasks';
import { CoupleTimeline } from './couple-timeline';
import { McPortalContacts } from './mc-portal-contacts';
import { McPortalFiles } from './mc-portal-files';
import { McPortalSongs } from './mc-portal-songs';
import { McPortalVows } from './mc-portal-vows';
import type { usePortalData } from './use-portal-data';

export interface CoupleProfileBodyProps {
  couple: Couple;
  activeSection: CoupleProfileSection;
  onSave: (
    data: Omit<Couple, 'id' | 'user_id' | 'created_at'> & { id?: string },
  ) => void;
  portal: ReturnType<typeof usePortalData>;
}

export function CoupleProfileBody({
  couple,
  activeSection,
  onSave,
  portal,
}: CoupleProfileBodyProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 pt-2 sm:pt-3 pb-4 sm:pb-6 flex flex-col">
      {activeSection === 'overview' && (
        <div className="flex-1 flex flex-col min-h-0">
          <CoupleOverview couple={couple} onSave={onSave} />
        </div>
      )}

      {activeSection === 'pulse' && <CouplePulse couple={couple} />}

      {activeSection === 'tasks' && <CoupleTasks coupleId={couple.id} />}

      {activeSection === 'payments' && (
        <CouplePayments coupleId={couple.id} coupleName={couple.name} />
      )}

      {activeSection === 'contracts' && (
        <CoupleContracts coupleId={couple.id} coupleName={couple.name} />
      )}

      {activeSection === 'contacts' && (
        <McPortalContacts
          couple={couple}
          people={portal.people}
          isPeopleLoading={portal.isPeopleLoading}
          coupleId={couple.id}
          onEditPerson={portal.openEditPerson}
          onAddPerson={portal.openAddPerson}
        />
      )}

      {activeSection === 'timeline' && (
        <CoupleTimeline coupleId={couple.id} coupleName={couple.name} />
      )}

      {activeSection === 'songs' && (
        <McPortalSongs
          coupleId={couple.id}
          onEditSong={portal.openEditSong}
          onAddSong={portal.openAddSong}
        />
      )}

      {activeSection === 'files' && <McPortalFiles coupleId={couple.id} />}

      {activeSection === 'vows' && (
        <McPortalVows
          coupleId={couple.id}
          primaryName={couple.primary_name ?? couple.name}
          secondaryName={couple.secondary_name ?? null}
        />
      )}

      {activeSection === 'automations' && (
        <CoupleAutomations coupleId={couple.id} />
      )}

      {activeSection === 'emails' && <CoupleEmails coupleId={couple.id} coupleName={couple.name} />}
    </div>
  );
}
