'use client';

/**
 * Put tags on one workflow.
 *
 * Tags existed, could be created, coloured and filtered by, and there
 * was no way to attach one to anything. `setTemplateTags` had been
 * wired through the library hook since the tag editor shipped; nothing
 * ever called it.
 *
 * A small modal rather than a submenu on the card's overflow menu: the
 * menu closes on every selection, so tagging a workflow twice meant
 * opening it twice.
 *
 * @module app/(dashboard)/workflows/template-tags-modal
 */

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/modal';
import { TAG_PILL_CLASS, toTagColor } from '@/types/workflows';

export interface TemplateTagsModalProps {
  /** The workflow being tagged, or null when closed. */
  template: { id: string; name: string; tagIds: string[] } | null;
  tags: { id: string; name: string; color: string }[];
  onClose: () => void;
  onSave: (templateId: string, tagIds: string[]) => Promise<void>;
  /** Opens the tag editor, for when none exist yet. */
  onManageTags: () => void;
}

/** The tag assignment modal. See {@link TemplateTagsModalProps}. */
export function TemplateTagsModal({
  template,
  tags,
  onClose,
  onSave,
  onManageTags,
}: TemplateTagsModalProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Reseed whenever a different workflow is opened, so the ticks always
  // describe the one on screen.
  useEffect(() => {
    setPicked(template?.tagIds ?? []);
  }, [template]);

  function toggle(tagId: string) {
    setPicked((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  }

  async function save() {
    if (!template) return;
    setSaving(true);
    try {
      await onSave(template.id, picked);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={template !== null}
      onClose={onClose}
      title={template ? `Tags for ${template.name}` : 'Tags'}
      size="sm"
    >
      <div className="space-y-4">
        {tags.length === 0 ? (
          <div className="space-y-3">
            <p className="text-body text-text-muted">
              You have no tags yet. They are how a library of twenty workflows
              stays findable.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                onClose();
                onManageTags();
              }}
            >
              Make a tag
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-3 rounded-control px-2 py-1 hover:bg-surface-muted"
              >
                <Checkbox
                  checked={picked.includes(tag.id)}
                  onChange={() => toggle(tag.id)}
                  ariaLabel={tag.name}
                />
                <span
                  className={`rounded-pill px-2 py-0.5 text-body ring-1 ring-inset ${TAG_PILL_CLASS[toTagColor(tag.color)]}`}
                >
                  {tag.name}
                </span>
              </label>
            ))}
          </div>
        )}

        {tags.length > 0 ? (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              Save tags
            </Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
