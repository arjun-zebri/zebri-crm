'use client';

import { use, useState, type ReactNode } from 'react';

import { CloseIcon } from '@/components/ui-v2/icons';

import { Button } from './button';
import { DialogContext, ROOMY, type DialogSize } from './dialog-sizes';
import { DrawnCheck } from './drawn-check';
import { IconCircle, type IconCircleIcon } from './icon-circle';
import { Input } from './input';
import { Textarea } from './textarea';

/**
 * Design system v2 dialog parts (preview): the one anatomy every v2
 * dialog is built from, modelled on New client (the user's example of a
 * dialog done right, `pages/dashboard/clients/new-client-dialog.tsx`).
 *
 * - **No bars.** The header and footer are rows on the white, never
 *   bands with a rule under or over them.
 * - **Header** ({@link DialogHeader}): an `IconCircle` saying what the
 *   dialog makes or does, the title beside it in `type-label
 *   text-zebra-500` (quiet: the content is the subject, not the
 *   dialog's name), an optional `aside` ("Step 1 of 2"), and a ghost
 *   square Close (named "Close") at the top right. On a phone a large
 *   dialog fills the screen, so Close is the way out. Padding is
 *   {@link DIALOG_HEADER_PAD}, the same in every size.
 * - **Body** ({@link DialogBody}): scrolls; 24px padding (`p-6`), 40px
 *   (`sm:p-10`) in a large dialog (`lg`, `split`, `split-tall`, `xl`, `screen`).
 * - **Footer** ({@link DialogFooter}): the buttons at the right, 12px
 *   apart, the primary action last, 22px from the right and bottom
 *   ({@link DIALOG_FOOTER_PAD}) so it lines up under the X.
 * - **No Cancel on a form.** Escape, a click on the dimmed page and Close
 *   already leave; a Cancel beside Save only doubles them. A
 *   **confirmation** (something destructive or irreversible: Delete,
 *   Send now) is the exception: it has a `plain` Cancel before its
 *   primary or danger button, because the question deserves a "no".
 *
 * The parts read the enclosing `Dialog`'s size and `onClose` from
 * context, so the padding and the Close button need no wiring; pass
 * `onClose` only to override, `closable={false}` to drop Close (a step
 * that must finish).
 *
 * Also here: {@link DoneView}, the "done" view a dialog lands on after
 * sending or saving; {@link EmailStep}, the drafted email as the last
 * step of a send; and {@link useSend}, the preview's pretend wait.
 *
 * @example
 * ```tsx
 * <Dialog open={open} onClose={close} size="md" aria-labelledby="send-title">
 *   <DialogHeader id="send-title" icon={InvoiceIcon} title="Send invoice" aside="Step 1 of 2" />
 *   <DialogBody>…</DialogBody>
 *   <DialogFooter><Button onClick={send}>Send</Button></DialogFooter>
 * </Dialog>
 *
 * // A confirmation: a plain Cancel before the danger button.
 * <DialogFooter>
 *   <Button variant="plain" onClick={close}>Cancel</Button>
 *   <Button variant="danger" onClick={remove}>Delete client</Button>
 * </DialogFooter>
 * ```
 *
 * @module components/ui-v2/dialog-parts
 */

/**
 * The edge padding every dialog shares, Settings' (the gold standard,
 * user 2026-10-15). The header row is 12px top and bottom, the icon
 * circle 16px in and Close 12px in, so the X glyph lands 22px from the
 * top and right (10px of the ghost button's 36px around a 16px glyph).
 * The footer mirrors the glyph, not the hit area: its buttons sit 22px
 * from the right and bottom, so the last one's edge is under the X.
 */
export const DIALOG_HEADER_PAD = 'py-3 pl-4 pr-3';
/** See {@link DIALOG_HEADER_PAD}. */
export const DIALOG_FOOTER_PAD = 'px-5.5 pb-5.5';

/** The body padding for a part, from the dialog's size. */
function useRoomy(size: DialogSize | undefined): boolean {
  const context = use(DialogContext);
  return ROOMY.has(size ?? context?.size ?? 'sm');
}

export interface DialogHeaderProps {
  /** What the dialog's `aria-labelledby` points at. */
  id: string;
  /** What the dialog is; a field in its place when the thing open in it can be renamed there (an email template's name). */
  title: ReactNode;
  /** The glyph in the icon circle before the title. */
  icon?: IconCircleIcon | undefined;
  /**
   * Something in the circle's place (a couple's avatars once their names
   * are typed, as New client does). Wins over `icon`.
   */
  leading?: ReactNode;
  /** Quiet words or a control after the title ("Step 1 of 2"). */
  aside?: ReactNode;
  /**
   * The dialog's actions, on the header row just before Close: the primary
   * last, nearest Close (Send to Clara, Use for a couple, Nudge), any
   * secondary or ghost ones before it. Never on a row of their own under
   * the header (user, 2026-10-14: a button stacked under the X read as
   * clutter). The title truncates first when the row runs short.
   */
  actions?: ReactNode;
  /** @deprecated Use `aside`; kept so callers compile. */
  note?: string | undefined;
  /** Closes the dialog; the enclosing `Dialog`'s `onClose` when left out. */
  onClose?: (() => void) | undefined;
  /** False drops the Close button (a step that must be finished). */
  closable?: boolean | undefined;
  /** @deprecated The header's padding is the same in every size; kept so callers compile. */
  size?: DialogSize | undefined;
}

/** A dialog's header row. See {@link DialogHeaderProps}. */
export function DialogHeader({ id, title, icon, leading, aside, actions, note, onClose, closable = true }: DialogHeaderProps) {
  const context = use(DialogContext);
  const close = onClose ?? context?.onClose;
  const extra = aside ?? note;
  return (
    <header className={`flex shrink-0 items-center gap-2 ${DIALOG_HEADER_PAD}`}>
      {leading ?? (icon ? <IconCircle icon={icon} /> : null)}
      <h2 id={id} className="min-w-0 truncate type-label text-zebra-500">
        {title}
      </h2>
      {extra ? <div className="type-body text-zebra-400">{extra}</div> : null}
      <div className="ml-auto flex items-center gap-2">
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
        {close && closable ? (
          <Button variant="ghost" square aria-label="Close" onClick={close}>
            <CloseIcon aria-hidden="true" className="size-4" />
          </Button>
        ) : (
          // Keeps the row the Close button's height, so the body never moves up.
          <span aria-hidden="true" className="h-9" />
        )}
      </div>
    </header>
  );
}

/**
 * The scrolling middle of a dialog: 24px padding, 40px in a large one.
 * `underBar` is for a body under a header on a hairline (Settings' bar,
 * the paperwork's): it starts 12px down, level with a rail's first row,
 * since a 40px gap under a ruled bar read as a hole (user, 2026-10-15).
 */
export function DialogBody({ size, underBar = false, className, children }: { size?: DialogSize | undefined; underBar?: boolean | undefined; className?: string | undefined; children: ReactNode }) {
  const roomy = useRoomy(size);
  const pad = underBar ? `px-6 pb-6 pt-3 ${roomy ? 'sm:px-10 sm:pb-10' : ''}` : `p-6 ${roomy ? 'sm:p-10' : ''}`;
  return <div className={`min-h-0 flex-1 overflow-y-auto ${pad}${className ? ` ${className}` : ''}`}>{children}</div>;
}

/**
 * The buttons at the foot of a dialog: right-aligned, 12px apart, the
 * primary action last. No rule above it. A form has no Cancel; a
 * confirmation has a `plain` Cancel before its action.
 */
export function DialogFooter({ children }: { size?: DialogSize | undefined; children: ReactNode }) {
  return (
    <footer className={`flex shrink-0 items-center justify-end gap-3 ${DIALOG_FOOTER_PAD}`}>
      {children}
    </footer>
  );
}

/**
 * What a dialog shows once its job is done: a check that draws itself,
 * what happened, and what happens next. It fills the body, so the
 * dialog keeps its height.
 */
export function DoneView({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      role="status"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-pill bg-grass-100 text-grass-800">
        <DrawnCheck className="size-6" />
      </span>
      <p className="type-subheading text-zebra-950">{title}</p>
      <p className="max-w-sm text-balance type-body text-zebra-500">{detail}</p>
    </div>
  );
}

// Long enough to read as work happening, short enough not to wait on.
const SEND_MS = 700;

/** A pretend send: `busy` for a beat, then `then` runs. The preview sends nothing. */
export function useSend() {
  const [busy, setBusy] = useState(false);
  const send = (then: () => void) => {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      then();
    }, SEND_MS);
  };
  return { busy, send };
}

/** An email Zebri has written, as plain fields to edit. */
export interface Mail {
  subject: string;
  body: string;
}

export interface EmailStepProps {
  /** One line on what goes with it ("Deposit, $900 for Ella & Noah, with this email"). */
  intro: string;
  mail: Mail;
  onChange: (mail: Mail) => void;
  disabled: boolean;
}

/** The last step of a send: the drafted email, ready to edit. See {@link EmailStepProps}. */
export function EmailStep({ intro, mail, onChange, disabled }: EmailStepProps) {
  return (
    <div className="space-y-4">
      <p className="type-body text-zebra-500">{intro}</p>
      <Input
        label="Subject"
        value={mail.subject}
        onChange={(e) => onChange({ ...mail, subject: e.target.value })}
        disabled={disabled}
      />
      <Textarea
        label="Message"
        rows={10}
        value={mail.body}
        onChange={(e) => onChange({ ...mail, body: e.target.value })}
        disabled={disabled}
        data-autofocus
      />
    </div>
  );
}
