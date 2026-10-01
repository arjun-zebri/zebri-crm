import { X } from 'lucide-react';

import { Button } from '@/components/ui-v2/button';
import { Panel } from '@/components/ui-v2/panel';

/**
 * The one line a workflow Zebri just built opens with: what to check
 * before turning it on. Dismissed for good once read.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/built-note
 */
export function BuiltNote({ emails, onDismiss }: { emails: number; onDismiss: () => void }) {
  return (
    <Panel tone="highlight" className="mt-5 flex items-center gap-3 py-2 pl-4 pr-2">
      <p className="min-w-0 flex-1 type-body text-zebra-950">
        Zebri built this from what you wrote. {emails ? `Read the ${emails === 1 ? 'email' : `${emails} emails`}, then turn it on.` : 'Check the steps, then turn it on.'}
      </p>
      <Button variant="ghost" square aria-label="Dismiss" onClick={onDismiss}>
        <X aria-hidden="true" strokeWidth={1.5} className="size-4" />
      </Button>
    </Panel>
  );
}
