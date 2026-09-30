/**
 * Re-export of {@link replaceOptions}, which now lives in
 * `lib/proposals/write-options.ts`.
 *
 * It moved so that `features/proposals` can reach it (the feature boundary
 * forbids importing from `app/`) without every caller in this folder having
 * to change. Import `@/lib/proposals/write-options` directly in new code.
 *
 * @module app/(dashboard)/proposals/write-options
 */
export { replaceOptions } from '@/lib/proposals/write-options';
