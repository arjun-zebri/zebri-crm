'use client';

/**
 * Settings → Account → the morning digest switch.
 *
 * Everything the workflow engine does is invisible until somebody logs
 * in, which is the wrong default for a product whose promise is "you
 * will not forget anything". This is the one email Zebri sends the MC
 * about their own day.
 *
 * It lives on `user_public_settings` rather than in `user_metadata`
 * because the cron reads it with the service-role client across every
 * user at once, and a metadata read would mean one auth-admin call per
 * MC per hour.
 *
 * @module app/(dashboard)/settings/daily-digest-card
 */

import { useEffect, useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { Toggle } from '@/components/ui/toggle';
import { createClient } from '@/lib/supabase/client';
import { DIGEST_LOCAL_HOUR } from '@/lib/workflows/digest';

import { AutoSaveStatus, type SaveState } from './auto-save-status';

/** The morning digest switch. */
export function DailyDigestCard() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_public_settings')
        .select('daily_digest_enabled')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setEnabled(data?.daily_digest_enabled ?? true);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: boolean) {
    setSaveState('saving');
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaveState('error');
      return;
    }
    // Upsert, not update: an MC who has never opened another setting has
    // no row yet, and a silent no-op would leave the switch lying.
    const { error } = await supabase
      .from('user_public_settings')
      .upsert({ user_id: user.id, daily_digest_enabled: next }, { onConflict: 'user_id' });
    setSaveState(error ? 'error' : 'saved');
    if (error) toast(error.message, 'error');
  }

  return (
    <section className="border-t border-border pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-body font-medium text-text">Your morning digest</h3>
        <AutoSaveStatus state={saveState} />
      </div>
      <Toggle
        checked={enabled}
        disabled={!loaded}
        onChange={(next) => {
          setEnabled(next);
          void save(next);
        }}
        label={`Email me at ${DIGEST_LOCAL_HOUR}am with what is due`}
        description="Overdue work, what is due today, anything waiting for your OK, and what will send by itself. Only on days there is something to see, so an empty inbox means an empty list."
      />
    </section>
  );
}
