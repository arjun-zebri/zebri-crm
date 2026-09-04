/**
 * The handwriting face used to render signatures.
 *
 * WHY THIS MODULE EXISTS. The stack `'Caveat, "Brush Script MT", cursive'` was
 * hardcoded at five call sites, but Caveat was never actually loaded anywhere:
 * `app/layout.tsx` pulls in Inter alone, and `GOOGLE_FONT_FAMILIES` (the
 * brand-font map behind `googleFontsHref`) has no Caveat entry. So every
 * "signature" in the product has been falling back to Brush Script MT on
 * Windows and a generic cursive elsewhere, which is not the face anyone chose
 * and looks like a rendering bug on a legal document.
 *
 * Loading it needs TWO registrations, because the PDF is produced in a
 * separate document:
 *
 *  1. The app shell (`app/layout.tsx`) self-hosts Caveat via `next/font`,
 *     exposing it as the `--font-signature` CSS variable on `<body>`.
 *  2. The print window (`lib/pdf/print-document.tsx`) adds a Google Fonts
 *     `<link>`. `stylesheetLinks()` copies the app's own `<link>` tags into
 *     that window, which does carry next/font's `@font-face` rules across, but
 *     `--font-signature` is declared on the app's `<body>` element, which the
 *     print document does not have. The variable therefore resolves to nothing
 *     there.
 *
 * The fallback therefore has to sit INSIDE the `var()`, not after it. A
 * `var()` that references an undefined custom property makes the whole
 * declaration invalid at computed-value time, so `font-family:
 * var(--font-signature), "Caveat", cursive` does not fall through to Caveat in
 * the print window: it drops the declaration entirely and the signature
 * renders in the inherited body face. `var(--font-signature, "Caveat")` keeps
 * the declaration valid in both documents.
 *
 * @module lib/branding/signature-font
 */

/**
 * Font stack for rendered signatures, safe in both the app and the print
 * window. Assign to `fontFamily` in an inline style.
 */
export const SIGNATURE_FONT_STACK =
  'var(--font-signature, "Caveat"), "Brush Script MT", cursive'

/**
 * Google Fonts family spec for the signature face, for the print window's
 * stylesheet link.
 *
 * Deliberately NOT added to `GOOGLE_FONT_FAMILIES` in `lib/branding/fonts.ts`:
 * that map is the set of faces an MC may choose for their brand's headings and
 * body, and a script face has no business being offered there. This is a fixed
 * product decision, not a branding option.
 */
export const SIGNATURE_FONT_GOOGLE_FAMILY = 'Caveat:wght@400;600'
