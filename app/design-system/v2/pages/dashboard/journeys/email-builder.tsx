'use client';

import { useMemo, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { EditIcon, EmailIcon, EyeIcon, SentIcon } from '@/components/ui-v2/icons';
import { InlineInput } from '@/components/ui-v2/inline-input';

import { brandVars } from '../../onboarding/brand-doc-parts';
import { useAccount } from '../account';
import { useBrandKit } from '../brand/brand-provider';
import { GlobalStylingButton } from '../brand/global-styling-button';
import { emailHeaderOf } from '../brand/kit';
import type { EmailTemplate } from '../documents/email-templates';
import type { EmailHeader, SignatureId } from '../email/email-data';
import { BRAND } from '../proposals/templates-data';

import { EmailBubble } from './email-editor/email-bubble';
import { docToLine, lineToDoc } from './email-editor/email-doc';
import {
  EmailEditorBody,
  SubjectEditorLine,
  useEmailEditor,
  useSubjectEditor,
} from './email-editor/email-editor';
import { EmailSignature } from './email-editor/email-signature';
import { HeaderPicker } from './email-editor/header-picker';
import { TemplateMenu } from './email-editor/template-menu';
import { InboxPreview, START_VIEW } from './inbox-preview';
import { docOf } from './step-email';
import type { StepEmail } from './step-settings';

/**
 * Building one of a journey's emails, the way production's proposals are
 * built (founder, 2026-10-08): the email itself is the editor, and the
 * only place it is edited (founder, 2026-10-21: no separate Design
 * canvas, as a contract and an invoice have none). Built from the dialog
 * parts: the header is what the email is, with Close. Then the header
 * lines named on the left (To the client with Cc and Bcc on demand,
 * Subject, Preview text), and the card in the look Global styling sets:
 * the header (the logo, or the business name; click it to change), the
 * body to write in (`/` for a section, `@` for a field, each field shown
 * by its name, a bar over selected text), and the signature, written in
 * place (`EmailSignature`). It opens on Zebri's draft for
 * what the email is for. The foot holds Global styling (the one look
 * every email and document wears), Preview (the email as the client
 * gets it, the sample couple's values filled in, on a computer or a
 * phone), Back to Zebri's draft (once changed), Send test and Save; no
 * Cancel: Close or Escape leaves it as it was. Documents opens it on an
 * email template too; a journey's email gets Use a template, to start
 * from one of those.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/email-builder
 */

export interface EmailBuilderProps {
  /** What the email is, top left: "Enquiry reply", "Reminder · 3 days". */
  purpose: string;
  /** Makes `purpose` a field to rename it in (an email template's name), handed to `onSave`. */
  renamable?: boolean | undefined;
  value: StepEmail;
  /** Zebri's draft for what it is for. */
  draft: StepEmail;
  /** What a drafted email asks them to do, as its closing button. */
  button?: string | null | undefined;
  /** The MC's email templates, offered as Use a template; left out in Documents, where one is being written. */
  templates?: EmailTemplate[] | undefined;
  /** The way back to `draft`, once changed; "Back to Zebri's draft" when unset. */
  resetLabel?: string | undefined;
  /** Saves it; undefined when it is Zebri's draft again, so the draft keeps following the step's settings. */
  /** `name` is the renamed `purpose`, when `renamable`. */
  onSave: (email: StepEmail | undefined, name: string) => void;
  onClose: () => void;
}

/** A header line: its name on the left in a fixed column, the value beside it. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-4 type-body">
      <span className="w-24 shrink-0 text-zebra-500">{label}</span>
      {children}
    </div>
  );
}

/** The builder. Mounted per opening, so each starts from `value`. See {@link EmailBuilderProps}. */
export function EmailBuilder({
  purpose,
  renamable = false,
  value,
  draft,
  button,
  templates,
  resetLabel,
  onSave,
  onClose,
}: EmailBuilderProps) {
  const { brand, business } = useAccount();
  const { kit } = useBrandKit();
  // Worked out once per opening: the editors take them as their first content only.
  const start = useMemo(
    () => ({ subject: lineToDoc(value.subject), doc: docOf(value, button) }),
    [value, button],
  );
  const fresh = useMemo(
    () => ({ subject: lineToDoc(draft.subject), doc: docOf(draft, button) }),
    [draft, button],
  );
  const [subject, setSubject] = useState(start.subject);
  const [doc, setDoc] = useState(start.doc);
  const [preheader, setPreheader] = useState(value.preheader ?? '');
  const [cc, setCc] = useState(value.cc ?? '');
  const [bcc, setBcc] = useState(value.bcc ?? '');
  const [sign, setSign] = useState<{ signature: SignatureId; signOff: string }>({
    signature: value.signature ?? 'full',
    signOff: value.signOff ?? 'Warmly,',
  });
  // Null follows Global styling's header (the logo once there is one), until changed for this email.
  const [header, setHeader] = useState<EmailHeader | null>(value.header ?? null);
  const [copies, setCopies] = useState({ cc: Boolean(value.cc), bcc: Boolean(value.bcc) });
  const [previewing, setPreviewing] = useState(false);
  const [view, setView] = useState(START_VIEW);
  const [tested, setTested] = useState(false);
  const [name, setName] = useState(purpose);
  const subjectEditor = useSubjectEditor(start.subject, setSubject);
  const editor = useEmailEditor(start.doc, setDoc);
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const changed =
    !same(subject, fresh.subject) ||
    !same(doc, fresh.doc) ||
    Boolean(preheader.trim() || cc.trim() || bcc.trim()) ||
    sign.signature !== 'full' ||
    sign.signOff !== 'Warmly,' ||
    header !== null;
  const reset = () => {
    subjectEditor?.commands.setContent(fresh.subject);
    editor?.commands.setContent(fresh.doc);
    setSubject(fresh.subject);
    setDoc(fresh.doc);
    setPreheader('');
    setSign({ signature: 'full', signOff: 'Warmly,' });
    setHeader(null);
  };
  // A template replaces the words; the header, signature and copies stay as set here.
  const pickTemplate = (t: EmailTemplate) => {
    const next = { subject: lineToDoc(t.email.subject), doc: docOf(t.email, t.button) };
    subjectEditor?.commands.setContent(next.subject);
    editor?.commands.setContent(next.doc);
    setSubject(next.subject);
    setDoc(next.doc);
    setPreheader(t.email.preheader ?? '');
  };
  // The email as it stands, as saved and as Preview shows it.
  const email = (): StepEmail => {
    const extra = Object.fromEntries(
      Object.entries({ preheader, cc, bcc })
        .filter(([, v]) => v.trim())
        .map(([k, v]) => [k, v.trim()]),
    );
    const signing = {
      ...(sign.signature !== 'full' ? { signature: sign.signature } : {}),
      ...(sign.signOff !== 'Warmly,' ? { signOff: sign.signOff } : {}),
      ...(header ? { header } : {}),
    };
    return { subject: docToLine(subject), body: '', doc, ...extra, ...signing };
  };
  const save = () => {
    onSave(changed ? email() : undefined, name.trim() || purpose);
    onClose();
  };
  return (
    <Dialog open onClose={onClose} size="lg" aria-labelledby="email-builder-title">
      <div className="flex min-h-0 flex-1 flex-col">
        <DialogHeader
          id="email-builder-title"
          icon={EmailIcon}
          title={
            renamable ? (
              <InlineInput aria-label="Template name" placeholder="Name this email" value={name} onChange={(e) => setName(e.target.value)} className="w-72 text-zebra-950" />
            ) : (
              purpose
            )
          }
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10">
          {previewing ? (
            <InboxPreview email={email()} button={button} view={view} onView={setView} />
          ) : null}
          {/* Hidden, not unmounted, while previewing: the editors keep their place and undo. */}
          <div className={`mx-auto max-w-[640px] space-y-6 ${previewing ? 'hidden' : ''}`}>
            <div className="space-y-0.5">
              <Line label="To">
                <span className="rounded-check bg-hover px-2 py-0.5 text-zebra-950">
                  The client
                </span>
                <span className="ml-auto flex">
                  {(['cc', 'bcc'] as const).map((k) =>
                    copies[k] ? null : (
                      <Button
                        key={k}
                        variant="ghost"
                        compact
                        onClick={() => setCopies({ ...copies, [k]: true })}
                      >
                        {k === 'cc' ? 'Cc' : 'Bcc'}
                      </Button>
                    ),
                  )}
                </span>
              </Line>
              {copies.cc ? (
                <Line label="Cc">
                  <InlineInput
                    aria-label="Cc"
                    placeholder="Email addresses"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    className="min-w-0 flex-1"
                  />
                </Line>
              ) : null}
              {copies.bcc ? (
                <Line label="Bcc">
                  <InlineInput
                    aria-label="Bcc"
                    placeholder="Email addresses"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    className="min-w-0 flex-1"
                  />
                </Line>
              ) : null}
              <Line label="Subject">
                <SubjectEditorLine editor={subjectEditor} />
              </Line>
              <Line label="Preview text">
                <InlineInput
                  aria-label="Preview text"
                  placeholder="The line their inbox shows after the subject"
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  className="min-w-0 flex-1"
                />
              </Line>
            </div>
            {/* The card EmailBody sends: the brand's paper, its padding, a hairline edge. */}
            <article
              style={brandVars(brand ?? BRAND)}
              className="rounded-panel bg-[var(--b-paper)] px-5 py-6 ring-1 ring-hairline sm:px-10 sm:py-8"
            >
              <HeaderPicker
                header={header ?? { show: emailHeaderOf(kit) }}
                business={business}
                logoUrl={(brand ?? BRAND).logoUrl}
                onChange={setHeader}
              />
              {/* Clicking under the text puts the caret at its end. */}
              <div
                className="cursor-text"
                onClick={(e) => e.target === e.currentTarget && editor?.commands.focus('end')}
              >
                <EmailEditorBody editor={editor} />
              </div>
              <div className="mt-6">
                <EmailSignature signOff={sign.signOff} onSignOff={(signOff) => setSign({ ...sign, signOff })} />
              </div>
            </article>
          </div>
        </div>
        <DialogFooter>
          {templates ? <TemplateMenu templates={templates} onPick={pickTemplate} /> : null}
          <GlobalStylingButton
            main={(brand ?? BRAND).primary}
            accent={(brand ?? BRAND).secondary}
          />
          {previewing ? (
            <Button
              variant="ghost"
              icon={<EditIcon aria-hidden="true" className="size-4" />}
              onClick={() => setPreviewing(false)}
            >
              Back to editing
            </Button>
          ) : (
            <Button
              variant="ghost"
              icon={<EyeIcon aria-hidden="true" className="size-4" />}
              onClick={() => setPreviewing(true)}
            >
              Preview
            </Button>
          )}
          <span className="flex-1" />
          {changed ? (
            <Button variant="plain" onClick={reset}>
              {resetLabel ?? <>Back to Zebri&apos;s draft</>}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            icon={<SentIcon aria-hidden="true" className="size-4" />}
            onClick={() => setTested(true)}
          >
            {/* Both labels share one cell, so the button keeps its width when it changes. */}
            <span className="grid">
              <span className={`col-start-1 row-start-1 ${tested ? 'invisible' : ''}`}>
                Send test
              </span>
              <span className={`col-start-1 row-start-1 ${tested ? '' : 'invisible'}`}>Sent</span>
            </span>
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </div>
      <EmailBubble editor={editor} />
    </Dialog>
  );
}
