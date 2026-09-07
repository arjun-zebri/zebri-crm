'use client';

/**
 * Create, recolour, rename and delete workflow tags.
 *
 * Follows the couple-statuses editor: a list of rows, each with a colour
 * swatch, an inline name field and a delete, plus one add row at the
 * bottom. Same shape of feature, so the same shape of UI.
 *
 * @module app/(dashboard)/workflows/tag-editor-modal
 */

import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  TAG_DOT_CLASS,
  WORKFLOW_TAG_COLORS,
  toTagColor,
  type TagColor,
} from '@/types/workflows';

export interface TagEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: { id: string; name: string; color: string }[];
  onCreate: (name: string, color: TagColor) => Promise<void>;
  onUpdate: (tagId: string, patch: { name?: string; color?: TagColor }) => Promise<void>;
  onDelete: (tagId: string) => Promise<void>;
}

/** Row of colour swatches. Shared by the add row and each tag row. */
function Swatches({
  value,
  onChange,
}: {
  value: TagColor;
  onChange: (c: TagColor) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {WORKFLOW_TAG_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={c === value}
          onClick={() => onChange(c)}
          className={`h-4 w-4 rounded-pill ${TAG_DOT_CLASS[c]} ${
            c === value ? 'ring-2 ring-brand-fg ring-offset-1' : ''
          }`}
        />
      ))}
    </div>
  );
}

/** The tag manager. See {@link TagEditorModalProps}. */
export function TagEditorModal({
  isOpen,
  onClose,
  tags,
  onCreate,
  onUpdate,
  onDelete,
}: TagEditorModalProps) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<TagColor>('gray');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await onCreate(name, newColor);
      setNewName('');
      setNewColor('gray');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Workflow tags" size="md">
      <div className="space-y-3">
        {tags.length === 0 ? (
          <Empty
            title="No tags yet"
            description="Tags group your workflows so the library stays scannable."
            size="sm"
          />
        ) : (
          <ul className="space-y-2">
            {tags.map((tag) => (
              <li key={tag.id} className="flex items-center gap-3">
                <Swatches
                  value={toTagColor(tag.color)}
                  onChange={(color) => void onUpdate(tag.id, { color })}
                />
                <Input
                  defaultValue={tag.name}
                  aria-label={`Rename ${tag.name}`}
                  onBlur={(e) => {
                    const next = e.currentTarget.value.trim();
                    if (next && next !== tag.name) void onUpdate(tag.id, { name: next });
                  }}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label={`Delete ${tag.name}`}
                  onClick={() => void onDelete(tag.id)}
                >
                  <Trash2 size={16} strokeWidth={1.5} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 border-t border-border pt-3">
          <Swatches value={newColor} onChange={setNewColor} />
          <Input
            value={newName}
            aria-label="New tag name"
            placeholder="New tag"
            onChange={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
            }}
            className="flex-1"
          />
          <Button onClick={() => void handleCreate()} loading={saving} disabled={!newName.trim()}>
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}
