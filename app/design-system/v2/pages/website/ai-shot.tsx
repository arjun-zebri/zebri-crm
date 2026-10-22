'use client';

import { useState, type JSX } from 'react';

import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { SwipeRow } from '@/components/ui-v2/swipe-row';

import { AiCallPanel } from './ai-call-panel';
import { AI_FEATURES, type AiFeatureId } from './ai-features';
import { AiNudgePanel } from './ai-nudge-panel';
import { AiReplyPanel } from './ai-reply-panel';

/**
 * The Zebri AI row's picture: its three features as cards on the left,
 * the picked one on the right as the app's own window for it
 * (founder, 2026-10-18: "drafted replies, AI nudges and video calls
 * updating client modals"). The windows are snapshots, `aria-hidden` and
 * `inert` like every picture on the page (founder, 2026-10-19: its
 * buttons and ticks are not for clicking); only the feature cards that
 * switch them are live. The enquiry window with Zebri's reply
 * drafted, the Nudge window with the follow-up written, the call's
 * updates ready to apply. No animation (founder: "this one doesnt need
 * an animation"): each window is finished and still, and a card
 * switches it at once.
 *
 * From `lg` the cards and the window are one 34rem rectangle, the cards
 * a third each (icon and title on one row, the line under them), the window filling
 * the rest. Below `lg` each feature is its own slide in a `SwipeRow`:
 * its icon and title over its window, swiped sideways.
 *
 * @module app/design-system/v2/pages/website/ai-shot
 */

const PANELS: Record<AiFeatureId, () => JSX.Element> = {
  replies: AiReplyPanel,
  nudges: AiNudgePanel,
  calls: AiCallPanel,
};

/** The feature cards and the window from `lg`; one swipeable slide per feature below it. */
export function AiShot() {
  const [pick, setPick] = useState<AiFeatureId>('replies');
  const Panel = PANELS[pick];
  return (
    // Straight on the white band, no gradient box (founder, 2026-10-19): the window floats on its shadow.
    <div>
      {/* Phones and tablets swipe from feature to feature, each with its own window
          (founder, 2026-10-19: swipes, not a switcher). */}
      <div className="lg:hidden">
        <SwipeRow aria-label="Zebri AI features" until="lg" item="wide">
          {AI_FEATURES.map(({ id, icon, title }) => {
            const Slide = PANELS[id];
            return (
              <section key={id} aria-label={title} className="flex h-full flex-col gap-4">
                <p className="flex items-center gap-3 type-label text-zebra-950">
                  <IconCircle icon={icon} tone="grass" />
                  {title}
                </p>
                <div
                  aria-hidden="true"
                  inert
                  className="flex flex-1 flex-col overflow-hidden rounded-panel bg-field shadow-lg ring-1 ring-zebra-950/10"
                >
                  <Slide />
                </div>
              </section>
            );
          })}
        </SwipeRow>
      </div>
      <div className="grid gap-8 max-lg:hidden lg:h-[34rem] lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div role="group" aria-label="Zebri AI features" className="grid grid-rows-3 gap-2">
          {AI_FEATURES.map(({ id, icon, title, line }) => (
            <ChoiceCard
              key={id}
              selected={pick === id}
              onClick={() => setPick(id)}
              aria-controls="ai-panel"
              className="p-5"
            >
              {/* Icon and title on one row, the line under them (founder, 2026-10-19). */}
              <span className="flex items-center gap-3">
                <IconCircle icon={icon} tone={pick === id ? 'grass' : 'neutral'} />
                <span className="type-label text-zebra-950">{title}</span>
              </span>
              <span className="mt-2 text-pretty type-body text-zebra-500">{line}</span>
            </ChoiceCard>
          ))}
        </div>
        <section
          id="ai-panel"
          aria-label={AI_FEATURES.find((f) => f.id === pick)?.title}
          className="flex min-h-0 min-w-0"
        >
          <div
            key={pick}
            aria-hidden="true"
            inert
            className="flex w-full flex-col overflow-hidden rounded-panel bg-field shadow-xl ring-1 ring-zebra-950/10"
          >
            <Panel />
          </div>
        </section>
      </div>
    </div>
  );
}
