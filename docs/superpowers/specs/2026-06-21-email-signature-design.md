# Email Signature Design Spec

**Date:** 2026-06-21
**Status:** Approved, in implementation

## Goal

Let an MC configure a single reusable email signature in Settings, using
a Gmail/Outlook-style rich editor, and drop it into any email template
via the `{{ mc.signature }}` variable.

## Decisions (locked)

- **One signature per account** (not multiple named signatures).
- **Gmail/Outlook-style rich editor**: font family, font size, bold,
  italic, underline, text colour, highlight colour, link, image,
  alignment, and lists. The signature is plain content with **no
  template variables inside it** (it is a sign-off, not a template).
- **Dedicated "Signature" settings tab**, listed **below Public Page**.
- Exposed as **`{{ mc.signature }}`** in the existing "You / MC"
  variable group, so it can be inserted into email templates.
- Renders as **HTML** in an email body (formatting, colours, links, and
  images preserved); flattened to plain text in a subject line.
- Images upload to the existing **public `branding` storage bucket**
  (same pattern as MC logos), so they are publicly fetchable by email
  clients. No base64 (it bloats `user_metadata` and gets stripped).

## 1. Storage

- New field `email_signature` on Supabase Auth `user_metadata`, a TipTap
  `JSONContent` doc. User-writable, same model as `mc_signature_name`.
  No DB migration (auth metadata, not a table).
- `email_signature?: JSONContent` is added to the `UserMetadata`
  interface in `app/(dashboard)/settings/settings-body.tsx`.

## 2. Settings UI

- `app/(dashboard)/settings/email-signature-section.tsx` wraps the
  editor with auto-save-on-blur (mirrors `personal-info-section`): a
  blur that leaves the editor region persists the JSON via
  `supabase.auth.updateUser({ data })`; an unchanged blur is a no-op.
  `AutoSaveStatus` shows idle/saving/saved/error.
- `components/ui/signature-editor.tsx` (+ a toolbar split if needed) is
  the Gmail-style editor. It builds from the shared
  `SIGNATURE_EXTENSIONS` list so the editor and the email render stay in
  lockstep.
- New `'signature'` tab in `settings-nav.tsx` (below Public Page),
  routed in `settings-body.tsx`.

## 3. Shared rendering (editor and email use one source of truth)

- `lib/email/signature-extensions.ts` exports `SIGNATURE_EXTENSIONS`:
  StarterKit (bold/italic/underline/link/lists/headings) plus TextStyle,
  Color, FontFamily, FontSize, Highlight, TextAlign, and Image. Both the
  client `useEditor` and the server `generateHTML` build from this list,
  so a signature's stored JSON round-trips identically.
- `lib/email/signature.ts` exports `renderSignatureHtml(doc)` and
  `isSignatureEmpty(doc)`. It generates HTML from the shared extensions
  and runs a **signature-specific sanitiser** that is more permissive
  than the template-body sanitiser (it must allow inline `style` and
  `img`) but kept narrow with a CSS-property allowlist (colour,
  background-colour, text-align, font-size, font-family, width, height),
  an http/https-only image scheme rule, and forced `target=_blank
  rel=noopener` on links. This keeps the loosened sanitiser scoped to
  signature content only; the email-body sanitiser stays locked down.

## 4. Variable wiring

- `mc.signature` is added to the MC group in `VARIABLE_CATALOGUE`
  (`lib/automations/variables.ts`) and so flows into
  `EMAIL_TEMPLATE_VARIABLES`, appearing in the template variable picker.
- Email body: in `lib/email/templates.ts` the `{{mc.signature}}` mention
  renders via `renderSignatureHtml` and is spliced into the sanitised
  body at an indexed placeholder (the same sentinel trick the
  missing-variable highlights use), so the signature's own permissive
  HTML survives the body sanitiser.
- Subject / plain text: `readMc('signature')` flattens the signature doc
  to plain text.

## 5. Send flow

- `buildManualSendContext` (`lib/email/send-context.ts`) and
  `loadMcSnapshot` (`lib/automations/context.ts`) read `email_signature`
  into the MC snapshot, so `mc.signature` resolves identically for
  manual sends and automations.
- `buildSampleContext` (`lib/email/template-variables.ts`) carries a
  representative static signature so the template editor preview shows it
  filled in.

## 6. Edge cases

- **Empty signature** resolves to nothing and is **never** a blocking
  missing variable (exempt from the missing-variable gate).
- **Image with a non-http scheme** (e.g. `javascript:`) is dropped by the
  sanitiser.
- **Dangerous inline CSS** (`url(...)`, `expression(...)`) is dropped;
  only allowlisted properties with safe value patterns survive.

## Testing

- `tests/unit/lib/email/signature.test.ts`: bold/italic/underline,
  colour, font size, highlight, alignment, safe links, image scheme
  filtering, dangerous-CSS stripping, empty detection.
- `tests/unit/lib/email/templates.test.ts`: `{{mc.signature}}` injects
  the rich signature HTML, an empty signature never blocks, and the
  subject flattens to plain text.

## Out of scope

- Multiple named signatures; per-template signature selection.
- A standalone signatures table or migration.
- Template variables inside the signature.
