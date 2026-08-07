'use client';

import { useState } from 'react';

import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { EventOverview } from '@/components/events/event-overview';
import { EventTimelineModal } from '@/components/events/event-timeline-modal';
import { EventTimelineShare } from '@/components/events/event-timeline-share';
import { ConnectStatusPanel } from '@/components/settings/connect-status-panel';
import { TimeCategoryPicker } from '@/components/time-tracking/time-category-picker';
import { TimeCategoryRow } from '@/components/time-tracking/time-category-row';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { DEMO_EVENT, FIXTURES } from './fixtures';
import { ReadOnlyPreview } from './read-only-preview';
import { Demo, DemoGrid, Spec } from './showroom';

/**
 * Composites from auth, events, settings and time-tracking that render
 * from props alone.
 *
 * @module app/design-system/composites-misc
 */

/** A Connect account mid-onboarding, so the panel shows its warning path. */
const CONNECT_PENDING = {
  accountId: 'acct_demo',
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  requirementsCurrentlyDue: ['individual.verification.document'],
  requirementsPastDue: [],
  disabledReason: 'requirements.past_due',
  defaultCurrency: 'aud',
  country: 'AU',
  businessType: 'individual',
  lastAccountId: null,
};

const CONNECT_READY = {
  ...CONNECT_PENDING,
  chargesEnabled: true,
  payoutsEnabled: true,
  detailsSubmitted: true,
  requirementsCurrentlyDue: [],
  disabledReason: null,
};

/** Prop-driven composites across four feature areas. */
export function CompositesMisc() {
  const [password, setPassword] = useState('wedding');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(true);
  const [category, setCategory] = useState<string | null>('demo-cat-1');

  return (
    <>
      <Spec
        name="PasswordStrengthMeter"
        file="components/auth/password-strength-meter.tsx"
        importPath="@/components/auth/password-strength-meter"
        description="Renders nothing for an empty password. Type to see it move."
      >
        <div className="max-w-sm space-y-2">
          <Input
            label="Password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrengthMeter password={password} />
        </div>
      </Spec>

      <Spec
        name="EventOverview"
        file="components/events/event-overview.tsx"
        importPath="@/components/events/event-overview"
        description="Read-only summary of an event's date, venue and status."
      >
        <EventOverview event={DEMO_EVENT} />
      </Spec>

      <Spec
        name="EventTimelineModal"
        file="components/events/event-timeline-modal.tsx"
        importPath="@/components/events/event-timeline-modal"
        description="Add or edit a run-sheet item. Includes the bespoke TimePicker."
      >
        <Button variant="outline" onClick={() => setTimelineOpen(true)}>
          Open timeline item modal
        </Button>
        <EventTimelineModal
          isOpen={timelineOpen}
          onClose={() => setTimelineOpen(false)}
          onSave={() => setTimelineOpen(false)}
          item={FIXTURES.timelineItems[1] ?? null}
          loading={false}
        />
      </Spec>

      <Spec
        name="EventTimelineShare"
        file="components/events/event-timeline-share.tsx"
        importPath="@/components/events/event-timeline-share"
        description="Public run-sheet link toggle and regenerate control."
      >
        <EventTimelineShare
          shareToken="demo-share-token"
          shareEnabled={shareEnabled}
          onToggle={setShareEnabled}
          onRegenerate={() => {}}
          loading={false}
        />
      </Spec>

      <Spec
        name="ConnectStatusPanel"
        file="components/settings/connect-status-panel.tsx"
        importPath="@/components/settings/connect-status-panel"
        description="Stripe Connect onboarding state. Both branches shown."
      >
        <DemoGrid cols={2}>
          <Demo label="Requirements outstanding">
            <ConnectStatusPanel state={CONNECT_PENDING} />
          </Demo>
          <Demo label="Fully onboarded">
            <ConnectStatusPanel state={CONNECT_READY} />
          </Demo>
        </DemoGrid>
      </Spec>

      <Spec
        name="TimeCategoryPicker"
        file="components/time-tracking/time-category-picker.tsx"
        importPath="@/components/time-tracking/time-category-picker"
        description="Searchable category picker with inline create, rename, recolour and delete."
      >
        <ReadOnlyPreview note="Create and delete write straight to your categories table.">
          <TimeCategoryPicker value={category} onChange={setCategory} />
        </ReadOnlyPreview>
      </Spec>

      <Spec
        name="TimeCategoryRow"
        file="components/time-tracking/time-category-row.tsx"
        importPath="@/components/time-tracking/time-category-row"
        description="One row inside the picker. Selected and unselected states."
      >
        <div className="max-w-sm rounded-control border border-border">
          {FIXTURES.timeCategories.map((c, i) => (
            <TimeCategoryRow
              key={c.id}
              category={c}
              selected={i === 0}
              onSelect={() => {}}
              onRename={() => {}}
              onRecolor={() => {}}
              onDelete={() => {}}
            />
          ))}
        </div>
      </Spec>
    </>
  );
}
