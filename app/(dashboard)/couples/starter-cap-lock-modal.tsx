/**
 * Blocking modal shown when a Starter user attempts to open a couple
 * modal while they have more than the cap of couples.
 *
 * Two paths forward:
 *   1. Upgrade to Pro — links to /settings?tab=billing.
 *   2. Reduce couple count — close the modal, delete some couples,
 *      then everything unlocks naturally.
 *
 * @module app/(dashboard)/couples/starter-cap-lock-modal
 */
'use client';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

export interface StarterCapLockModalProps {
  open: boolean;
  onClose: () => void;
  /** How many couples the user currently has (always > cap when this opens). */
  count: number;
  cap: number;
}

export function StarterCapLockModal({ open, onClose, count, cap }: StarterCapLockModalProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="You're over the Starter limit"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" type="button" onClick={onClose}>
            Close
          </Button>
          <Link
            href="/settings?tab=billing"
            className="inline-flex h-9 items-center justify-center rounded-control bg-brand-fg px-4 text-body font-medium text-text-inverse transition-colors hover:opacity-90"
          >
            Resubscribe to Pro
          </Link>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <AlertCircle size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-warning" />
        <div className="text-body text-text">
          <p>
            You have <strong>{count} couples</strong> but the free Starter plan supports up to{' '}
            <strong>{cap}</strong>. While you&apos;re over the limit you can&apos;t open or edit
            couples.
          </p>
          <p className="mt-3 text-text-muted">
            <strong>Two ways to unlock:</strong>
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-text-muted">
            <li>Resubscribe to Pro for unlimited couples.</li>
            <li>
              Delete couples until you&apos;re at {cap} or fewer (your existing data stays in the
              list).
            </li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
