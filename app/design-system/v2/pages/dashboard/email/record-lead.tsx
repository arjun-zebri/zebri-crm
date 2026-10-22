import type { ReactNode } from 'react';

/**
 * The top of an Email record dialog (a template, a campaign, a suggested
 * send, a list, the signatures), under its `DialogHeader`: the record's
 * name as the dialog's big content (`type-title`, as New client's name
 * sits under its header), and a quiet line or two about it. The
 * record's actions go on the `DialogHeader` row (its `actions`), never here.
 * No rule under it: the content below starts after a gap.
 *
 * @module app/design-system/v2/pages/dashboard/email/record-lead
 */

export interface RecordLeadProps {
  /** What the dialog's `aria-labelledby` points at. */
  id: string;
  name: string;
  /** The lines under the name. */
  children?: ReactNode;
  /** A large dialog (`lg`, `xl`): the 40px sides the dialog parts use. */
  roomy?: boolean | undefined;
}

/** The lead. See {@link RecordLeadProps}. */
export function RecordLead({ id, name, children, roomy = false }: RecordLeadProps) {
  return (
    <div className={`shrink-0 space-y-1 px-6 pt-2 pb-6 ${roomy ? 'sm:px-10' : ''}`}>
      <h3 id={id} className="type-title text-zebra-950">
        {name}
      </h3>
      {children}
    </div>
  );
}
