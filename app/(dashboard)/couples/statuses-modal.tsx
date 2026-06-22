/**
 * Modal shell that hosts the couple-status editor. Opened from the gear
 * button in the couples header so MCs can manage statuses next to the board
 * they affect (previously this lived under Settings → Statuses).
 *
 * @module app/(dashboard)/couples/statuses-modal
 */
'use client';

import { Modal } from '@/components/ui/modal';

import { StatusesEditor } from './statuses-editor';

interface StatusesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Wraps {@link StatusesEditor} in the shared Modal. */
export function StatusesModal({ isOpen, onClose }: StatusesModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage statuses" size="lg">
      <StatusesEditor onClose={onClose} />
    </Modal>
  );
}
