/**
 * A monospace block for the docs page with an optional copy button. Same
 * surface treatment as the /design-system showroom's code panel.
 *
 * @module app/docs/lead-capture-api/_components/code-block
 */
import { CopyButton } from '@/components/ui/copy-button';

export function CodeBlock({ code, copyLabel }: { code: string; copyLabel?: string }) {
  return (
    <div className="space-y-2">
      <pre className="overflow-x-auto rounded-control border border-border bg-surface-muted px-3 py-2 text-body leading-relaxed text-text font-mono whitespace-pre">
        {code}
      </pre>
      {copyLabel && <CopyButton value={code} label={copyLabel} copiedLabel="Copied" />}
    </div>
  );
}
