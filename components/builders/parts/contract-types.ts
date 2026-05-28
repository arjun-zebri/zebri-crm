/**
 * Shared types for the contract-builder parts.
 *
 * Re-exports `JSONContent` from TipTap as the canonical shape for
 * contract bodies — keeps the import surface narrow so individual
 * parts don't all reach into `@tiptap/react`.
 *
 * @module components/builders/parts/contract-types
 */
export type { JSONContent } from '@tiptap/react';
