'use client';

/**
 * What surrounds the step's own fields in the detail modal.
 *
 * Where it sits (couple, wedding date, workflow), whose move it is, why
 * it failed if it did, and anything the message could not fill in. The
 * step's content is a form below this, not a read view: the modal opens
 * editable.
 *
 * @module app/(dashboard)/workflows/step-detail-body
 */

import { AlertTriangle } from 'lucide-react';

import { Callout } from '@/components/ui/callout';
import { Skeleton, SkeletonRegion, SkeletonText } from '@/components/ui/skeleton';

import type { StepDetail } from './instance-actions';

/** "37 days out", or null when the couple has no date yet. */
function daysOut(weddingDate: string | null): string | null {
  if (!weddingDate) return null;
  const today = new Date();
  const target = new Date(`${weddingDate}T12:00:00Z`);
  const delta = Math.round(
    (target.getTime() - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12)) /
      86_400_000,
  );
  if (delta === 0) return 'today';
  if (delta < 0) return `${Math.abs(delta)} days ago`;
  return `${delta} days out`;
}

/** "12 Oct" for a `YYYY-MM-DD`. */
function shortDate(date: string | null): string | null {
  if (!date) return null;
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
}

export interface StepDetailBodyProps {
  data: StepDetail;
}

/** The context above a step's fields. See {@link StepDetailBodyProps}. */
export function StepDetailBody({ data }: StepDetailBodyProps) {
  const context = [
    data.coupleName ?? 'Just for you',
    shortDate(data.weddingDate),
    daysOut(data.weddingDate),
    data.instanceName ? `${data.instanceName} · step ${data.stepIndex} of ${data.stepTotal}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const unresolved = data.preview?.unresolved ?? [];

  return (
    <div className="space-y-3">
      <p className="text-body text-text-muted">{context}</p>

      {/* The whole reason the step is sitting here. Without it the
          modal reads like a receipt for something already done. */}
      {data.requiresApproval && data.status === 'pending' ? (
        <Callout tone="warning">
          This is waiting on you. Nothing goes out until you send it.
        </Callout>
      ) : null}

      {data.status === 'errored' && data.errorMessage ? (
        <Callout tone="danger">{data.errorMessage}</Callout>
      ) : null}

      {data.description && data.type === 'action' ? (
        <p className="whitespace-pre-wrap text-body text-text-muted">{data.description}</p>
      ) : null}

      {unresolved.length > 0 ? (
        <p className="flex items-start gap-2 text-body text-danger">
          <AlertTriangle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <span>
            {unresolved.join(', ')} could not be filled in. Edit the message or add the
            detail to the couple before sending.
          </span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The same shape, while the step is still loading.
 *
 * A spinner in a modal that then grows to fit its content moves the
 * buttons out from under the MC's cursor. The skeleton holds the
 * geometry the real step will take.
 */
export function StepDetailBodySkeleton() {
  return (
    <SkeletonRegion label="Loading the step" className="space-y-3">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-11 w-full" />
      <div className="space-y-2 pt-1">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-20" />
        <SkeletonText lines={5} />
      </div>
    </SkeletonRegion>
  );
}
