import { FileText, ListChecks } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

import { brandVars } from '../../../onboarding/brand-doc-parts';
import { money } from '../../payments/payments-data';
import { BRAND, MC, PACKAGES } from '../../proposals/templates-data';
import { FIELDS, signatureOf, type EmailBlock, type SignatureId } from '../email-data';

import type { Quirks } from './quirks';

/**
 * An email as it lands: the MC's brand on a white 600px column (the
 * width every inbox handles), the blocks top to bottom, the chosen
 * signature, and the footer. `quirks` bends it the way the inbox would
 * (fallback fonts, square corners, clipping, phone width). `{field}`
 * tokens fill with sample values, or show as marked chips while
 * `showFields` is on, so the MC can see what changes per couple. A
 * marketing email carries the unsubscribe link and the MC's details,
 * which the Spam Act requires; a one-to-one email does not need them.
 * The brand arrives as CSS custom properties, the one `style` here.
 *
 * @module app/design-system/v2/pages/dashboard/email/render/email-body
 */

export interface EmailBodyProps {
  blocks: EmailBlock[];
  signature: SignatureId;
  quirks: Quirks;
  /** Shows `{field}` tokens as chips instead of sample values. */
  showFields?: boolean | undefined;
  /** Adds the unsubscribe footer. */
  marketing?: boolean | undefined;
}

const IMAGE_TONES = {
  grass: 'from-grass-200 via-grass-400 to-grass-800',
  sky: 'from-azure-100 via-azure-300 to-grass-600',
  dusk: 'from-grass-300 via-azure-500 to-grass-950',
} as const;

/** Text with its fields filled in, or marked. Newlines become breaks. */
function Filled({ text, showFields }: { text: string; showFields: boolean }) {
  const parts = text.split(/(\{[^}]+\}|\n)/);
  return (
    <>
      {parts.map((part, i) => {
        if (part === '\n') return <br key={i} />;
        const field = part.startsWith('{') ? FIELDS.find((f) => `{${f.token}}` === part) : undefined;
        if (!field) return <Fragment key={i}>{part}</Fragment>;
        return showFields ? (
          <mark key={i} className="rounded-check bg-grass-100 px-1 text-grass-900">
            {field.token}
          </mark>
        ) : (
          <Fragment key={i}>{field.sample}</Fragment>
        );
      })}
    </>
  );
}

/** One block, drawn for the inbox. */
function Block({ block: b, quirks: q, showFields }: { block: EmailBlock; quirks: Quirks; showFields: boolean }): ReactNode {
  const corner = q.squareCorners ? 'rounded-none' : 'rounded-check';
  switch (b.kind) {
    case 'heading':
      return <h3 className="type-display text-[var(--b-primary)] font-[family-name:var(--b-heading)]"><Filled text={b.text} showFields={showFields} /></h3>;
    case 'text':
      return <p className="type-body text-zebra-700"><Filled text={b.text} showFields={showFields} /></p>;
    case 'image':
      return <div role="img" aria-label={b.alt} className={`aspect-[16/7] w-full bg-linear-to-br ${IMAGE_TONES[b.tone]} ${corner}`} />;
    case 'button':
      return (
        <span className={`inline-flex h-10 items-center px-5 type-label bg-[var(--b-primary)] text-[var(--b-on-primary)] ${corner}`}>
          {b.label}
        </span>
      );
    case 'packages':
      return (
        <div className={`grid gap-3 ${q.narrow ? '' : 'grid-cols-2'}`}>
          {[PACKAGES.classic, PACKAGES.premium].map((p) => (
            <div key={p.name} className={`border border-zebra-200 p-4 ${corner}`}>
              <p className="type-label text-zebra-950">{p.name}</p>
              <p className="type-subheading text-[var(--b-primary)] font-[family-name:var(--b-heading)]">{money(p.price)}</p>
              <p className="mt-1 type-body text-zebra-500">{p.lines[0]}</p>
            </div>
          ))}
        </div>
      );
    case 'attachment': {
      const Icon = b.what === 'form' ? ListChecks : FileText;
      return (
        <div className={`flex items-center gap-3 border border-zebra-200 p-3 ${corner}`}>
          <span className={`flex size-9 items-center justify-center bg-[var(--b-soft)] text-[var(--b-primary)] ${corner}`}>
            <Icon aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate type-label text-zebra-950">{b.name}</span>
            <span className="block truncate type-body text-zebra-500">{b.note}</span>
          </span>
          <span className="type-label text-[var(--b-primary)] underline">{b.what === 'form' ? 'Fill in' : 'Open'}</span>
        </div>
      );
    }
    case 'divider':
      return <hr className="border-zebra-200" />;
  }
}

/**
 * A signature as it signs off an email: the logo mark (when the
 * signature has one) beside its lines, the name first. Shared with the
 * Signatures dialog, so the list shows exactly what couples see.
 * `square` draws the logo square, as Outlook for Windows does.
 */
export function SignatureBlock({ signature, square = false }: { signature: SignatureId; square?: boolean }) {
  const sig = signatureOf(signature);
  return (
    <div className="flex items-center gap-3 pt-2">
      {sig.logo ? (
        <span className={`flex size-10 shrink-0 items-center justify-center bg-[var(--b-primary)] type-label text-[var(--b-on-primary)] ${square ? 'rounded-none' : 'rounded-pill'}`}>
          AP
        </span>
      ) : null}
      <div className="type-body">
        {sig.lines.map((line, i) => (
          <p key={line} className={i === 0 ? 'type-label text-zebra-950' : 'text-zebra-500'}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/** The email as it lands. See {@link EmailBodyProps}. */
export function EmailBody({ blocks, signature, quirks: q, showFields = false, marketing = false }: EmailBodyProps) {
  const shown = blocks.filter((b) => !(q.narrow && b.hideOnPhone));
  // Gmail keeps roughly the first 102KB; the demo cuts at about two thirds.
  const kept = q.clipped ? shown.slice(0, Math.max(1, Math.ceil(shown.length * 0.6))) : shown;
  // Inboxes without web fonts fall back to the stack the builder writes after the brand font.
  const fonts = q.webFonts ? '' : '[--b-heading:Georgia,_serif] [--b-body:Arial,_sans-serif]';
  return (
    <div style={brandVars(BRAND)}>
      <article className={`mx-auto w-full max-w-[600px] bg-field font-[family-name:var(--b-body)] ${fonts}`}>
        <header className="border-b border-zebra-200 px-6 py-4 type-subheading text-zebra-950 font-[family-name:var(--b-heading)]">
          {MC.business}
        </header>
        <div className={`space-y-5 ${q.narrow ? 'px-5 py-6' : 'px-8 py-8'}`}>
          {kept.map((b, i) => (
            <Block key={i} block={b} quirks={q} showFields={showFields} />
          ))}
          {q.clipped ? (
            <p className="type-body text-zebra-500">
              [Message clipped] <span className="text-azure-700 underline">View entire message</span>
            </p>
          ) : (
            <SignatureBlock signature={signature} square={q.squareCorners} />
          )}
        </div>
        {marketing && !q.clipped ? (
          <footer className="border-t border-zebra-200 px-6 py-4 text-center type-body text-zebra-400">
            {MC.business} · Melbourne VIC · <span className="underline">Unsubscribe</span>
          </footer>
        ) : null}
      </article>
    </div>
  );
}
