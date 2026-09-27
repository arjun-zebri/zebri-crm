/**
 * The words a held pre-composed email shows in place of a preview.
 *
 * Its own module, free of any server import, so the step detail (a client
 * component) and the server-side envelope (`./precomposed-envelope`) say
 * the same thing without the client bundling the envelope's reads.
 *
 * @module lib/workflows/precomposed-copy
 */

/** Shown for every held pre-composed email until those previews exist (I3). */
export const PREVIEW_UNAVAILABLE = 'Preview not available for this email type yet.';
