'use client';

/**
 * What the workflow engine has done for this couple.
 *
 * The audit feed the couple's Automations tab used to be, folded into
 * the Workflow tab and collapsed by default so the checklist stays the
 * point of the page.
 *
 * @module app/(dashboard)/couples/workflow-activity
 */

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Loading } from '@/components/ui/loading';
import { createClient } from '@/lib/supabase/client';
import { narrateWorkflowEvent } from '@/lib/workflows/narrate';

export interface WorkflowActivityProps {
  coupleId: string;
}

/** Collapsed audit feed. See {@link WorkflowActivityProps}. */
export function WorkflowActivity({ coupleId }: WorkflowActivityProps) {
  const [open, setOpen] = useState(false);

  const query = useQuery({
    enabled: open,
    queryKey: ['workflow-activity', coupleId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workflow_audit_log')
        // The step's title is joined rather than read out of `detail`:
        // it works for rows written before the feed said anything useful,
        // and it survives a step being renamed.
        .select(
          'id, event, detail, created_at, workflow_steps(title), workflow_instances(name)',
        )
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <section className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-body text-text-muted hover:text-text"
      >
        {open ? (
          <ChevronDown size={16} strokeWidth={1.5} />
        ) : (
          <ChevronRight size={16} strokeWidth={1.5} />
        )}
        Activity
      </button>

      {open ? (
        query.isLoading ? (
          <Loading label="Loading activity" variant="inline" />
        ) : (query.data ?? []).length === 0 ? (
          <p className="text-body text-text-muted">Nothing has run yet.</p>
        ) : (
          <ul className="space-y-1">
            {(query.data ?? []).map((row) => (
              <li key={row.id} className="flex items-baseline gap-2 text-body">
                <span className="shrink-0 text-text-subtle">
                  {new Date(row.created_at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <span className="text-text-muted">
                  {narrateWorkflowEvent(row.event, row.detail, {
                    stepTitle: row.workflow_steps?.title ?? null,
                    instanceName: row.workflow_instances?.name ?? null,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
