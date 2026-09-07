'use client';

/**
 * Describe your process, and Zebri AI builds it.
 *
 * The fastest path from an empty library to a working workflow, and the
 * one thing a competitor cannot copy by adding a feature: the MC types
 * how they actually work, in their own words, and gets a canvas with the
 * steps and the dates already on it.
 *
 * It creates an empty draft, then hands the description to the copilot
 * on the canvas through the URL, so the MC never types it twice.
 *
 * Deliberately almost wordless. The first version explained itself in
 * four paragraphs: an intro, a labelled name field, three worked
 * examples printed in full, and a closing reassurance. That is more
 * reading than the task is worth, and nobody reads a paragraph in a box
 * that is asking them to type. What is left is one field and two
 * buttons:
 *
 * - The intro is now the placeholder, where it is read at the moment it
 *   is useful rather than above the thing it describes.
 * - The name field is gone. It is inferable from the description and
 *   editable on the canvas a second later, so asking for it up front
 *   only stands between the MC and the one thing that matters.
 * - The worked examples are gone too, in both forms. As prose they were
 *   three paragraphs to read; reduced to chips they were still three
 *   decisions offered before the MC had made the only one that counts.
 *   The placeholder carries the shape of a good answer on its own.
 * - The "nothing is turned on" footer is gone. The canvas says DRAFT and
 *   nothing sends until it is switched on; a promise in small print
 *   under a button is not what makes that true.
 *
 * The field does not resize. It sits in a modal, where dragging it
 * taller only pushes the buttons around.
 *
 * @module app/(dashboard)/workflows/describe-workflow
 */

import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';

import { createWorkflowTemplateAction } from './actions';

export interface DescribeWorkflowProps {
  isOpen: boolean;
  onClose: () => void;
}

/** The describe-it modal. See {@link DescribeWorkflowProps}. */
export function DescribeWorkflow({ isOpen, onClose }: DescribeWorkflowProps) {
  const router = useRouter();
  const [description, setDescription] = useState('');

  const build = useMutation({
    mutationFn: async () => {
      // Named on the canvas, not here. The copilot has the description
      // and can title it better than an empty field can.
      const res = await createWorkflowTemplateAction({
        name: 'Untitled workflow',
        applyRuleType: 'manual',
        applyRuleConfig: {},
      });
      if (!res.ok) throw new Error(res.error);
      return res.data.id;
    },
    onSuccess: (id) => {
      onClose();
      router.push(`/workflows/${id}?describe=${encodeURIComponent(description.trim())}`);
    },
  });

  // No minimum length. A word count is the wrong gate: it blocks a
  // terse description that would have worked and passes a long one that
  // says nothing. Anything at all is enough to hand the copilot.
  const canBuild = description.trim().length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Describe your process" size="md">
      <div className="space-y-4">
        <Textarea
          aria-label="Describe your process"
          rows={8}
          autoFocus
          value={description}
          placeholder="How do you run it? Write it the way you would explain it to a new assistant, and say when things happen, especially anything tied to the wedding day."
          onChange={(e) => setDescription(e.currentTarget.value)}
        />

        {build.error ? (
          <p className="text-body text-danger">{(build.error as Error).message}</p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => build.mutate()} loading={build.isPending} disabled={!canBuild}>
            <Sparkles size={16} strokeWidth={1.5} />
            Build it
          </Button>
        </div>
      </div>
    </Modal>
  );
}
