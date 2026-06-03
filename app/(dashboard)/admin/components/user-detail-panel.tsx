'use client';

import { SidePanel } from '@/components/ui/side-panel';
import type { AdminUser } from '@/lib/admin/admin-analytics';

import { AccountActionsSection } from './account-actions-section';
import { SubscriptionActionsSection } from './subscription-actions-section';
import { UserAnalyticsSection } from './user-analytics-section';
import { UserProfileSection } from './user-profile-section';

/**
 * Admin user detail panel — slides in from the right when a row is
 * clicked in any of the admin tabs. Pure composition over the four
 * sub-sections (profile / activity / subscription / account
 * actions); all mutation logic lives in the children.
 */
export function UserDetailPanel({
  user,
  onClose,
  onRefresh,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <SidePanel
      isOpen={!!user}
      onClose={onClose}
      title={user ? user.email : undefined}
    >
      {user && (
        <div key={user.id} className="space-y-6">
          <UserProfileSection user={user} onRefresh={onRefresh} />
          <UserAnalyticsSection userId={user.id} />
          <SubscriptionActionsSection user={user} onRefresh={onRefresh} />
          <AccountActionsSection user={user} onClose={onClose} onRefresh={onRefresh} />
        </div>
      )}
    </SidePanel>
  );
}
