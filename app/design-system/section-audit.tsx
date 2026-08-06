import auditData from './audit-data.json';
import { Section } from './showroom';

/**
 * Audit summary: every scanned group's token-vs-legacy split in one
 * table, as a fix-order worksheet.
 *
 * Numbers come from `audit-data.json`. Refresh with
 * `node scripts/design-system-audit.mjs`.
 *
 * @module app/design-system/section-audit
 */

interface AuditEntry {
  label: string;
  verdict: 'token' | 'legacy';
  count: number;
}

interface AuditGroup {
  id: string;
  title: string;
  note: string;
  entries: AuditEntry[];
}

const GROUPS = auditData.groups as AuditGroup[];

/** Sum the counts on one side of a group. */
function total(g: AuditGroup, verdict: 'token' | 'legacy') {
  return g.entries.filter((e) => e.verdict === verdict).reduce((n, e) => n + e.count, 0);
}

/** Whole-app scoreboard, ordered by how much legacy usage each group carries. */
export function SectionAudit() {
  const rows = GROUPS.map((g) => {
    const legacy = total(g, 'legacy');
    const token = total(g, 'token');
    const sum = legacy + token;
    return { g, legacy, token, pct: sum === 0 ? 0 : Math.round((token / sum) * 100) };
  }).sort((a, b) => b.legacy - a.legacy);

  return (
    <Section
      id="audit"
      title="Audit summary"
      description="Every scanned group, ordered by how much off-system usage it carries. Adoption is the share of uses already on the token or primitive."
    >
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[36rem] text-body">
          <thead className="bg-surface-muted text-caption text-text-muted">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Group</th>
              <th className="px-4 py-2 font-medium">On system</th>
              <th className="px-4 py-2 font-medium">Off system</th>
              <th className="px-4 py-2 font-medium">Adoption</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ g, legacy, token, pct }) => (
              <tr key={g.id}>
                <td className="px-4 py-3">
                  <a href={`#${g.id}`} className="font-medium text-text hover:underline">
                    {g.title}
                  </a>
                  <p className="text-caption text-text-muted">{g.note}</p>
                </td>
                <td className="px-4 py-3 tabular-nums text-success">{token}</td>
                <td className="px-4 py-3 tabular-nums text-text">{legacy}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-1.5 w-20 overflow-hidden rounded-pill bg-border">
                      <span className="bg-success" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-caption tabular-nums text-text-muted">{pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-border bg-surface-muted p-5">
        <h3 className="text-body font-semibold text-text">Suggested order</h3>
        <ol className="mt-2 space-y-2 text-caption text-text-muted">
          <li>
            <span className="font-medium text-text">1. Free renames.</span>{' '}
            <code>rounded-xl</code> to <code>rounded-card</code> and <code>rounded-md</code> to{' '}
            <code>rounded-control</code> are pixel-identical swaps that clear most of the radius
            debt with zero visual risk.
          </li>
          <li>
            <span className="font-medium text-text">2. The four grey aliases.</span>{' '}
            <code>text-gray-900</code>, <code>text-gray-500</code>, <code>text-gray-400</code> and{' '}
            <code>border-gray-200</code> map exactly onto tokens and cover about half the colour
            debt.
          </li>
          <li>
            <span className="font-medium text-text line-through">3. Fix the real bugs.</span>{' '}
            Done. Escape, body-scroll locking and backdrop dismissal now come from one shared{' '}
            <code>useOverlay()</code> hook, and ConfirmDialog has its own stacking tier so the{' '}
            <code>z-[80]</code> collision is gone.
          </li>
          <li>
            <span className="font-medium text-text">4. Consolidate the chips.</span> Four status-chip
            implementations exist (Badge, StatePill, StatBadge, the vendor badges). Pick StatePill
            and give it a vendor-colour path.
          </li>
          <li>
            <span className="font-medium text-text">5. Extract the missing primitives.</span>{' '}
            <code>PageHeader</code>, <code>Card</code>, <code>SectionNav</code> and{' '}
            <code>DataTable</code> would each collapse a whole column of this table.
          </li>
          <li>
            <span className="font-medium text-text">6. Reconcile the docs.</span> The radius table,
            the missing ThemeToggle and the dark-mode section in{' '}
            <code>frontend-design.md</code> all describe code that does not exist.
          </li>
        </ol>
      </div>
    </Section>
  );
}
