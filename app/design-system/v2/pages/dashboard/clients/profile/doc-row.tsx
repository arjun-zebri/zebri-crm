import type { ReactNode } from 'react';

import { Badge, type BadgeTone } from '@/components/ui-v2/badge';
import { ROW } from '@/components/ui-v2/control-styles';
import { BdmIcon, CeremonyScriptIcon, ContractIcon, DocumentsIcon, InvoiceIcon, ProposalIcon, QuestionnaireIcon, RunSheetIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { StretchedButton } from '@/components/ui-v2/stretched-button';

import type { Doc, DocStatus, FileType } from './profile-data';

/**
 * One document as one line (user, 2026-10-15: "we should be able to get
 * all that info in the same line"): its glyph, its title with what
 * matters about it quiet beside, its date folded in ("$1,450 · 29 Sep"),
 * then one cluster at the right edge: the next step as a quiet text
 * button when there is one (Send to couple, Remind) and where it stands
 * as a `Badge`. No fixed columns: a date column empty on most rows left
 * the badges floating mid-row and the action stranded at the far edge
 * (user, 2026-10-15). Every row is the same height. A document with its own editor
 * (run sheet, script, questionnaire, paperwork) opens it from the row;
 * the panel that used to open under the row only repeated it. One
 * without (an invoice, a shared file) still opens its details under
 * itself. On phones the detail and date give way so the title keeps its
 * room.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/doc-row
 */

// Waiting on someone is the only amber; set to go out, or done, is green;
// something received, or a draft only the MC has seen, is grey.
const STATUS: Record<DocStatus, BadgeTone> = {
  waiting: 'warning',
  scheduled: 'grass',
  done: 'grass',
  received: 'neutral',
  draft: 'neutral',
};

/** Each kind of document's glyph on its row; a PDF is a proposal or a contract, told by its title. */
const ICON: Record<FileType | 'PROPOSAL', ZebriIcon> = {
  PROPOSAL: ProposalIcon,
  PDF: ContractIcon,
  INV: InvoiceIcon,
  FORM: QuestionnaireIcon,
  XLS: DocumentsIcon,
  RUN: RunSheetIcon,
  SCR: CeremonyScriptIcon,
  BDM: BdmIcon,
};

const iconKey = (d: Doc) => (d.type === 'PDF' && /proposal/i.test(d.title) ? 'PROPOSAL' : d.type);

export interface DocRowProps {
  doc: Doc;
  /** Opens the document, or its details under the row. */
  onOpen: () => void;
  /** The next step, a `text` button just before the badge, above the row's hit area (Send to couple). */
  action?: ReactNode;
  /** Its details are open under the row: the row rests on the pressed fill. */
  open?: boolean | undefined;
  /** What opens under the row, for a document with no editor of its own. */
  detail?: ReactNode;
}

/** A document's row. Put it in a `<ul className="-mx-3">` so its fill overhangs the text edge. See {@link DocRowProps}. */
export function DocRow({ doc: d, onOpen, action, open = false, detail }: DocRowProps) {
  const Icon = ICON[iconKey(d)];
  // A detail that only repeats the badge goes: "Not started" beside To
  // start, "Not sent yet" beside Not sent.
  const own = d.state === 'To start' || d.sub.toLowerCase().startsWith(d.state.toLowerCase()) ? '' : d.sub;
  // The date joins the detail, unless the detail already says it ("Sent 15 Oct").
  const sub = [own, d.date && !own.includes(d.date) ? d.date : ''].filter(Boolean).join(' · ');
  return (
    <li>
      <div className={`relative flex items-center gap-4 rounded-button px-3 py-1.5 ${open ? 'bg-pressed' : ROW}`}>
        <Icon aria-hidden="true" className="size-4 shrink-0 text-zebra-500" />
        <div className="min-w-0 flex-1">
          <StretchedButton label={`Open ${d.title}`} onClick={onOpen}>
            <span className="flex min-w-0 items-baseline gap-3 type-body">
              {/* The detail takes what the title leaves, so it truncates first. */}
              <span className="truncate text-zebra-950">{d.title}</span>
              {sub ? <span className="hidden min-w-0 flex-1 truncate text-zebra-500 sm:block">{sub}</span> : null}
            </span>
          </StretchedButton>
        </div>
        {/* h-9, a button's height, on every row, so a row with an action is no taller. */}
        <span className="flex h-9 shrink-0 items-center gap-3">
          {action ? <span className="relative z-10">{action}</span> : null}
          <StatusText status={d.status} state={d.state} />
        </span>
      </div>
      {open && detail ? <div className="px-3 pb-6 pt-4">{detail}</div> : null}
    </li>
  );
}

/** Where a document stands: a `Badge` with its status dot, the one way v2 shows a status. */
export function StatusText({ status, state }: { status: DocStatus; state: string }) {
  return (
    <Badge dot tone={STATUS[status]}>
      {state}
    </Badge>
  );
}
