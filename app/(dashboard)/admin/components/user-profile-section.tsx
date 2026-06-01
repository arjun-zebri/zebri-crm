'use client';

import { useState } from 'react';

import { updateUserProfile } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import type { AdminUser } from '@/lib/admin/admin-analytics';

/**
 * Editable display + business name fields. Calls
 * {@link updateUserProfile} which writes to user_metadata only —
 * entitlement fields go through `updateEntitlements()` in
 * sibling sections.
 */
export function UserProfileSection({
  user,
  onRefresh,
}: {
  user: AdminUser;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(user.display_name);
  const [businessName, setBusinessName] = useState(user.business_name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile(user.id, {
        display_name: displayName,
        business_name: businessName,
      });
      toast('Profile updated');
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted mb-2">
        Profile
      </h3>
      <div className="space-y-3">
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Input
          label="Business name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </section>
  );
}
