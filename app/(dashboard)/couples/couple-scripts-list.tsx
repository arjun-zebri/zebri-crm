'use client';

import { Copy, Pencil, ScrollText, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';

import type { CoupleScript } from './use-couple-scripts';

/** "3m ago" style relative time, matching the Vows tab. */
export function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-AU');
}

interface ScriptRowProps {
  script: CoupleScript;
  onOpen: () => void;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function ScriptRow({ script, onOpen, onRename, onDuplicate, onDelete }: ScriptRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(script.title);
  const [confirm, setConfirm] = useState(false);

  const commitRename = () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== script.title) onRename(next);
    else setDraft(script.title);
  };

  return (
    <li className="group/row flex items-center gap-3 rounded-control border border-border px-3 py-2 transition hover:border-border-strong hover:bg-surface-muted">
      <ScrollText size={16} strokeWidth={1.5} className="shrink-0 text-text-subtle" />
      {renaming ? (
        <div className="flex-1 min-w-0">
          <Input
            autoFocus
            aria-label="Script title"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setDraft(script.title); setRenaming(false); }
            }}
          />
        </div>
      ) : (
        <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
          <span className="block truncate text-body font-medium text-text">{script.title}</span>
          <span className="block text-body text-text-subtle">Updated {timeAgo(script.updated_at)}</span>
        </button>
      )}
      <RowActionsMenu
        alwaysVisible
        size="sm"
        actions={[
          { label: 'Rename', icon: <Pencil size={14} strokeWidth={1.5} />, onSelect: () => setRenaming(true) },
          { label: 'Duplicate', icon: <Copy size={14} strokeWidth={1.5} />, onSelect: onDuplicate },
          { label: 'Delete', icon: <Trash2 size={14} strokeWidth={1.5} />, destructive: true, onSelect: () => setConfirm(true) },
        ]}
      />
      <ConfirmDialog
        open={confirm}
        title="Delete this script?"
        description={`"${script.title}" will be deleted. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { setConfirm(false); onDelete(); }}
        onCancel={() => setConfirm(false)}
      />
    </li>
  );
}

export interface CoupleScriptsListProps {
  scripts: CoupleScript[];
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

/** The couple's scripts as a list of rows with rename / duplicate / delete. */
export function CoupleScriptsList({ scripts, onOpen, onRename, onDuplicate, onDelete }: CoupleScriptsListProps) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Scripts">
      {scripts.map((s) => (
        <ScriptRow
          key={s.id}
          script={s}
          onOpen={() => onOpen(s.id)}
          onRename={(title) => onRename(s.id, title)}
          onDuplicate={() => onDuplicate(s.id)}
          onDelete={() => onDelete(s.id)}
        />
      ))}
    </ul>
  );
}
