'use client';

import { Button } from '@/components/ui-v2/button';
import { CircleDotIcon, CloseIcon, PlusIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

/**
 * The choices of a Pick one, Pick several or dropdown question: a line
 * each, typed straight in, with × to take one away and Add choice under
 * them. Enter on the last choice adds the next, as in a list.
 *
 * @module app/design-system/v2/pages/dashboard/questionnaires/builder/options-editor
 */

export interface OptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
}

/** The choices. See {@link OptionsEditorProps}. */
export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const set = (i: number, v: string) => onChange(options.map((o, j) => (j === i ? v : o)));
  return (
    <div className="space-y-1">
      {options.map((o, i) => (
        <div key={i} className="group flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              wide
              icon={CircleDotIcon}
              label={`Choice ${i + 1}`}
              value={o}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && i === options.length - 1 && (e.preventDefault(), onChange([...options, '']))}
            />
          </div>
          <Button
            variant="ghost"
            square
            aria-label={`Remove choice ${i + 1}`}
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <CloseIcon aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" compact icon={<PlusIcon aria-hidden="true" className="size-4" />} onClick={() => onChange([...options, ''])} className="-ml-2">
        Add choice
      </Button>
    </div>
  );
}
