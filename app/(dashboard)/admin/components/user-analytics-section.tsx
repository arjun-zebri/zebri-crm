'use client';

import { useEffect, useState } from 'react';

import { fetchUserAnalytics } from '@/app/admin/actions';
import { useToast } from '@/components/ui/toast';
import type { UserAnalytics } from '@/lib/admin/admin-analytics';

function formatDateTime(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US');
}

/**
 * Read-only activity counts (couples / events / invoices / contracts)
 * for the target user + their last-sign-in timestamp. Data comes from
 * the service-role `getUserAnalytics()` helper via the
 * {@link fetchUserAnalytics} server action.
 */
export function UserAnalyticsSection({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUserAnalytics(userId)
      .then((d) => {
        if (!cancelled) setAnalytics(d);
      })
      .catch(() => {
        if (!cancelled) toast('Failed to load analytics', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, toast]);

  return (
    <section>
      <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted mb-2">
        Activity
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Couples" value={loading ? '…' : analytics?.couples ?? 0} />
        <Stat label="Events" value={loading ? '…' : analytics?.events ?? 0} />
        <Stat label="Invoices" value={loading ? '…' : analytics?.invoices ?? 0} />
        <Stat label="Contracts" value={loading ? '…' : analytics?.contracts ?? 0} />
      </div>
      <p className="mt-2 text-xs text-text-muted">
        Last sign-in:{' '}
        {loading ? '…' : formatDateTime(analytics?.lastSignInAt ?? null)}
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border rounded-control px-3 py-2 bg-surface">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="text-base font-semibold text-text">{value}</div>
    </div>
  );
}
