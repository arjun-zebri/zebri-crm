'use client';

import { CalendarDays, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorState } from '@/components/ui/error-state';
import { Loading } from '@/components/ui/loading';
import { StatePill } from '@/components/ui/state-pill';
import { useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';

import { Demo, DemoGrid, DemoRow, Spec } from './showroom';

/**
 * Feedback primitives: status chips, the loading / empty / error triad,
 * toasts and tooltips.
 *
 * @module app/design-system/primitives-feedback
 */

const BADGE_STATUS = ['default', 'new', 'contacted', 'confirmed', 'paid', 'complete'] as const;
const BADGE_VENDOR = [
  'venue', 'celebrant', 'photographer', 'videographer', 'dj', 'florist',
  'hair_makeup', 'caterer', 'photo_booth', 'lighting_av', 'planner', 'other',
] as const;
const BADGE_EVENT = ['upcoming', 'completed', 'cancelled'] as const;
const TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const;

/** All feedback primitives with their variant matrices. */
export function PrimitivesFeedback() {
  const { toast } = useToast();

  return (
    <>
      <Spec name="Badge" file="components/ui/badge.tsx"
        importPath="@/components/ui/badge" description="21 hard-coded variants across three unrelated domains: couple status, vendor type, event state.">
        <div className="space-y-4">
          <Demo label="Couple status">
            <DemoRow>
              {BADGE_STATUS.map((v) => (
                <Badge key={v} variant={v}>{v}</Badge>
              ))}
            </DemoRow>
          </Demo>
          <Demo label="Vendor type">
            <DemoRow>
              {BADGE_VENDOR.map((v) => (
                <Badge key={v} variant={v}>{v}</Badge>
              ))}
            </DemoRow>
          </Demo>
          <Demo label="Event state">
            <DemoRow>
              {BADGE_EVENT.map((v) => (
                <Badge key={v} variant={v}>{v}</Badge>
              ))}
            </DemoRow>
          </Demo>
        </div>
      </Spec>

      <Spec name="StatePill" file="components/ui/state-pill.tsx"
        importPath="@/components/ui/state-pill" description="Five semantic tones, three dot modes. Token-clean by design.">
        <div className="space-y-4">
          <Demo label="Tones (no dot)">
            <DemoRow>
              {TONES.map((t) => (
                <StatePill key={t} tone={t} label={t} />
              ))}
            </DemoRow>
          </Demo>
          <Demo label="Filled dot">
            <DemoRow>
              {TONES.map((t) => (
                <StatePill key={t} tone={t} label={t} dot="filled" />
              ))}
            </DemoRow>
          </Demo>
          <Demo label="Hollow dot">
            <DemoRow>
              {TONES.map((t) => (
                <StatePill key={t} tone={t} label={t} dot="hollow" />
              ))}
            </DemoRow>
          </Demo>
        </div>
      </Spec>

      <Spec name="Loading" file="components/ui/loading.tsx"
        importPath="@/components/ui/loading" description="Two variants: centred block and inline.">
        <DemoGrid cols={2}>
          <Demo label="center (default)">
            <Loading label="Loading couples" />
          </Demo>
          <Demo label="inline">
            <Loading variant="inline" label="Saving" />
          </Demo>
        </DemoGrid>
      </Spec>

      <Spec name="Empty" file="components/ui/empty.tsx"
        importPath="@/components/ui/empty" description="Two sizes, optional icon and call-to-action.">
        <DemoGrid cols={2}>
          <Demo label="md (default)">
            <Empty
              icon={Users}
              title="No couples yet"
              description="Your enquiries will show up here once the lead form is live."
              action={<Button>Add a couple</Button>}
            />
          </Demo>
          <Demo label="sm">
            <Empty icon={CalendarDays} size="sm" title="Nothing scheduled" description="This week is clear." />
          </Demo>
        </DemoGrid>
      </Spec>

      <Spec name="ErrorState" file="components/ui/error-state.tsx"
        importPath="@/components/ui/error-state" description="role=alert. Accepts an Error, a retry handler, or a custom action.">
        <DemoGrid cols={2}>
          <Demo label="With retry">
            <ErrorState description="We could not load your couples." onRetry={() => {}} />
          </Demo>
          <Demo label="From an Error object">
            <ErrorState error={new Error('PGRST301: JWT expired')} />
          </Demo>
        </DemoGrid>
      </Spec>

      <Spec name="Toast" file="components/ui/toast.tsx"
        importPath="@/components/ui/toast" description="Two types only: success and error. Optional action button.">
        <DemoRow>
          <Button onClick={() => toast('Couple saved')}>Success toast</Button>
          <Button variant="danger" onClick={() => toast('Could not save couple', 'error')}>
            Error toast
          </Button>
          <Button
            variant="outline"
            onClick={() => toast('Couple archived', 'success', { label: 'Undo', onClick: () => {} })}
          >
            With action
          </Button>
        </DemoRow>
      </Spec>

      <Spec name="Tooltip" file="components/ui/tooltip.tsx"
        importPath="@/components/ui/tooltip" description="Two sides, optional keyboard shortcut hint.">
        <DemoRow>
          <Tooltip label="Add a couple">
            <Button variant="outline">Hover me (bottom)</Button>
          </Tooltip>
          <Tooltip label="Save changes" shortcut="⌘S" side="top">
            <Button variant="outline">Hover me (top, shortcut)</Button>
          </Tooltip>
        </DemoRow>
      </Spec>
    </>
  );
}
