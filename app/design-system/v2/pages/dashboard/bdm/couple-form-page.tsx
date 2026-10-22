'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Backdrop } from '@/components/ui-v2/backdrop';
import { LockIcon } from '@/components/ui-v2/icons';

import { AccountContext, DEMO_ACCOUNT } from '../account';
import { BrandScope } from '../payments/modal/letterhead';
import { ClientView } from '../questionnaires/client-view/client-view';
import { questionAnchor } from '../questionnaires/client-view/page-style';

import { coupleChecks } from './couple-checks';
import { CoupleFormBar } from './couple-form-bar';
import { formParts, withPrefillNotes } from './couple-form-parts';
import { CoupleFormRail, type FormScreen } from './couple-form-rail';
import { CoupleFormReview } from './couple-form-review';
import { CoupleFormSend } from './couple-form-send';
import { CoupleFormWelcome } from './couple-form-welcome';
import { IdCapture } from './id-capture';
import { formTemplate } from './noim-questions';
import { useCoupleForm } from './use-couple-form';

/**
 * "Your marriage details" on a page of its own, as the couple will open
 * it from their link (user, 2026-10-15: See what they see opens a new
 * tab). One card filling the window over the v2 backdrop: the
 * celebrant's letterhead bar across the top, the parts named in a rail
 * from `lg`, and only the questions scrolling, so who sees the answers
 * and Zebri's name stay in view under the card (user, 2026-10-15). It
 * opens on a welcome page, goes a section a page, takes each ID as a
 * photo (`id-capture.tsx`), and ends on Check your answers, where both
 * confirm and send (`couple-form-send.tsx`). State: `use-couple-form.ts`.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/couple-form-page
 */

const never = () => () => undefined;

/** The couple's page for one client. */
export function CoupleFormPage({ client }: { client: string }) {
  // The handoff is in browser storage, so the page is drawn only in the
  // browser: false on the server and through hydration, true after. The
  // backdrop too: its cloud filter's useId differed on the server under
  // this dynamic route, a hydration mismatch.
  const inBrowser = useSyncExternalStore(never, () => true, () => false);
  return (
    // `isolate`, so the backdrop's -z-10 sits over the body's white, not under it.
    <main className="relative isolate flex h-dvh flex-col text-zebra-950">
      {inBrowser ? <Backdrop /> : null}
      <div className="relative mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col sm:px-6 sm:pt-8">
        {inBrowser ? <Form client={client} /> : null}
      </div>
    </main>
  );
}

/** The card, solid white like a dialog, so forty answers read on it plainly. */
// On a phone the form is the screen: no floating card, no margins to lose (user, 2026-10-15).
const CARD = 'flex min-h-0 flex-1 flex-col overflow-hidden bg-field sm:rounded-panel sm:shadow-xl sm:ring-1 sm:ring-hairline';

/** The form itself. */
function Form({ client }: { client: string }) {
  const { form, answer, fill, send, saved, status, sentOn, locked } = useCoupleForm(client);
  const [screen, setScreen] = useState<FormScreen>({ kind: 'welcome' });
  // An answer Check your answers asked for, scrolled to once its part is on screen.
  const [seek, setSeek] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (seek) document.getElementById(questionAnchor(seek))?.scrollIntoView({ block: 'center' });
  }, [seek, screen]);
  if (!form)
    return (
      <div className={`${CARD} max-h-48 justify-center p-6 sm:p-10`}>
        <p role="alert" className="type-body text-zebra-500">
          This form could not be opened here. Open it again from the paperwork, with See what they see.
        </p>
      </div>
    );
  const p = form.paper;
  const to = form.from.split(/\s+/)[0] || 'your celebrant';
  const go = (next: FormScreen, id?: string) => {
    setScreen(next);
    setSeek(id ?? null);
    if (!id) scroller.current?.scrollTo({ top: 0 });
  };
  const checks = coupleChecks(p);
  const template = formTemplate(p);
  const questions = withPrefillNotes(p, template.questions);
  const parts = formParts(p, questions, checks.problems);
  const names = p.names.map((n) => n.trim().split(/\s+/)[0] ?? '').filter(Boolean);
  return (
    <AccountContext value={{ ...DEMO_ACCOUNT, business: form.from, brand: form.brand }}>
      <BrandScope className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className={CARD}>
            <CoupleFormBar
              from={form.from}
              email={form.email}
              saved={saved}
              ready={checks.toFix.length === 0}
              progress={screen.kind === 'part' ? { at: screen.at, total: parts.length } : undefined}
              onFill={() => (fill(), go({ kind: 'review' }))}
            />
            <div className="flex min-h-0 flex-1">
              <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-hairline p-3 lg:block">
                <CoupleFormRail parts={parts} screen={screen} onGo={(s) => go(s)} />
              </aside>
              {/* The one scroll on the page: the questions. */}
              <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 sm:px-10 sm:pb-10 sm:pt-8">
                <div className="mx-auto max-w-xl">
                  {screen.kind === 'welcome' ? (
                    <CoupleFormWelcome names={p.names} from={form.from} onStart={() => go({ kind: 'part', at: 0 })} />
                  ) : screen.kind === 'review' ? (
                    <CoupleFormReview
                      parts={parts}
                      answers={p.answers}
                      problems={checks.problems}
                      toFix={checks.toFix}
                      onChange={(at, id) => go({ kind: 'part', at }, id)}
                      send={
                        <CoupleFormSend
                          key={status}
                          names={names.length ? names : ['You']}
                          to={to}
                          ready={checks.toFix.length === 0}
                          status={status}
                          sentOn={sentOn}
                          locked={locked}
                          onSend={send}
                          onBack={() => go({ kind: 'part', at: parts.length - 1 })}
                        />
                      }
                    />
                  ) : (
                    <ClientView
                      header={false}
                      boxed
                      paged={{
                        part: screen.at,
                        onPart: (at) => go({ kind: 'part', at }),
                        progress: false,
                        eyebrow: (at, total) => `Part ${at + 1} of ${total}`,
                        finish: { label: 'Check your answers', onClick: () => go({ kind: 'review' }) },
                        before: () => go({ kind: 'welcome' }),
                        // Each ID is a photo to take, not numbers to copy out.
                        render: (head, body) =>
                          head?.id.endsWith('.idSection') ? (
                            <IdCapture who={head.id.split('.')[0] ?? 'p1'} questions={body} answers={p.answers} onAnswer={answer} problems={checks.problems} />
                          ) : undefined,
                      }}
                      template={{ ...template, questions }}
                      answers={p.answers}
                      onAnswer={answer}
                      problems={checks.problems}
                      toFix={checks.toFix}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* On white on a phone, so it reads as the screen's foot; two lines there,
              never cut short (user, 2026-10-15: "Only your celebrant sees you..."). */}
          <footer className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-t border-hairline bg-field px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] type-body text-zebra-500 sm:gap-x-4 sm:border-0 sm:bg-transparent sm:py-4">
            <span className="flex items-center gap-2 text-zebra-700">
              <LockIcon aria-hidden="true" className="size-4 shrink-0" />
              Only {form.from ? to : 'your celebrant'} sees your answers
            </span>
            <span aria-hidden="true" className="max-sm:hidden">·</span>
            <span className="max-sm:basis-full max-sm:text-center">Powered by Zebri</span>
          </footer>
        </div>
      </BrandScope>
    </AccountContext>
  );
}
