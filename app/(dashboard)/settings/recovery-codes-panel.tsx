/**
 * The one-time display of freshly issued recovery codes.
 *
 * Shown straight after enrolment and after "New recovery codes". The
 * plain codes exist only in this component's props: the server keeps
 * hashes, so once this closes nobody, Zebri included, can show them again.
 *
 * @module app/(dashboard)/settings/recovery-codes-panel
 */
'use client';

import { Callout } from '@/components/ui/callout';
import { CopyButton } from '@/components/ui/copy-button';

export interface RecoveryCodesPanelProps {
  /** The plain codes, as returned by `issueRecoveryCodesAction`. */
  codes: string[];
}

/** Recovery codes with a copy-all button. See {@link RecoveryCodesPanelProps}. */
export function RecoveryCodesPanel({ codes }: RecoveryCodesPanelProps) {
  return (
    <div className="space-y-4">
      <Callout tone="warning">
        Save these somewhere safe, away from your phone. Each code works once. This is the only
        time we can show them.
      </Callout>
      <ul
        aria-label="Recovery codes"
        className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-control border border-border bg-surface-muted px-4 py-3"
      >
        {codes.map((code) => (
          <li key={code} className="font-mono text-body text-text">
            {code}
          </li>
        ))}
      </ul>
      <CopyButton value={codes.join('\n')} label="Copy codes" />
    </div>
  );
}
