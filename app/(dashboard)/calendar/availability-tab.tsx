'use client';

import { useEffect, useRef, useState } from 'react';

import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';

import { AvailabilitySkeleton } from './_components/tab-skeletons';
import { AvailabilityHeader } from './availability-header';
import { AvailabilityOverrideModal } from './availability-override-modal';
import { AvailabilityOverrides } from './availability-overrides';
import {
  emptyWeek,
  isSameWeek,
  rulesFromWeek,
  weekFromRules,
  type WeekState,
} from './availability-utils';
import { AvailabilityWeeklyHours } from './availability-weekly-hours';
import {
  useAvailability,
  useSaveAvailability,
  useUpsertOverride,
  useDeleteOverride,
} from './use-availability';

/**
 * Availability tab (orchestrator): the MC's weekly bookable hours plus
 * the per-date overrides that beat them.
 *
 * Two save models sit side by side on purpose. The weekly schedule is a
 * whole-form edit, buffered behind Save changes / Discard, because a
 * half-typed window is a valid intermediate state. Overrides are
 * discrete add / delete actions and persist immediately.
 */
export function AvailabilityTab() {
  const { data, isLoading, error } = useAvailability();
  const saveAvailability = useSaveAvailability();
  const upsertOverride = useUpsertOverride();
  const deleteOverride = useDeleteOverride();
  const { toast } = useToast();

  const [week, setWeek] = useState<WeekState>(emptyWeek);
  const [timezone, setTimezone] = useState('');
  // Last persisted state, for the dirty check and for Discard.
  const [savedWeek, setSavedWeek] = useState<WeekState>(emptyWeek);
  const [savedTimezone, setSavedTimezone] = useState('');
  // The add-override modal is opened from the action bar.
  const [addingOverride, setAddingOverride] = useState(false);

  const initialized = useRef(false);
  // Tracked in state as well as the ref so the first paint can be held back.
  // The ref alone cannot do that: mutating it does not re-render.
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!data || initialized.current) return;
    initialized.current = true;

    const loadedWeek = weekFromRules(data.rules || []);
    const loadedTimezone = data.timezone || getDefaultTimezone();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeek(loadedWeek);
    setSavedWeek(loadedWeek);
    setTimezone(loadedTimezone);
    setSavedTimezone(loadedTimezone);
     
    setSeeded(true);
  }, [data]);

  if (error) {
    return <ErrorState title="Error loading availability" description={error.message} />;
  }

  if (isLoading) {
    return <AvailabilitySkeleton />;
  }

  if (!data) {
    return <ErrorState title="No data" description="Could not load availability settings." />;
  }

  // Data has arrived but the form has not taken its values yet. Holding one
  // more frame stops every day's switch animating itself on, which read as the
  // page turning the MC's availability on in front of them.
  //
  // Ordered after the error and no-data branches on purpose: `seeded` only
  // flips once the effect has something to seed from, so gating on it earlier
  // would leave a skeleton on screen forever whenever the query fails.
  if (!seeded) {
    return <AvailabilitySkeleton />;
  }

  const dirty = !isSameWeek(week, savedWeek) || timezone !== savedTimezone;

  const handleSave = async () => {
    try {
      await saveAvailability.mutateAsync({
        rules: rulesFromWeek(week),
        timezone,
      });
      setSavedWeek(week);
      setSavedTimezone(timezone);
      toast('Availability saved');
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Could not save availability',
        'error',
      );
    }
  };

  const handleDiscard = () => {
    setWeek(savedWeek);
    setTimezone(savedTimezone);
  };

  return (
    <div className="space-y-6">
      <AvailabilityHeader
        timezone={timezone}
        onTimezoneChange={setTimezone}
        onAddOverride={() => setAddingOverride(true)}
        addingOverride={addingOverride}
        dirty={dirty}
        onDiscard={handleDiscard}
        onSave={handleSave}
        saving={saveAvailability.isPending}
      />

      <AvailabilityWeeklyHours
        week={week}
        onWeekChange={setWeek}
        timezone={timezone}
      />

      <AvailabilityOverrides
        overrides={(data.overrides || []).map((o) => ({
          // Normalize DB times (HH:MM:SS) to HH:mm, preserving null for blocks.
          ...o,
          start_time: o.start_time ? o.start_time.slice(0, 5) : null,
          end_time: o.end_time ? o.end_time.slice(0, 5) : null,
        }))}
        onDeleteOverride={async (date) => {
          try {
            await deleteOverride.mutateAsync(date);
            toast('Override removed');
          } catch (err) {
            toast(
              err instanceof Error ? err.message : 'Could not remove override',
              'error',
            );
          }
        }}
      />

      <AvailabilityOverrideModal
        isOpen={addingOverride}
        onClose={() => setAddingOverride(false)}
        onSave={async (override) => {
          setAddingOverride(false);
          try {
            await upsertOverride.mutateAsync(override);
            toast('Override added');
          } catch (err) {
            toast(
              err instanceof Error ? err.message : 'Could not add override',
              'error',
            );
          }
        }}
      />
    </div>
  );
}

/**
 * Browser-detected IANA timezone, used to seed the picker before the MC
 * has ever saved one. Falls back to UTC if detection fails.
 */
function getDefaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Etc/UTC';
  }
}
