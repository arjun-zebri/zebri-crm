import type { Doc, DocStatus, FileType } from './profile-data';

/**
 * One document's row content, and the pieces the detail panel reuses: a
 * tile saying what kind of file it is, the title over who it went to or
 * what it is for, where it stands (a dot and a word) and its date. On
 * phones the date gives way so the title keeps its room.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/doc-row
 */

// A tint per file type, so a PDF and an invoice tell apart before reading.
const TILE: Record<FileType, string> = {
  PDF: 'bg-danger/10 text-danger',
  INV: 'bg-grass-50 text-grass-700',
  FORM: 'bg-info/10 text-info',
  XLS: 'bg-grass-100 text-grass-800',
};

// Waiting on someone is the only amber; set to go out reads green; done
// keeps its words dark with only the dot green, so a long finished list
// stays calm; something received is grey.
const STATUS: Record<DocStatus, { dot: string; text: string }> = {
  waiting: {
    dot: 'bg-warning',
    text: 'text-warning-ink',
  },
  scheduled: { dot: 'bg-grass-500', text: 'text-grass-700' },
  done: { dot: 'bg-grass-500', text: 'text-zebra-950' },
  received: { dot: 'bg-zebra-300', text: 'text-zebra-400' },
};

/** The row's content, inside a {@link SelectRow}. */
export function DocRow({ doc: d }: { doc: Doc }) {
  return (
    <>
      <FileTile type={d.type} />
      <span className="min-w-0 flex-1 self-center type-body">
        <span className="block truncate text-zebra-950">{d.title}</span>
        <span className="block truncate text-zebra-500">{d.sub}</span>
      </span>
      <span className="flex shrink-0 items-center gap-6 self-center">
        <StatusText status={d.status} state={d.state} />
        <span className="hidden w-12 text-right type-body tabular-nums text-zebra-400 sm:block">
          {d.date}
        </span>
      </span>
    </>
  );
}

/** A file type's tile: a tinted square with the type in small capitals at its foot. */
export function FileTile({ type }: { type: FileType }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-10 shrink-0 items-end justify-center rounded-button pb-1.5 ${TILE[type]}`}
    >
      {/* Below the type scale on purpose: a label on a 40px tile, not text to read. */}
      <span className="text-[0.625rem] font-semibold leading-none tracking-wider">{type}</span>
    </span>
  );
}

/** Where a document stands, as a coloured dot and a word. */
export function StatusText({ status, state }: { status: DocStatus; state: string }) {
  const tone = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-2 type-body ${tone.text}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-pill ${tone.dot}`} />
      {state}
    </span>
  );
}
