'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatePill } from '@/components/ui/state-pill';

import { Conflict } from './conflict';
import { Demo, DemoGrid, SampleFrame, Spec } from './showroom';

/**
 * Layout primitives: the page title row and the content panel.
 *
 * Both were extracted from copy-pasted markup. The conflicts they closed
 * are recorded here so the reason for the shape is not lost.
 *
 * @module app/design-system/primitives-layout
 */

const PADDINGS = ['none', 'sm', 'md', 'lg'] as const;

/** Card and PageHeader, with the drift they replaced. */
export function PrimitivesLayout() {
  return (
    <>
      <Spec
        name="PageHeader"
        file="components/ui/page-header.tsx"
        description="The title row every dashboard page starts with. Title, optional count, optional actions."
      >
        <div className="space-y-6">
          <Demo label="Title only">
            <SampleFrame>
              <PageHeader title="Calendar" />
            </SampleFrame>
          </Demo>
          <Demo label="With a count">
            <SampleFrame>
              <PageHeader title="Couples" count={42} />
            </SampleFrame>
          </Demo>
          <Demo label="With a count and actions">
            <SampleFrame>
              <PageHeader
                title="Payments"
                count={9}
                actions={
                  <Button size="sm">
                    <Plus width={14} height={14} strokeWidth={1.5} aria-hidden="true" />
                    New invoice
                  </Button>
                }
              />
            </SampleFrame>
          </Demo>
          <Demo label="Custom meta instead of a count">
            <SampleFrame>
              <PageHeader title="Payments" meta={<StatePill tone="danger" label="3 overdue" dot="filled" />} />
            </SampleFrame>
          </Demo>
        </div>
      </Spec>

      <Conflict
        title="Resolved: page titles were declared twelve different ways"
        recommendation={
          <>
            All ten dashboard pages now render <code>&lt;PageHeader /&gt;</code>. The title is{' '}
            <code>text-2xl</code> below <code>sm</code> and <code>text-display</code> above it, so
            it no longer eats a third of a phone screen. Page gutters stayed with the pages, since a
            full-height calendar and a scrolling list legitimately differ.
            <br />
            Still open: the round mobile add buttons in those headers use{' '}
            <code>rounded-full</code>, which the button rule forbids. Left alone here to keep this
            change to layout.
          </>
        }
      />

      <Spec
        name="Card"
        file="components/ui/card.tsx"
        description="The standard bordered panel. One radius, two surfaces, four paddings."
      >
        <div className="space-y-6">
          <Demo label="Padding scale">
            <DemoGrid cols={4}>
              {PADDINGS.map((p) => (
                <Card key={p} padding={p}>
                  <p className="text-caption text-text-muted">padding=&quot;{p}&quot;</p>
                </Card>
              ))}
            </DemoGrid>
          </Demo>
          <Demo label="Surfaces">
            <DemoGrid cols={2}>
              <Card>
                <p className="text-caption text-text-muted">surface=&quot;base&quot;</p>
              </Card>
              <Card surface="muted">
                <p className="text-caption text-text-muted">surface=&quot;muted&quot;</p>
              </Card>
            </DemoGrid>
          </Demo>
          <Demo label="Borderless">
            <Card borderless surface="muted">
              <p className="text-caption text-text-muted">no outline, keeps radius and padding</p>
            </Card>
          </Demo>
        </div>
      </Spec>

      <Conflict
        title="Partly resolved: three card shells, none using the radius token"
        group="padding"
        recommendation={
          <>
            <code>&lt;Card /&gt;</code> now covers the dashboard panels, the admin lists, the
            template previews and the four auth forms: 22 sites on one radius, surface and padding
            scale. The rest of the roughly 89 bordered containers are still hand-written, and many
            of them are not cards at all (popovers and dropdowns carry their own z-index, shadow and
            animation, and should keep their own markup). Convert the genuine panels as each page is
            hardened rather than in one sweep.
          </>
        }
      />
    </>
  );
}
