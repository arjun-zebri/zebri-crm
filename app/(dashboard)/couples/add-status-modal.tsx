/**
 * The "Add new status" dialog used by the couple-status editor. Collects a
 * name + colour and creates the status via `useCreateStatus`.
 *
 * Rendered as a `nested` Modal because it opens on top of the statuses
 * editor modal — `nested` keeps Escape/overlay z-index scoped to the
 * topmost dialog so closing it doesn't also close the editor.
 *
 * @module app/(dashboard)/couples/add-status-modal
 */
'use client';

import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';

import { useCreateStatus } from '@/app/(dashboard)/couples/use-couple-statuses';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { COLOR_PALETTE, getStatusClasses } from '@/types/couple';

interface AddStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Modal form for creating a new couple status. */
export function AddStatusModal({ isOpen, onClose }: AddStatusModalProps) {
  const createStatus = useCreateStatus();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>('blue');
  const [colorOpen, setColorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const reset = () => {
    setName('');
    setColor('blue');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      await createStatus.mutateAsync({ name, color });
      reset();
      onClose();
      toast('Status created.');
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Failed to create status', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      nested
      title="Add new status"
      footer={
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="text-sm px-4 py-2 rounded-control bg-gray-100 text-gray-900 hover:bg-gray-200 transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            className="text-sm px-4 py-2 rounded-control bg-black text-white hover:bg-neutral-800 transition disabled:opacity-50 cursor-pointer"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Inquiry, Interested, Engaged"
            className="w-full text-sm border border-gray-200 rounded-control px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-200"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <Popover.Root open={colorOpen} onOpenChange={setColorOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-control hover:bg-gray-50 transition text-sm cursor-pointer"
              >
                <div className={`w-5 h-5 rounded-pill ${getStatusClasses(color).dot}`} />
                <span className="text-gray-900 capitalize">{color}</span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="bg-white border border-gray-200 rounded-control shadow-lg p-2 z-[9999]"
                sideOffset={4}
                align="start"
              >
                <div className="grid grid-cols-5 gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setColor(c);
                        setColorOpen(false);
                      }}
                      className={`w-6 h-6 rounded-pill border-2 transition cursor-pointer ${
                        color === c ? 'border-black' : 'border-gray-300'
                      } ${getStatusClasses(c).dot}`}
                      title={c}
                    />
                  ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </form>
    </Modal>
  );
}
