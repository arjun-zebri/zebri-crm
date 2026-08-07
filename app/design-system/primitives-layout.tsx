'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatePill } from '@/components/ui/state-pill';

import { Demo, DemoGrid, SampleFrame, Spec } from './showroom';

/**
 * Layout primitives: the page title row and the content panel.
 *
 * The title row every page starts with, and the standard content panel.
 *
 * @module app/design-system/primitives-layout
 */

const PADDINGS = ['none', 'sm', 'md', 'lg'] as const;

/** PageHeader and Card. */
export function PrimitivesLayout() {
  return (
    <>
      <Spec
        name="PageHeader"
        file="components/ui/page-header.tsx"
        importPath="@/components/ui/page-header"
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
                  <Button>
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

      <Spec
        name="Card"
        file="components/ui/card.tsx"
        importPath="@/components/ui/card"
        description="The standard bordered panel. One radius, two surfaces, four paddings."
      >
        <div className="space-y-6">
          <Demo label="Padding scale">
            <DemoGrid cols={4}>
              {PADDINGS.map((p) => (
                <Card key={p} padding={p}>
                  <p className="text-body text-text-muted">padding=&quot;{p}&quot;</p>
                </Card>
              ))}
            </DemoGrid>
          </Demo>
          <Demo label="Surfaces">
            <DemoGrid cols={2}>
              <Card>
                <p className="text-body text-text-muted">surface=&quot;base&quot;</p>
              </Card>
              <Card surface="muted">
                <p className="text-body text-text-muted">surface=&quot;muted&quot;</p>
              </Card>
            </DemoGrid>
          </Demo>
          <Demo label="Borderless">
            <Card borderless surface="muted">
              <p className="text-body text-text-muted">no outline, keeps radius and padding</p>
            </Card>
          </Demo>
        </div>
      </Spec>

    </>
  );
}
