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

import { Conflict } from './conflict';
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
      <Spec name="Badge" file="components/ui/badge.tsx" description="21 hard-coded variants across three unrelated domains: couple status, vendor type, event state.">
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

      <Spec name="StatePill" file="components/ui/state-pill.tsx" description="Five semantic tones, three dot modes. Token-clean by design.">
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

      <Conflict
        title="Two status-chip primitives that do the same job differently"
        recommendation={
          <>
            Keep <code>StatePill</code> and retire <code>Badge</code>. Badge hard-codes 21 raw
            palette pairs, has a dead commented-out dot, mixes three unrelated domains in one union,
            and uses <code>rounded-full</code> with <code>text-xs</code> instead of the tokens.
            Vendor-type colouring is the one thing Badge does that StatePill cannot, so that needs a
            deliberate replacement (a <code>tone=&quot;custom&quot;</code> prop or a vendor-specific
            chip) before Badge can go.
          </>
        }
      >
        <DemoGrid cols={2}>
          <Demo label="Badge · raw palette · rounded-full">
            <DemoRow>
              <Badge variant="paid">Paid</Badge>
              <Badge variant="new">New</Badge>
              <Badge variant="cancelled">Cancelled</Badge>
            </DemoRow>
          </Demo>
          <Demo label="StatePill · tokens · rounded-pill">
            <DemoRow>
              <StatePill tone="success" label="Paid" dot="filled" />
              <StatePill tone="warning" label="New" dot="hollow" />
              <StatePill tone="danger" label="Cancelled" />
            </DemoRow>
          </Demo>
        </DemoGrid>
      </Conflict>

      <Spec name="Loading" file="components/ui/loading.tsx" description="Two variants: centred block and inline.">
        <DemoGrid cols={2}>
          <Demo label="center (default)">
            <Loading label="Loading couples" />
          </Demo>
          <Demo label="inline">
            <Loading variant="inline" label="Saving" />
          </Demo>
        </DemoGrid>
      </Spec>

      <Spec name="Empty" file="components/ui/empty.tsx" description="Two sizes, optional icon and call-to-action.">
        <DemoGrid cols={2}>
          <Demo label="md (default)">
            <Empty
              icon={Users}
              title="No couples yet"
              description="Your enquiries will show up here once the lead form is live."
              action={<Button size="sm">Add a couple</Button>}
            />
          </Demo>
          <Demo label="sm">
            <Empty icon={CalendarDays} size="sm" title="Nothing scheduled" description="This week is clear." />
          </Demo>
        </DemoGrid>
      </Spec>

      <Spec name="ErrorState" file="components/ui/error-state.tsx" description="role=alert. Accepts an Error, a retry handler, or a custom action.">
        <DemoGrid cols={2}>
          <Demo label="With retry">
            <ErrorState description="We could not load your couples." onRetry={() => {}} />
          </Demo>
          <Demo label="From an Error object">
            <ErrorState error={new Error('PGRST301: JWT expired')} />
          </Demo>
        </DemoGrid>
      </Spec>

      <Conflict
        title="ErrorState renders its retry control as a native button"
        recommendation={
          <>
            The default recovery action is an underlined native <code>&lt;button&gt;</code>, so a
            primitive that exists to enforce the design system quietly violates it. Swap it for{' '}
            <code>&lt;Button variant=&quot;ghost&quot; size=&quot;sm&quot;&gt;</code>. Compare the
            two below: they share no radius, height or hover treatment.
          </>
        }
      >
        <DemoRow>
          <button
            type="button"
            className="cursor-pointer text-body font-medium text-text underline underline-offset-2 hover:text-text-muted"
          >
            Try again
          </button>
          <Button variant="ghost" size="sm">Try again</Button>
        </DemoRow>
      </Conflict>

      <Spec name="Toast" file="components/ui/toast.tsx" description="Two types only: success and error. Optional action button.">
        <DemoRow>
          <Button size="sm" onClick={() => toast('Couple saved')}>Success toast</Button>
          <Button size="sm" variant="danger" onClick={() => toast('Could not save couple', 'error')}>
            Error toast
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast('Couple archived', 'success', { label: 'Undo', onClick: () => {} })}
          >
            With action
          </Button>
        </DemoRow>
      </Spec>

      <Conflict
        title="Toast has two types; every other feedback surface has five tones"
        recommendation={
          <>
            <code>StatePill</code> and the colour tokens both carry <code>warning</code> and{' '}
            <code>info</code>, but a toast can only be success or error, so warnings get sent as
            errors. Widen <code>ToastType</code> to the same five tones the rest of the system uses.
          </>
        }
      >
        <DemoRow>
          {TONES.map((t) => (
            <StatePill key={t} tone={t} label={t} dot="filled" />
          ))}
          <span className="text-caption text-text-subtle">vs toast: success, error</span>
        </DemoRow>
      </Conflict>

      <Spec name="Tooltip" file="components/ui/tooltip.tsx" description="Two sides, optional keyboard shortcut hint.">
        <DemoRow>
          <Tooltip label="Add a couple">
            <Button size="sm" variant="outline">Hover me (bottom)</Button>
          </Tooltip>
          <Tooltip label="Save changes" shortcut="⌘S" side="top">
            <Button size="sm" variant="outline">Hover me (top, shortcut)</Button>
          </Tooltip>
        </DemoRow>
      </Spec>
    </>
  );
}
