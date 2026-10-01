import { Loader2, Video } from 'lucide-react';

import type { Call, Verdict } from './calls-data';
import { StatusText } from './doc-row';

/**
 * One call's row content on the Calls list: a camera tile, the call's
 * name over when and how long, and where its notes stand. While Zebri is
 * still writing them the row says so with a spinner; after that, amber
 * while suggested updates wait on the MC, and a green dot once they are
 * all dealt with.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/call-row
 */

export interface CallRowProps {
  call: Call;
  decisions: Record<string, Verdict>;
}

/** The row's content. See {@link CallRowProps}. */
export function CallRow({ call, decisions }: CallRowProps) {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-button bg-zebra-100 text-zebra-600"
      >
        <Video strokeWidth={1.5} className="size-4" />
      </span>
      <span className="min-w-0 flex-1 self-center type-body">
        <span className="block truncate text-zebra-950">{call.title}</span>
        <span className="block truncate text-zebra-500">
          {[call.when, call.length].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="shrink-0 self-center">
        <CallState call={call} decisions={decisions} />
      </span>
    </>
  );
}

function CallState({ call, decisions }: CallRowProps) {
  if (call.status === 'upcoming') return null;
  if (call.status === 'processing')
    return (
      <span className="inline-flex items-center gap-2 type-body text-zebra-500">
        <Loader2 aria-hidden="true" strokeWidth={1.5} className="size-3.5 animate-spin motion-reduce:animate-none" />
        Writing notes
      </span>
    );
  const open = (call.notes?.updates ?? []).filter((u) => !u.decided && !decisions[u.id]).length;
  return open ? (
    <StatusText status="waiting" state={`${open} ${open === 1 ? 'update' : 'updates'} to review`} />
  ) : (
    <StatusText status="done" state="Notes ready" />
  );
}
