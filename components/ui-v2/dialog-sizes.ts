import { createContext } from 'react';

/**
 * The v2 dialog's sizes as class strings, kept beside `Dialog` so its
 * file stays about behaviour.
 *
 * @module components/ui-v2/dialog-sizes
 */

/**
 * `'sm'` is a 28rem card that grows with its content. `'md'` (40rem),
 * `'lg'` (56rem) and `'xl'` (72rem) are sheets of fixed height, so
 * filtering what is inside never makes them jump, and all fill the
 * screen on phones. Reach for `md` first: one column; `lg` for a rail
 * beside a list; `xl` for a record with a rail and a working column (a
 * client's profile). `'form'` is 40rem wide like `md` but grows with
 * its content like `sm`, for a short task over another dialog (sending
 * a reminder from an open invoice). `'short'` is a smaller fixed sheet,
 * 38rem by 36rem (narrower and shorter than `md`), for a few settings
 * that left most of `md` blank but must still never change height as a
 * hint or a pill comes and goes; a second `Dialog` opened while one is
 * open stacks in front of it, and Escape closes only the top one.
 * `'split-tall'` is `split` with room for a footer under both panes
 * (41rem tall, Settings and its Save), still shorter than `lg`.
 * `'screen'` takes the whole window with no margin, for an editor a stray
 * click must never close (the document composer): there is no dimmed edge
 * to land on, and the editor owns how it closes.
 */
export type DialogSize = 'sm' | 'form' | 'short' | 'md' | 'split' | 'split-tall' | 'lg' | 'xl' | 'screen';

// The window less the same 2rem margin every workspace keeps from sm up.
export const EXPANDED = 'sm:h-[calc(100dvh-4rem)] sm:w-[calc(100vw-4rem)]';

export const SIZES: Record<DialogSize, string> = {
  sm: 'w-[min(28rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)]',
  form: 'w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)]',
  md:
    'h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ' +
    'sm:h-[min(46rem,calc(100dvh-4rem))] sm:w-[min(40rem,calc(100vw-4rem))]',
  short:
    'h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ' +
    'sm:h-[min(36rem,calc(100dvh-4rem))] sm:w-[min(38rem,calc(100vw-4rem))]',
  // As wide as lg but shorter, still a fixed height: a short list beside
  // its detail (the Payments AI insights), which lg's height left a third
  // empty. Full screen on phones, like the other workspaces.
  split:
    'h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ' +
    'sm:h-[min(37rem,calc(100dvh-4rem))] sm:w-[min(56rem,calc(100vw-4rem))]',
  // split plus Settings' footer row (a 36px Save 22px off the bottom).
  'split-tall':
    'h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ' +
    'sm:h-[min(41rem,calc(100dvh-4rem))] sm:w-[min(56rem,calc(100vw-4rem))]',
  lg:
    'h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ' +
    'sm:h-[min(46rem,calc(100dvh-4rem))] sm:w-[min(56rem,calc(100vw-4rem))]',
  xl:
    'h-dvh w-screen max-sm:max-h-none max-sm:max-w-none ' +
    'sm:h-[min(52rem,calc(100dvh-4rem))] sm:w-[min(72rem,calc(100vw-4rem))]',
  screen: 'h-dvh w-screen max-h-none max-w-none',
};

/**
 * What a `Dialog` tells the parts inside it (`dialog-parts.tsx`): its
 * size, so the parts pick their padding, and its `onClose`, so the
 * header's Close button needs no wiring. Null outside a dialog.
 */
export const DialogContext = createContext<{ size: DialogSize; onClose: () => void } | null>(null);

/** The sizes that get the roomy 40px padding from `sm` up, as New client has. */
export const ROOMY: ReadonlySet<DialogSize> = new Set(['lg', 'split', 'split-tall', 'xl', 'screen']);
