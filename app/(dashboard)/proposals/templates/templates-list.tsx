'use client';

/**
 * Templates tab body (Phase 1): the account's named proposal templates
 * with create / rename / set default / delete. Ensures the default exists
 * on first visit (which is also the lazy v1 → v2 migration). Open is
 * disabled until the section editor ships (Phase 2).
 *
 * @module app/(dashboard)/proposals/templates/templates-list
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import {
  createTemplateAction, deleteTemplateAction, ensureDefaultTemplateAction, listTemplatesAction,
  renameTemplateAction, setDefaultTemplateAction, type TemplateSummary,
} from '@/features/proposals';

import { ProposalsNav } from '../proposals-nav';

import { TemplateRow } from './template-row';

const KEY = ['proposal-templates'] as const;

/** The Templates tab: list, create, rename, set-default and delete for the account's proposal templates. */
export function TemplatesList() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<TemplateSummary | null>(null);

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      // First visit creates (or migrates) the default; every visit lists.
      const ensured = await ensureDefaultTemplateAction();
      if (!ensured.ok) throw new Error(ensured.error);
      const listed = await listTemplatesAction();
      if (!listed.ok) throw new Error(listed.error);
      return listed.templates;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const fail = (error: string) => toast(error, 'error');
  // A rejected server action resolves with `{ ok: false, error }` (handled by
  // each mutation's onSuccess below) and never throws, but the action itself
  // can still throw (a network failure, an unexpected exception); that
  // rejection must surface too, or it fails completely silently.
  const failFromError = (e: unknown) => fail(e instanceof Error ? e.message : 'Something went wrong');

  const create = useMutation({
    mutationFn: () => createTemplateAction({ name: 'Untitled template', role: 'mc' }),
    onSuccess: (r) => (r.ok ? refresh() : fail(r.error)),
    onError: failFromError,
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => setDefaultTemplateAction({ id }),
    onSuccess: (r) => (r.ok ? refresh() : fail(r.error)),
    onError: failFromError,
  });
  // Not a `useMutation`: `TemplateRow` needs the outcome back synchronously
  // (as a resolved `Promise<boolean>`) to decide whether to revert its own
  // optimistic display: a mutation's fire-and-forget `.mutate()` has no way
  // to hand that answer back to the caller. `renameTemplate` owns both the
  // action call and the refetch, either way, then reports true/false.
  const renameTemplate = async (id: string, name: string): Promise<boolean> => {
    try {
      const r = await renameTemplateAction({ id, name });
      if (!r.ok) {
        fail(r.error);
        await refresh();
        return false;
      }
      await refresh();
      return true;
    } catch (e) {
      failFromError(e);
      return false;
    }
  };
  const remove = useMutation({
    mutationFn: (id: string) => deleteTemplateAction({ id }),
    onSuccess: (r) => {
      setPendingDelete(null);
      if (r.ok) refresh();
      else fail(r.error);
    },
    onError: (e) => {
      setPendingDelete(null);
      failFromError(e);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposals"
        {...(query.data ? { count: query.data.length } : {})}
        actions={
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            <Plus size={16} strokeWidth={1.5} className="mr-1.5" aria-hidden="true" />
            New template
          </Button>
        }
      />
      <ProposalsNav active="templates" />
      {query.isLoading ? (
        <Loading label="Loading templates" />
      ) : query.error ? (
        <ErrorState title="Could not load templates" error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data?.length ? (
        <Empty icon={FileText} title="No templates yet" description="Your first template is created the moment you open this tab." />
      ) : (
        <ul className="divide-y divide-border rounded-control border border-border bg-card">
          {query.data.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              canDelete={!t.isDefault && query.data.length > 1}
              onRename={(name) => renameTemplate(t.id, name)}
              onSetDefault={() => setDefault.mutate(t.id)}
              onDelete={() => setPendingDelete(t)}
            />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        description="Proposals already created from it keep their own copy."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
