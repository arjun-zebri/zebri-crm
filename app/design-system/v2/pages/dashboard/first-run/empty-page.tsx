import type { ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { EmptyState } from '@/components/ui-v2/empty-state';

import { PageBar } from '../page-bar';
import { PageFrame } from '../page-frame';

/**
 * Any sidebar page on a new account other than Home: the page's frame
 * and bar (its name for screen readers, the top-right icons in their
 * usual place), then the v2 `EmptyState` saying it fills up as the MC
 * works, with the way back to Home. Never demo rows: an empty account
 * that shows made-up clients reads as someone else's account.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/empty-page
 */
export function EmptyPage({
  title,
  heading: Heading,
  actions,
  onHome,
}: {
  title: string;
  heading: 'h1' | 'h2';
  /** The top-right icons, as on every other page's bar. */
  actions?: ReactNode;
  onHome: () => void;
}) {
  const id = `empty-${title.toLowerCase().replace(/\s+/g, '-')}-title`;
  return (
    <PageFrame
      labelledBy={id}
      bar={
        <PageBar
          title={
            <Heading id={id} className="sr-only">
              {title}
            </Heading>
          }
          actions={actions}
        />
      }
    >
      <EmptyState
        title="Nothing here yet"
        body={`${title} fills up as you work. Home walks you through your first client.`}
        action={
          <Button variant="secondary" onClick={onHome}>
            Back to Home
          </Button>
        }
      />
    </PageFrame>
  );
}
