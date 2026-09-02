'use client';

import { Plus, ScrollText } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';
import type { Couple } from '@/types/couple';

import { CoupleScriptModal } from './couple-script-modal';
import { CoupleScriptsList } from './couple-scripts-list';
import { CoupleTabEmpty, CoupleTabShell, tabStat } from './couple-tab-shell';
import { createScriptAction, deleteScriptAction, duplicateScriptAction, updateScriptAction } from './script-actions';
import { useCoupleScripts, useInvalidateCoupleScripts } from './use-couple-scripts';

function ScriptsSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse" aria-hidden="true">
      {[0, 1].map((i) => <div key={i} className="h-12 rounded-control bg-surface-emphasis" />)}
    </div>
  );
}

/**
 * Scripts tab of the Couple Profile: the ceremony / reception scripts the MC
 * reads from on the day. A list of named scripts; opening one shows the
 * editor in a modal over the profile. Orchestrator only: data via
 * `useCoupleScripts`, writes via the script actions, the editor in
 * `CoupleScriptModal`.
 */
export function CoupleScripts({ couple }: { couple: Couple }) {
  const { toast } = useToast();
  const { data: scripts = [], isLoading, isError, refetch } = useCoupleScripts(couple.id);
  const invalidate = useInvalidateCoupleScripts(couple.id);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const open = scripts.find((s) => s.id === openId) ?? null;

  const create = async () => {
    setCreating(true);
    const result = await createScriptAction({ couple_id: couple.id });
    setCreating(false);
    if (!result.ok) { toast(result.error); return; }
    await invalidate();
    setOpenId(result.data.id);
  };

  const run = async (action: Promise<{ ok: boolean; error?: string }>) => {
    const result = await action;
    if (!result.ok) toast(result.error ?? 'Something went wrong');
    await invalidate();
  };

  return (
    <CoupleTabShell
      title="Scripts"
      stats={scripts.length > 0 ? [{ label: tabStat(scripts.length, 'script') }] : undefined}
      actions={
        <Button onClick={create} loading={creating}>
          <Plus size={14} strokeWidth={1.5} /> New script
        </Button>
      }
    >
      {isLoading ? (
        <ScriptsSkeleton />
      ) : isError ? (
        <ErrorState title="Could not load scripts" description="Check your connection and try again." onRetry={() => refetch()} />
      ) : scripts.length === 0 ? (
        <CoupleTabEmpty
          icon={ScrollText}
          title="No scripts yet"
          description="Write the ceremony or reception script you'll read from on the day."
        />
      ) : (
        <CoupleScriptsList
          scripts={scripts}
          onOpen={setOpenId}
          onRename={(id, title) => run(updateScriptAction({ id, title }))}
          onDuplicate={(id) => run(duplicateScriptAction({ id }))}
          onDelete={(id) => run(deleteScriptAction({ id }))}
        />
      )}
      {open ? (
        <CoupleScriptModal key={open.id} script={open} onClose={() => setOpenId(null)} onSaved={invalidate} />
      ) : null}
    </CoupleTabShell>
  );
}
