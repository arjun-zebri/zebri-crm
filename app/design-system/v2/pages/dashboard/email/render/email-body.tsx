import { Fragment, type CSSProperties, type ReactNode } from 'react';

import { DocumentsIcon, ListChecksIcon, PlayIcon } from '@/components/ui-v2/icons';
import { renderSignatureHtml } from '@/lib/email/signature';

import { brandVars } from '../../../onboarding/brand-doc-parts';
import { useAccount } from '../../account';
import { useBrandKit } from '../../brand/brand-provider';
import { DEFAULT_EMAIL, DEFAULT_SIGNATURE, emailHeaderOf } from '../../brand/kit';
import { UNNAMED } from '../../first-run/use-new-account';
import { money } from '../../payments/payments-data';
import { BRAND, MC, PACKAGES } from '../../proposals/templates-data';
import { roleTitle, useOwnSignature } from '../../settings/own-signature';
import {
  FIELDS,
  signatureOf,
  type EmailBlock,
  type EmailHeader,
  type SignatureId,
} from '../email-data';

import type { Quirks } from './quirks';

/**
 * An email as it lands, always HTML and always in the MC's brand: a pale
 * wash of their colour round a white 600px card (the width every inbox
 * handles), the business set
 * in their heading face, the blocks top to bottom with room between,
 * the chosen signature, and a quiet footer with who sent it. Built so
 * the default look is already one an MC would be proud of, before they
 * touch a setting. `quirks` bends it the way the inbox would
 * (fallback fonts, square corners, clipping, phone width). `{field}`
 * tokens fill with sample values, or show as marked chips while
 * `showFields` is on, so the MC can see what changes per couple. A
 * marketing email carries the unsubscribe link, which the Spam Act
 * requires; a one-to-one email does not need it.
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
  /**
   * Leaves out the brand-washed canvas, the card's edge and the footer,
   * for a caller that draws the email inside its own frame (the journey
   * step's inbox card, which puts the footer under it). Default true.
   */
  chrome?: boolean | undefined;
  /** The words above the signature; the brand kit's sign-off when unset. */
  signOff?: string | undefined;
  /** What heads it; the brand kit's choice when unset. */
  header?: EmailHeader | undefined;
}

/** The demo picture's colours, by tone. */
export const IMAGE_TONES = {
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
        const field = part.startsWith('{')
          ? FIELDS.find((f) => `{${f.token}}` === part)
          : undefined;
        if (!field) return <Fragment key={i}>{part}</Fragment>;
        return showFields ? (
          <mark key={i} className={FIELD_MARK}>
            {field.token}
          </mark>
        ) : (
          <Fragment key={i}>{field.sample}</Fragment>
        );
      })}
    </>
  );
}

/**
 * A field marked as a chip while Show fields is on. Shared with the
 * journey email editor, so a field reads the same in both.
 */
export const FIELD_MARK = 'rounded-check bg-grass-100 px-1 text-grass-900';

/** A block's corners: square where the inbox squares them (Outlook for Windows). */
export const blockCorner = (square = false) => (square ? 'rounded-none' : 'rounded-check');

/**
 * The pieces of a block that the journey email editor draws too, so a
 * block in the editor is the block that is sent (same price format,
 * heading face, corners, labels and sizes).
 */
export function EmailButtonFace({
  label,
  square = false,
}: {
  label: string;
  square?: boolean | undefined;
}) {
  return (
    <span
      className={`inline-flex h-11 items-center px-6 type-label bg-[var(--b-primary)] text-[var(--b-on-primary)] ${blockCorner(square)}`}
    >
      {label}
    </span>
  );
}

/** The MC's packages, two across on a wide screen. See {@link EmailButtonFace}. */
export function PackagesGrid({
  narrow = false,
  square = false,
}: {
  narrow?: boolean | undefined;
  square?: boolean | undefined;
}) {
  return (
    <div className={`grid gap-3 ${narrow ? '' : 'grid-cols-2'}`}>
      {[PACKAGES.classic, PACKAGES.premium].map((p) => (
        <div key={p.name} className={`border border-hairline p-4 ${blockCorner(square)}`}>
          <p className="type-label text-zebra-950">{p.name}</p>
          <p className="type-subheading text-[var(--b-primary)] font-[family-name:var(--b-heading)]">
            {money(p.price)}
          </p>
          <p className="mt-1 type-body text-zebra-500">{p.lines[0]}</p>
        </div>
      ))}
    </div>
  );
}

/** A form or document as a link card; `name` is a node so the editor can make it editable. See {@link EmailButtonFace}. */
export function AttachmentCard({
  what,
  name,
  note,
  square = false,
}: {
  what: 'form' | 'document';
  name: ReactNode;
  note: string;
  square?: boolean | undefined;
}) {
  const Icon = what === 'form' ? ListChecksIcon : DocumentsIcon;
  const corner = blockCorner(square);
  return (
    <div className={`flex items-center gap-3 border border-hairline p-3 ${corner}`}>
      <span
        className={`flex size-9 items-center justify-center bg-[var(--b-soft)] text-[var(--b-primary)] ${corner}`}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate type-label text-zebra-950">{name}</span>
        {note ? <span className="block truncate type-body text-zebra-500">{note}</span> : null}
      </span>
      <span className="type-label text-[var(--b-primary)] underline">
        {what === 'form' ? 'Fill in' : 'Open'}
      </span>
    </div>
  );
}

/** A video's thumbnail with its play button and length. See {@link EmailButtonFace}. */
export function VideoFace({
  thumb,
  length,
  square = false,
}: {
  thumb?: string | undefined;
  length?: string | undefined;
  square?: boolean | undefined;
}) {
  return (
    <div
      className={`relative flex aspect-video items-center justify-center overflow-hidden bg-zebra-950 ${blockCorner(square)}`}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- an email renders plain <img>, as the inbox will
        <img src={thumb} alt="" className="absolute inset-0 size-full object-cover" />
      ) : null}
      <span className="relative flex size-14 items-center justify-center rounded-pill bg-field/90 text-zebra-950">
        <PlayIcon aria-hidden="true" className="ml-0.5 size-4" />
      </span>
      {length ? (
        <span className="absolute bottom-3 left-3 rounded-check bg-zebra-950/70 px-1.5 type-numeric text-zebra-50">
          {length}
        </span>
      ) : null}
    </div>
  );
}

/** One block, drawn for the inbox. */
function Block({
  block: b,
  quirks: q,
  showFields,
}: {
  block: EmailBlock;
  quirks: Quirks;
  showFields: boolean;
}): ReactNode {
  const corner = blockCorner(q.squareCorners);
  switch (b.kind) {
    case 'heading':
      return b.level === 3 ? (
        <h4 className="type-heading text-zebra-950">
          <Filled text={b.text} showFields={showFields} />
        </h4>
      ) : (
        <h3 className="type-display text-[var(--b-primary)] font-[family-name:var(--b-heading)]">
          <Filled text={b.text} showFields={showFields} />
        </h3>
      );
    case 'quote':
      return (
        <blockquote className="border-l-2 border-zebra-950 pl-5 type-subheading text-zebra-950">
          <Filled text={b.text} showFields={showFields} />
        </blockquote>
      );
    case 'video':
      return (
        <figure className="space-y-2">
          <VideoFace thumb={b.thumb} length={b.length} square={q.squareCorners} />
          {b.caption ? (
            <figcaption className="text-center type-body text-zebra-500">{b.caption}</figcaption>
          ) : null}
        </figure>
      );
    case 'spacer':
      return <div aria-hidden="true" className="h-4" />;
    case 'text':
      return (
        <p className="type-body text-zebra-700">
          <Filled text={b.text} showFields={showFields} />
        </p>
      );
    case 'image':
      // An uploaded photo (a blob URL, so not next/image), or the demo picture in its colours.
      return b.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.src} alt={b.alt} className={`w-full object-cover ${corner}`} />
      ) : (
        <div
          role="img"
          aria-label={b.alt}
          className={`aspect-[16/7] w-full bg-linear-to-br ${IMAGE_TONES[b.tone]} ${corner}`}
        />
      );
    case 'button':
      return <EmailButtonFace label={b.label} square={q.squareCorners} />;
    case 'packages':
      return <PackagesGrid narrow={q.narrow} square={q.squareCorners} />;
    case 'attachment':
      return <AttachmentCard what={b.what} name={b.name} note={b.note} square={q.squareCorners} />;
    case 'divider':
      return <hr className="border-hairline" />;
  }
}

/**
 * A signature as it signs off an email: a warm sign-off, then (for a
 * signature with a logo) their initials in a soft circle beside the
 * name, set in the brand's heading face, with everything else (role,
 * phone, website) on one muted line under it, split by dots. Shared
 * with the Signatures dialog, so the list shows exactly what couples
 * see. `square` draws the logo square, as Outlook for Windows does.
 */
export function SignatureBlock({
  signature,
  square = false,
  signOff = 'Warmly,',
}: {
  signature: SignatureId;
  square?: boolean;
  signOff?: string | undefined;
}) {
  const { mc, contact } = useAccount();
  const { kit } = useBrandKit();
  const sig = signatureOf(signature);
  // Built from Business, so the signature never disagrees with the documents; Settings > Email picks what shows.
  const me = mc ?? { name: MC.name, role: 'MC' };
  const shows = kit.email?.signature ?? DEFAULT_SIGNATURE;
  const full = [
    me.name,
    shows.role ? roleTitle(me.role) : '',
    shows.phone ? (contact?.phone ?? '') : '',
    shows.website ? (kit.details?.website ?? '') : '',
    shows.note,
  ];
  const own = {
    full,
    short: [me.name.split(/\s+/)[0] ?? me.name],
    planning: [me.name, 'Replies within one business day'],
  }[signature].filter(Boolean);
  const [name = '', ...rest] = own;
  // No name yet (a new account's "You"): a quiet placeholder to fill in Settings, not "You" in their inbox.
  const unnamed = name === UNNAMED;
  const logo = !unnamed && (signature === 'full' ? shows.logo : sig.logo);
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  // The signature the MC wrote in Settings > Email is the Full one, rendered as production sends it.
  // The full signature is always the MC's own (Settings > Email), or its start from Business until written, so
  // what they write in an email is what the preview and the inbox show.
  const mine = useOwnSignature();
  const written = signature === 'full' ? renderSignatureHtml(mine.value) : '';
  if (written) {
    return (
      <div className="space-y-4 pt-2 type-body">
        {signOff ? <p className="text-zebra-700">{signOff}</p> : null}
        {/* Sanitised by renderSignatureHtml, production's own renderer. */}
        <div
          className="text-zebra-950 [&_a]:underline [&_img]:max-w-[200px] [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: written }}
        />
      </div>
    );
  }
  return (
    <div className="space-y-4 pt-2 type-body">
      {signOff ? <p className="text-zebra-700">{signOff}</p> : null}
      <div className="flex items-center gap-3">
        {logo ? (
          <span
            className={`flex size-11 shrink-0 items-center justify-center bg-zebra-100 type-label text-zebra-700 ring-1 ring-zebra-200 ring-inset ${square ? 'rounded-none' : 'rounded-pill'}`}
          >
            {initials}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className={`type-subheading font-[family-name:var(--b-heading)] ${unnamed ? 'text-zebra-400' : 'text-zebra-950'}`}>
            {unnamed ? 'Your name' : name}
          </p>
          {rest.length ? <p className="text-zebra-500">{rest.join(' · ')}</p> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * What heads an email: the business name in the brand's heading face, or
 * the logo. A logo asked for with none to show falls back to the name, so
 * an email never opens on a blank. Nothing when `show` is "none".
 */
export function Masthead({
  header,
  business,
  logoUrl,
}: {
  header?: EmailHeader | undefined;
  business: string;
  logoUrl: string | null;
}) {
  if (header?.show === 'none') return null;
  const logo = header?.show === 'logo' ? (header.logo ?? logoUrl) : null;
  if (logo)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- an email renders plain <img>, as the inbox will
      <img src={logo} alt={business} className="mx-auto max-h-14 max-w-[200px] object-contain" />
    );
  const name = header?.text || business;
  // No business name yet: a quiet placeholder, not "You" at the top of their email.
  return (
    <p className={`type-heading font-[family-name:var(--b-heading)] ${name === UNNAMED ? 'text-zebra-400' : 'text-zebra-950'}`}>
      {name === UNNAMED ? 'Your business name' : name}
    </p>
  );
}

/** The email as it lands. See {@link EmailBodyProps}. */
export function EmailBody({
  blocks,
  signature,
  signOff: ownSignOff,
  header: ownHeader,
  quirks: q,
  showFields = false,
  marketing = false,
  chrome = true,
}: EmailBodyProps) {
  const { brand, business } = useAccount();
  // An email that says nothing of its own starts and ends as the brand kit's Email tab says.
  const { kit } = useBrandKit();
  const mail = kit.email ?? DEFAULT_EMAIL;
  const header = ownHeader ?? { show: emailHeaderOf(kit) };
  const signOff = ownSignOff ?? mail.signOff;
  const shown = blocks.filter((b) => !(q.narrow && b.hideOnPhone));
  // Gmail keeps roughly the first 102KB; the demo cuts at about two thirds.
  const kept = q.clipped ? shown.slice(0, Math.max(1, Math.ceil(shown.length * 0.6))) : shown;
  // Inboxes without web fonts fall back to the stack the builder writes after the brand font.
  const fonts = q.webFonts ? '' : '[--b-heading:Georgia,_serif] [--b-body:Arial,_sans-serif]';
  const b = brand ?? BRAND;
  const corner = q.squareCorners ? 'rounded-none' : 'rounded-panel';
  const content = (
    <div className={`bg-[var(--b-paper)] font-[family-name:var(--b-body)] ${fonts}`}>
      {header?.show === 'none' ? null : (
        <header className={`text-center ${q.narrow ? 'px-5 pt-7 pb-1' : 'px-10 pt-10 pb-2'}`}>
          <Masthead header={header} business={business} logoUrl={b.logoUrl} />
        </header>
      )}
      <div className={`space-y-6 ${q.narrow ? 'px-5 py-6' : 'px-10 py-8'}`}>
        {kept.map((block, i) => (
          <Block key={i} block={block} quirks={q} showFields={showFields} />
        ))}
        {q.clipped ? (
          <p className="type-body text-zebra-500">
            [Message clipped] <span className="text-azure-700 underline">View entire message</span>
          </p>
        ) : (
          <SignatureBlock signature={signature} signOff={signOff} square={q.squareCorners} />
        )}
      </div>
    </div>
  );
  if (!chrome) return <div style={brandVars(b)}>{content}</div>;
  return (
    // The canvas round the email: a pale wash of the brand colour, so even
    // a plain-text-heavy email arrives looking designed, as Stripe's and
    // Linear's do. Background colours survive in every inbox.
    <div
      style={
        {
          ...brandVars(b),
          '--b-canvas': `color-mix(in oklab, ${b.primary} 7%, white)`,
        } as CSSProperties
      }
      className={`bg-[var(--b-canvas)] ${q.narrow ? 'px-3 py-6' : 'px-6 py-10'}`}
    >
      <article
        className={`mx-auto w-full max-w-[600px] overflow-hidden ring-1 ring-hairline ${corner}`}
      >
        {content}
      </article>
      {q.clipped ? null : (
        <footer className="mx-auto mt-6 max-w-[600px] space-y-1 text-center type-body text-zebra-400">
          <p>{business} · Melbourne VIC</p>
          {marketing ? <p className="underline">Unsubscribe</p> : null}
        </footer>
      )}
    </div>
  );
}
