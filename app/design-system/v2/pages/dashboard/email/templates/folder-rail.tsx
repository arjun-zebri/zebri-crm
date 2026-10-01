'use client';

import { Dropdown } from '@/components/ui-v2/dropdown';

import { FOLDERS, type EmailTemplate, type FolderId } from '../email-data';

/**
 * The Templates tab's folders: All, the MC's folders, then Archived, as
 * plain text rows with a quiet count, the current one tinted and bold,
 * like a sidebar row. No box around it: the rail sits on the backdrop
 * beside the rows. On phones the rail becomes a `Dropdown` above them.
 *
 * @module app/design-system/v2/pages/dashboard/email/templates/folder-rail
 */

/** A folder pick: every live template, one folder, or the archive. */
export type FolderPick = 'all' | FolderId | 'archived';

/** Whether a template shows under a folder pick. */
export const inFolder = (t: EmailTemplate, f: FolderPick) =>
  f === 'archived' ? Boolean(t.archivedOn) : !t.archivedOn && (f === 'all' || t.folder === f);

export interface FolderRailProps {
  templates: EmailTemplate[];
  value: FolderPick;
  onChange: (f: FolderPick) => void;
}

/** The rail. See {@link FolderRailProps}. */
export function FolderRail({ templates, value, onChange }: FolderRailProps) {
  const picks: { value: FolderPick; label: string }[] = [
    { value: 'all', label: 'All templates' },
    ...FOLDERS.map((f) => ({ value: f.id, label: f.name })),
    { value: 'archived', label: 'Archived' },
  ];
  const count = (f: FolderPick) => templates.filter((t) => inFolder(t, f)).length;
  return (
    <>
      <div className="lg:hidden">
        <Dropdown
          label="Folder"
          options={picks.map((p) => ({ value: p.value, label: `${p.label} (${count(p.value)})` }))}
          value={value}
          onChange={(v) => onChange(v as FolderPick)}
        />
      </div>
      <nav aria-label="Folders" className="hidden lg:block">
        <ul className="space-y-0.5">
          {picks.map((p) => {
            const on = p.value === value;
            return (
              // Archived sits apart from the working folders.
              <li key={p.value} className={p.value === 'archived' ? 'pt-4' : undefined}>
                <button
                  type="button"
                  aria-current={on ? 'true' : undefined}
                  onClick={() => onChange(p.value)}
                  className={`flex h-9 w-full items-center justify-between gap-3 rounded-button px-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500 motion-reduce:transition-none ${
                    on ? 'bg-zebra-950/5 type-label text-zebra-950' : 'type-body text-zebra-600 hover:bg-zebra-950/[0.03] hover:text-zebra-950'
                  }`}
                >
                  <span className="truncate">{p.label}</span>
                  <span className="type-body tabular-nums text-zebra-400">{count(p.value)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
