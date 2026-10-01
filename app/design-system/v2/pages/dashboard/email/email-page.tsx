'use client';

import { useDeferredValue, useEffect, useState, type ReactNode } from 'react';

import { Tabs, tabId } from '@/components/ui-v2/tabs';
import { ensureBrandFontsStylesheet } from '@/lib/branding/fonts';

import { PageBar } from '../page-bar';
import { BuilderStub, type StubFor } from '../proposals/modal/builder-stub';

import { CampaignModal } from './campaigns/campaign-modal';
import { CampaignsView } from './campaigns/campaigns-view';
import { EmailToolbar, type Tab } from './email-toolbar';
import { ListDialog } from './lists/list-dialog';
import { ListsView } from './lists/lists-view';
import { NewTemplateDialog } from './new/new-template-dialog';
import { MomentDialog } from './overview/moment-dialog';
import { OverviewView } from './overview/overview-view';
import { SignaturesDialog } from './templates/signatures-dialog';
import { TemplateDialog } from './templates/template-dialog';
import { TemplatesView } from './templates/templates-view';
import { useEmailState } from './use-email-state';

/**
 * The v2 Email page, shown when Email is picked in the dashboard
 * sidebar, behind four tabs. Overview answers "is email bringing in
 * bookings?": the figures, then what Zebri thinks is worth sending now
 * beside how the recent campaigns did. Campaigns are newsletters sent
 * once to a list, results led by who booked. Templates is the library
 * every email starts from (enquiry replies, workflow reminders,
 * newsletters) in folders, each with its sent, open, click and reply
 * rates, previewed in each inbox and device. Lists are saved rules over
 * the MC's clients, with the consent behind them. The sending mailbox
 * sits in the toolbar on every tab. View only: New and Edit open a
 * "coming soon" stub. All content is demo data.
 *
 * @module app/design-system/v2/pages/dashboard/email/email-page
 */

const TAB_ID = 'email-tab';

/** Where the builder stub says every new or edited email will be made. */
const BUILDER_NOTE = 'The email builder is coming soon. Build with blocks, paste your own HTML or import from Stripo, in your branding.';

export interface EmailPageProps {
  heading?: 'h1' | 'h2';
  /** The dashboard's top-right icons, at the end of the title row. */
  actions?: ReactNode;
}

/** The Email page. See {@link EmailPageProps}. */
export function EmailPage({ heading: Heading = 'h1', actions }: EmailPageProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [campaign, setCampaign] = useState<string | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [list, setList] = useState<string | null>(null);
  const [moment, setMoment] = useState<string | null>(null);
  const [signatures, setSignatures] = useState(false);
  const [creating, setCreating] = useState(false);
  const [stub, setStub] = useState<StubFor | null>(null);
  const state = useEmailState();
  const q = useDeferredValue(query.trim().toLowerCase());
  // Previews set the MC's brand fonts, which only the brand editors load.
  useEffect(() => ensureBrandFontsStylesheet(), []);
  const build = (title: string, context: string) => setStub({ title, context, note: BUILDER_NOTE });
  const scheduledCount = state.campaigns.filter((c) => c.group === 'scheduled').length;

  return (
    <section aria-labelledby="email-title" className="flex flex-col gap-6 px-3 pb-8 md:py-3 md:pl-5 md:pr-2">
      <PageBar
        title={
          <Heading id="email-title" className="type-title text-zebra-950">
            Email
          </Heading>
        }
        tabs={
          <Tabs
            id={TAB_ID}
            label="Email"
            items={[
              { value: 'overview', label: 'Overview' },
              { value: 'campaigns', label: 'Campaigns', count: scheduledCount },
              { value: 'templates', label: 'Templates' },
              { value: 'lists', label: 'Lists' },
            ]}
            value={tab}
            onChange={(t) => {
              setTab(t);
              setQuery('');
            }}
          />
        }
        toolbar={
          <EmailToolbar
            tab={tab}
            query={query}
            onQuery={setQuery}
            onSignatures={() => setSignatures(true)}
            onNew={() =>
              tab === 'templates'
                ? setCreating(true)
                : tab === 'lists'
                  ? setStub({ title: 'New list', context: 'A saved rule over your clients', note: 'Lists are coming soon. Pick a stage, a service or a date and the list keeps itself up to date.' })
                  : build('New campaign', 'Starts from a newsletter template')
            }
          />
        }
        actions={actions}
      />
      <div role="tabpanel" aria-labelledby={tabId(TAB_ID, tab)}>
        {tab === 'overview' ? (
          <OverviewView state={state} onOpenCampaign={setCampaign} onReview={setMoment} onViewAll={() => setTab('campaigns')} />
        ) : tab === 'campaigns' ? (
          <CampaignsView state={state} query={q} onOpen={setCampaign} onClearQuery={() => setQuery('')} />
        ) : tab === 'templates' ? (
          <TemplatesView state={state} query={q} onOpen={setTemplate} onClearQuery={() => setQuery('')} />
        ) : (
          <ListsView onOpen={setList} />
        )}
      </div>
      <CampaignModal id={campaign} state={state} onEdit={(c) => build('Edit campaign', c.name)} onClose={() => setCampaign(null)} />
      <TemplateDialog
        id={template}
        state={state}
        onEdit={(t) => build('Edit template', t.name)}
        onClose={() => setTemplate(null)}
      />
      <ListDialog
        id={list}
        onNewCampaign={(name) => build('New campaign', `To ${name}`)}
        onClose={() => setList(null)}
      />
      <MomentDialog id={moment} state={state} onEdit={(name) => build('Edit before sending', name)} onClose={() => setMoment(null)} />
      <SignaturesDialog open={signatures} onNew={() => build('New signature', 'Name, title, links and logo')} onClose={() => setSignatures(false)} />
      <NewTemplateDialog
        open={creating}
        onPick={(how) => {
          setCreating(false);
          build('New template', how);
        }}
        onClose={() => setCreating(false)}
      />
      <BuilderStub stub={stub} onClose={() => setStub(null)} />
    </section>
  );
}
