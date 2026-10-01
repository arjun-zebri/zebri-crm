'use client';

import { ArrowLeft, FlaskConical, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { Switch } from '@/components/ui-v2/switch';

import { coupleName } from '../../payments/payments-data';
import type { Enrolment, Workflow } from '../model';

/**
 * The builder's chrome, two lines as on every v2 page: back to
 * Workflows, then the name (typed over in place) with the moves on the
 * right. Test with a client puts that client's real dates beside every
 * step; the On switch is the only thing that makes a workflow run. More
 * holds Duplicate and Delete.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/builder/builder-header
 */

/** Clients to test with when nobody is on the workflow yet. */
const SAMPLE: Enrolment[] = [
  { names: ['Sarah', 'Tom'], event: '2026-10-10', at: 0 },
  { names: ['Priya', 'James'], event: '2026-11-07', at: 0 },
  { names: ['Mia', 'Leo'], event: null, at: 0 },
];

export interface BuilderHeaderProps {
  workflow: Workflow;
  testing: Enrolment | null;
  onBack: () => void;
  onRename: (name: string) => void;
  onToggle: (on: boolean) => void;
  onTest: (client: Enrolment | null) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** The builder header. See {@link BuilderHeaderProps}. */
export function BuilderHeader({ workflow: w, testing, onBack, onRename, onToggle, onTest, onDuplicate, onDelete }: BuilderHeaderProps) {
  const [test, setTest] = useState(false);
  const [more, setMore] = useState(false);
  const clients = w.clients.length ? w.clients : SAMPLE;
  return (
    <header className="space-y-3">
      <Button variant="plain" onClick={onBack}>
        <ArrowLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />
        Workflows
      </Button>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <InlineInput aria-label="Workflow name" value={w.name} onChange={(e) => onRename(e.target.value)} className="min-w-0 flex-1 type-title" />
        <div className="flex items-center gap-2">
          <Popover open={test} onOpenChange={setTest}>
            <PopoverTrigger asChild>
              <Button variant="secondary" active={testing !== null}>
                <FlaskConical aria-hidden="true" strokeWidth={1.5} className="size-4" />
                {testing ? `Testing with ${coupleName(testing.names)}` : 'Test with a client'}
              </Button>
            </PopoverTrigger>
            <PopoverContent size="menu" align="end" role="menu" aria-label="Test with a client">
              {clients.map((c) => (
                <MenuOption
                  key={coupleName(c.names)}
                  selected={testing !== null && coupleName(testing.names) === coupleName(c.names)}
                  onSelect={() => {
                    onTest(c);
                    setTest(false);
                  }}
                >
                  {coupleName(c.names)}
                </MenuOption>
              ))}
              {testing ? (
                <MenuOption
                  onSelect={() => {
                    onTest(null);
                    setTest(false);
                  }}
                >
                  <span className="text-zebra-500">Stop testing</span>
                </MenuOption>
              ) : null}
            </PopoverContent>
          </Popover>
          <label className="flex h-8 cursor-pointer items-center gap-2 pl-2 pr-1 type-label text-zebra-950">
            <span>{w.on ? 'On' : 'Off'}</span>
            <Switch checked={w.on} onChange={onToggle} aria-label={`${w.name} ${w.on ? 'on' : 'off'}`} />
          </label>
          <Popover open={more} onOpenChange={setMore}>
            <PopoverTrigger asChild>
              <Button variant="ghost" square aria-label="More">
                <MoreHorizontal aria-hidden="true" strokeWidth={1.5} className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent size="menu" align="end" role="menu" aria-label="More">
              <MenuOption
                onSelect={() => {
                  setMore(false);
                  onDuplicate();
                }}
              >
                Duplicate
              </MenuOption>
              <MenuOption
                onSelect={() => {
                  setMore(false);
                  onDelete();
                }}
              >
                <span className="text-danger">Delete workflow</span>
              </MenuOption>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
