'use client';

import { useState } from 'react';

import { updateUserProfile } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import type { AdminUser } from '@/lib/admin/admin-analytics';

/**
 * Display + business name editor. Calls {@link updateUserProfile}
 * which writes to `user_metadata` only — entitlement writes route
 * through `updateEntitlements()` in sibling sections.
 *
 * Save button is hidden until the form is dirty.
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

  const dirty =
    displayName !== user.display_name || businessName !== user.business_name;

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
      <h3 className="text-caption font-medium uppercase tracking-wide text-text-muted mb-3">
        Profile
      </h3>
      <div className="space-y-3">
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          size="sm"
        />
        <Input
          label="Business name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          size="sm"
        />
        {dirty && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        )}
      </div>
    </section>
  );
}
