import { StretchedButton } from '@/components/ui-v2/stretched-button';

import { ROW } from '../../payments/invoice-row';
import { SOURCE_NAMES, fillFields, pct, type EmailTemplate } from '../email-data';

/**
 * One template row: the name over its subject (fields filled with sample
 * values), how it was made and how many workflows send it, then four
 * figures in fixed columns from `lg`: times sent and the open, click and
 * reply rates. Reply rate is the one that matters most for an MC (a
 * reply is a conversation), so it is the darkest. Clicking anywhere
 * opens the template. On phones the figures fold into one line.
 *
 * @module app/design-system/v2/pages/dashboard/email/templates/template-row
 */

/** The row's grid from `lg`, shared with the column headings. */
export const TEMPLATE_COLUMNS = 'lg:grid-cols-[minmax(0,1fr)_5rem_5rem_5rem_5rem]';

const rate = (n: number, sent: number) => {
  const p = pct(n, sent);
  return p === null ? 'None' : `${p}%`;
};

const usedIn = (n: number) => (n === 0 ? 'Not in a workflow' : `Used in ${n} workflow${n === 1 ? '' : 's'}`);

/** A template row. */
export function TemplateRow({ template: t, onOpen }: { template: EmailTemplate; onOpen: () => void }) {
  return (
    <li>
      <div className={`${ROW} grid-cols-[minmax(0,1fr)] items-center ${TEMPLATE_COLUMNS}`}>
        <StretchedButton label={`Open template ${t.name}`} onClick={onOpen}>
          <span className="block truncate type-label text-zebra-950">{t.name}</span>
          <span className="block truncate type-body text-zebra-500">
            {fillFields(t.subject)} · {SOURCE_NAMES[t.source]} · {usedIn(t.usedIn.length)}
          </span>
        </StretchedButton>
        <span className="hidden text-right type-body tabular-nums text-zebra-700 lg:block">{t.sent}</span>
        <span className="hidden text-right type-body tabular-nums text-zebra-700 lg:block">{rate(t.opened, t.sent)}</span>
        <span className="hidden text-right type-body tabular-nums text-zebra-700 lg:block">{rate(t.clicked, t.sent)}</span>
        <span className="hidden text-right type-label tabular-nums text-zebra-950 lg:block">{rate(t.replied, t.sent)}</span>
        <span className="type-body tabular-nums text-zebra-500 lg:hidden">
          Sent {t.sent} · {rate(t.opened, t.sent)} opened · {rate(t.clicked, t.sent)} clicked · {rate(t.replied, t.sent)} replied
        </span>
      </div>
    </li>
  );
}

/** The quiet column headings over the rows, from `lg`. */
export function TemplateColumns() {
  return (
    <div aria-hidden="true" className={`hidden gap-x-10 px-3 pb-1 type-body text-zebra-500 lg:grid ${TEMPLATE_COLUMNS}`}>
      <span>Template</span>
      <span className="text-right">Sent</span>
      <span className="text-right">Opened</span>
      <span className="text-right">Clicked</span>
      <span className="text-right">Replied</span>
    </div>
  );
}
