import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

import auditData from './audit-data.json';

/**
 * The inline "these two things disagree" callout.
 *
 * Rendered next to the component it affects rather than collected in a
 * separate audit appendix, so a divergence is visible at the moment you
 * are looking at the thing that diverges.
 *
 * @module app/design-system/conflict
 */

/** One counted variant from the audit scan. */
interface AuditEntry {
  label: string;
  verdict: 'token' | 'legacy';
  count: number;
  files: { path: string; hits: number }[];
}

interface AuditGroup {
  id: string;
  title: string;
  note: string;
  entries: AuditEntry[];
}

const GROUPS = auditData.groups as AuditGroup[];

/** Look up a scanned group by id. Returns `undefined` if the scan lacks it. */
export function auditGroup(id: string): AuditGroup | undefined {
  return GROUPS.find((g) => g.id === id);
}

/** Scanned-file count, surfaced by the audit summary. */
export const SCANNED_FILES = auditData.scannedFiles as number;

/** Most-used raw palette utilities, for the colour conflict. */
export const TOP_PALETTE = auditData.topPaletteClasses as { label: string; count: number }[];

export interface ConflictProps {
  /** Short statement of the divergence. */
  title: string;
  /** Optional audit group id. When set, the usage table renders from the scan. */
  group?: string;
  /** What should win, and why. */
  recommendation: ReactNode;
  /** Live side-by-side specimens of the competing variants. */
  children?: ReactNode;
}

/**
 * Renders a conflict: the live specimens, the real usage counts from the
 * last audit scan, and a recommendation.
 *
 * Counts come from `audit-data.json`. Re-run
 * `node scripts/design-system-audit.mjs` to refresh them.
 */
export function Conflict({ title, group, recommendation, children }: ConflictProps) {
  const data = group ? auditGroup(group) : undefined;
  return (
    <div className="rounded-control border border-warning/40 bg-warning/5 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 shrink-0 text-warning"
          width={16}
          height={16}
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <h4 className="text-body font-semibold text-text">{title}</h4>
          {children}
          {data ? <UsageTable entries={data.entries} /> : null}
          <p className="text-caption text-text-muted">
            <span className="font-medium text-text">Recommendation: </span>
            {recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Usage counts per variant, heaviest first, with example files. */
function UsageTable({ entries }: { entries: AuditEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  const max = Math.max(...sorted.map((e) => e.count), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] text-caption">
        <thead>
          <tr className="text-left text-text-subtle">
            <th className="pb-1 font-medium">Variant</th>
            <th className="pb-1 font-medium">Uses</th>
            <th className="pb-1 font-medium">Share</th>
            <th className="pb-1 font-medium">Heaviest file</th>
          </tr>
        </thead>
        <tbody className="text-text-muted">
          {sorted.map((e) => (
            <tr key={e.label} className="border-t border-border/60">
              <td className="py-1 pr-3 whitespace-nowrap">
                <code className={e.verdict === 'token' ? 'text-success' : 'text-text'}>
                  {e.label}
                </code>
              </td>
              <td className="py-1 pr-3 tabular-nums">{e.count}</td>
              <td className="py-1 pr-3">
                <span className="flex h-1.5 w-24 overflow-hidden rounded-pill bg-border">
                  <span
                    className={e.verdict === 'token' ? 'bg-success' : 'bg-warning'}
                    style={{ width: `${Math.round((e.count / max) * 100)}%` }}
                  />
                </span>
              </td>
              <td className="py-1 truncate text-text-subtle">
                {e.files[0] ? `${e.files[0].path} (${e.files[0].hits})` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
