import { Button } from '@/components/ui-v2/button';
import { Disclosure } from '@/components/ui-v2/disclosure';
import { EmptyState } from '@/components/ui-v2/empty-state';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { CalendarIcon, GuestsIcon } from '@/components/ui-v2/icons';
import { ProgressBar } from '@/components/ui-v2/progress-bar';
import { SwipeRow } from '@/components/ui-v2/swipe-row';
import { Timeline } from '@/components/ui-v2/timeline';

import { Demo, DemoRow, Spec } from './showroom-v2';

/**
 * v2 display pieces, continued: the icon circle, the group label, the
 * progress bar, the timeline, the empty state and the disclosure. Rendered inside the Display group by
 * `components-display.tsx`.
 *
 * @module app/design-system/v2/components-display-more
 */
export function ComponentsDisplayMoreV2() {
  return (
    <>
      <Spec
        name="Icon circle"
        file="components/ui-v2/icon-circle.tsx"
        description="A glyph in a soft grey circle, saying what a dialog, an empty page or a row is about (New client's people glyph beside its title). One fixed tone. md (32px, a 16px glyph) sits beside a title; lg (48px, a 20px glyph) leads an empty state. Never hand-roll the circle."
      >
        <DemoRow>
          <Demo label="md">
            <IconCircle icon={GuestsIcon} />
          </Demo>
          <Demo label="lg">
            <IconCircle size="lg" icon={CalendarIcon} />
          </Demo>
          <Demo label="Beside a dialog title">
            <span className="flex items-center gap-2">
              <IconCircle icon={GuestsIcon} />
              <span className="type-label text-zebra-500">New client</span>
            </span>
          </Demo>
        </DemoRow>
      </Spec>
      <Spec
        name="Group label"
        file="components/ui-v2/group-label.tsx"
        description="The quiet name over a group of rows or controls (Today, Get paid), in body grey 400: the one group-label style. Choose the element with `as` (h3, h4, p, div) by where it sits in the outline, never by look."
      >
        <div className="max-w-xs space-y-1">
          <GroupLabel as="h4">Today</GroupLabel>
          <p className="type-body text-zebra-950">Call Sophie &amp; James</p>
          <p className="type-body text-zebra-950">Send Amelia her invoice</p>
        </div>
      </Spec>
      <Spec
        name="Progress bar"
        file="components/ui-v2/progress-bar.tsx"
        description="How far through a count of things done is (a couple's answers in the paperwork dialog): a 4px grass fill on a zebra track, round ends, easing to its new width. A real progressbar with a label and values. Put the count beside it in words (2 of 20); the bar never carries a number. Not for time passing. `edge` makes it a 2px square line over the bottom border of a `relative` bar: the couple's form on a phone, where it is the only progress shown."
      >
        <div className="max-w-md space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Isla', 6, 20],
              ['Ethan', 20, 20],
            ].map(([name, done, total]) => (
              <div key={name} className="space-y-1.5">
                <p className="flex justify-between type-body">
                  <span className="text-zebra-950">{name}</span>
                  <span className="tabular-nums text-zebra-500">
                    {done} of {total}
                  </span>
                </p>
                <ProgressBar
                  label={`${name}: answers in`}
                  value={Number(done)}
                  max={Number(total)}
                />
              </div>
            ))}
          </div>
          <Demo label="edge">
            <div className="relative border-b border-hairline bg-field px-4 py-3 type-label text-zebra-950">
              Sophie Turner
              <ProgressBar edge label="Part 3 of 9" value={3} max={9} />
            </div>
          </Demo>
        </div>
      </Spec>
      <Spec
        name="Timeline"
        file="components/ui-v2/timeline.tsx"
        description="A record's own steps, top to bottom on one hairline thread: done is a grass dot, the step it is on a grass ring, anything later a grey ring with grey words. When sits quieter on the right. For a side column (the couple's paperwork), not an activity feed, which is rows."
      >
        <div className="max-w-xs">
          <Timeline
            label="History"
            steps={[
              { label: 'Sent to the couple', when: '28 Sep', state: 'done' },
              { label: 'Reminded', when: '6 Oct', state: 'done' },
              { label: 'Answers back', state: 'now' },
              { label: 'Notice signed', when: 'by Thu 1 Oct', state: 'later' },
              { label: 'Wedding', when: 'Sat 31 Oct', state: 'later' },
            ]}
          />
        </div>
      </Spec>
      <Spec
        name="Empty state"
        file="components/ui-v2/empty-state.tsx"
        description="A place with nothing in it yet: an optional glyph in a large icon circle, a subheading, one line on what will live here and an optional action, on the backdrop with no panel. As a page it fills what is left under the title row and sits on the screen's middle; `compact` sizes it to its content, for inside a panel or dialog."
      >
        <EmptyState
          compact
          icon={GuestsIcon}
          title="No clients yet"
          body="Couples you add, or who enquire through your form, show here."
          action={<Button variant="secondary">New client</Button>}
        />
      </Spec>
      <Spec
        name="Disclosure"
        file="components/ui-v2/disclosure.tsx"
        description="A question that opens to its answer, for an FAQ. The whole question line is the button and wraps as long as it needs (a Button is a fixed 36px); the question in regular weight with a plus that becomes a minus as the answer eases open through Collapse. Stack them in a list with divide-hairline. Used by the marketing page's FAQ."
      >
        <ul className="max-w-xl divide-y divide-hairline">
          <li>
            <Disclosure title="Which states can I lodge with?">NSW at launch, through your own eRegistry login. Other states follow.</Disclosure>
          </li>
          <li>
            <Disclosure title="Is there a free plan?">No free plan, but every plan starts with a 7-day free trial.</Disclosure>
          </li>
        </ul>
      </Spec>
      <Spec
        name="Swipe row"
        file="components/ui-v2/swipe-row.tsx"
        description="A list that swipes sideways on a phone, one card at a time with the next peeking in, bleeding to the screen's edges and snapping to the gutter; from `until` (md or lg) up it is a plain list laid out by `className`. `item` sets the swipe width (card, or a short step); `current` keeps one item in view for a row that moves on by itself. Used by the marketing page's pricing, Zebri AI windows and Journeys steps. Narrow the window to see it swipe."
      >
        <SwipeRow aria-label="Plans" until="md" className="md:grid md:grid-cols-3 md:gap-4">
          {['Pro', 'Max', 'Enterprise'].map((plan) => (
            <div key={plan} className="rounded-panel bg-field p-5 shadow-sm ring-1 ring-hairline">
              <p className="type-label text-zebra-950">{plan}</p>
              <p className="mt-1 type-body text-zebra-500">One card per plan.</p>
            </div>
          ))}
        </SwipeRow>
      </Spec>
    </>
  );
}
