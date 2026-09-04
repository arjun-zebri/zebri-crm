/**
 * Readonly monospace value with a copy button; the Lead Capture section's
 * snippet row.
 *
 * @module app/(dashboard)/settings/lead-capture/copy-field
 */
import { Info } from 'lucide-react';

import { CopyButton } from '@/components/ui/copy-button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';

export interface CopyFieldProps {
  label: string;
  value: string;
  /**
   * What this value is for, on hover. These rows look alike and the page has
   * five of them, so the difference between them has to be available without
   * costing five more lines of grey text.
   */
  tooltip?: string;
}

export function CopyField({ label, value, tooltip }: CopyFieldProps) {
  return (
    <div>
      {/* The label is rendered here rather than passed to `Input` so the
          monospace treatment applies to the snippet only, not the label. */}
      <div className="mb-1 flex items-center gap-1.5">
        <p className="text-body font-medium text-text">{label}</p>
        {tooltip ? (
          <Tooltip label={tooltip} side="top" multiline>
            <Info size={12} strokeWidth={1.5} className="text-text-subtle cursor-help" />
          </Tooltip>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Input
          aria-label={label}
          readOnly
          value={value}
          className="min-w-0 flex-1 font-mono"
        />
        <CopyButton value={value} aria-label={`Copy ${label}`} className="shrink-0" />
      </div>
    </div>
  );
}
