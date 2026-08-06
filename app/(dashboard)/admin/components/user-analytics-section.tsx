'use client';

import { useEffect, useState } from 'react';

import { fetchUserAnalytics } from '@/app/admin/actions';
import { useToast } from '@/components/ui/toast';
import type { UserAnalytics } from '@/lib/admin/admin-analytics';

function formatRelative(iso: string | null) {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} hr ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)} days ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Slim activity strip — couples / events / invoices / contracts
 * count + last sign-in. Replaces the previous heavy 2x2 grid of
 * boxed stats.
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
      <h3 className="text-caption font-medium uppercase tracking-wide text-text-muted mb-3">
        Activity
      </h3>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-body">
        <Stat label="Couples" value={loading ? '…' : analytics?.couples ?? 0} />
        <Stat label="Events" value={loading ? '…' : analytics?.events ?? 0} />
        <Stat label="Invoices" value={loading ? '…' : analytics?.invoices ?? 0} />
        <Stat label="Contracts" value={loading ? '…' : analytics?.contracts ?? 0} />
      </div>
      <p className="mt-3 text-caption text-text-muted">
        Last sign-in: {loading ? '…' : formatRelative(analytics?.lastSignInAt ?? null)}
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-base font-semibold text-text">{value}</span>
      <span className="text-caption text-text-muted">{label}</span>
    </div>
  );
}
