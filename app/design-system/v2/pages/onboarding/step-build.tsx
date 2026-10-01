'use client';

import { useState } from 'react';

import { Tabs, tabId } from '@/components/ui-v2/tabs';

import { StepBlocks, type StepBlocksProps } from './step-blocks';
import { StepConnect } from './step-connect';

/**
 * Step 2, Build your Zebri: what goes in the MC's Zebri, in two tabs.
 * Zebri tools are the blocks (what shows in the sidebar); Your apps are
 * the calendars, inboxes and accounts Zebri plugs into. One step, since
 * both answer "what will I use?", and the tab counts keep what has been
 * picked in view on either tab. Both tabs stay mounted, so switching
 * keeps a connection mid-way.
 *
 * @module app/design-system/v2/pages/onboarding/step-build
 */

type Tab = 'tools' | 'apps';
const TAB_ID = 'build-tab';

/** The Build your Zebri step. Takes the blocks props through. */
export function StepBuild(blocks: StepBlocksProps) {
  const [tab, setTab] = useState<Tab>('tools');
  const [connected, setConnected] = useState(0);
  return (
    <div className="-mt-2 space-y-6">
      <Tabs
        id={TAB_ID}
        label="What to add"
        items={[
          { value: 'tools', label: 'Zebri tools', count: blocks.value.length },
          { value: 'apps', label: 'Your apps', count: connected },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div role="tabpanel" aria-labelledby={tabId(TAB_ID, 'tools')} hidden={tab !== 'tools'}>
        <StepBlocks {...blocks} />
      </div>
      <div role="tabpanel" aria-labelledby={tabId(TAB_ID, 'apps')} hidden={tab !== 'apps'}>
        <StepConnect onCount={setConnected} />
      </div>
    </div>
  );
}
