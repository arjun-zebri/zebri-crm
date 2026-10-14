'use client';

/**
 * The fixed pieces around the sequence editor: the list of everything
 * blocking a save, the mobile Steps / Preview switch, and the footer.
 *
 * Split out so the editor itself stays a composition of steps and preview.
 *
 * @module features/outreach/views/sequences/sequence-editor-chrome
 */
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';

/** Which pane a phone shows. On md and up both panes always show. */
export type EditorPane = 'steps' | 'preview';

/**
 * Every problem that blocks saving, not just the first. A founder who
 * fixes one and then finds another would otherwise go round in circles.
 */
export function SaveBlockers({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <Callout tone="warning">
      <p className="font-medium">Fix {problems.length === 1 ? 'this' : 'these'} before saving:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </Callout>
  );
}

/**
 * Steps / Preview switch, shown below md only. Phones cannot see the
 * steps and the preview side by side, so one pane is shown at a time.
 */
export function PaneToggle({ pane, onChange }: { pane: EditorPane; onChange: (p: EditorPane) => void }) {
  const options: { id: EditorPane; label: string }[] = [
    { id: 'steps', label: 'Steps' },
    { id: 'preview', label: 'Preview' },
  ];
  return (
    <div className="flex gap-2 md:hidden">
      {options.map((o) => (
        <Button
          key={o.id}
          variant={pane === o.id ? 'primary' : 'outline'}
          aria-pressed={pane === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * Footer: a short count of what is left to fix, then Cancel and Save.
 * The full list lives in {@link SaveBlockers}; the footer only points to it.
 */
export function EditorFooter({
  problems,
  saving,
  onCancel,
  onSave,
}: {
  problems: string[];
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const hint = problems.length === 0 ? '' : `${problems.length} ${problems.length === 1 ? 'thing' : 'things'} to fix`;
  return (
    <div className="flex w-full items-center justify-between gap-3">
      <p className="min-w-0 truncate text-body text-text-muted">{hint}</p>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button loading={saving} disabled={problems.length > 0} onClick={onSave}>
          Save sequence
        </Button>
      </div>
    </div>
  );
}
