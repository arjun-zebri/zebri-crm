'use client';

import { Checkbox } from '@/components/ui-v2/checkbox';
import { DateField, formatDate } from '@/components/ui-v2/date-field';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { GroupLabel } from '@/components/ui-v2/group-label';
import { CheckIcon, MinusIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';

import { answerText, type Answer } from '../questionnaires/questionnaire-data';
import { ReadBack } from '../questionnaires/read-back';

import { done, fullLabel, valueOf, type Check, type CheckGroup } from './checks';
import { PaperCard } from './paper-card';

/**
 * The celebrant's own checks in the paperwork dialog, a group a card
 * (`PaperCard`, as the couple's answers are), each with how many are
 * done. Rebuilt 2026-10-15 (the user: "this UI isnt premium either"):
 * ticks, grey chips, icon-led lines with no names and a list of
 * problems at the foot were four looks in one list, and "asodjas" said
 * nothing about being a street. Now two: what they saw happen is a
 * column of ticks, and anything with a value (who witnessed, the day it
 * came, the venue's address) is a ledger row with its name, as every
 * form field in the app is, a problem the Registry would refuse in red
 * under its own field. Who witnessed a signature finishes its tick's
 * line ("Signed the notice, witnessed by Authorised celebrant"), and
 * fields that belong to someone sit under their name ("First witness"). Once lodged they are what the Registry has, so
 * they read back: a tick or a dash beside each thing, then the values
 * on the read-back grid.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/check-groups
 */

export interface CheckGroupsProps {
  groups: CheckGroup[];
  values: Record<string, Answer>;
  onChange: (id: string, value: Answer) => void;
  /** What the Registry would refuse, by check id. */
  problems?: Record<string, string> | undefined;
  /** Lodged: read back, not edited. */
  locked?: boolean | undefined;
}

/** The checks. See {@link CheckGroupsProps}. */
export function CheckGroups({ groups, values, onChange, problems = {}, locked = false }: CheckGroupsProps) {
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const ticks = g.checks.filter((c) => c.kind === 'tick');
        // Who witnessed the signature finishes "Signed the notice" in place: a row of its own sat a column's width from its value.
        const witness = g.checks.find((c) => c.id.endsWith('.witness'));
        const fields = g.checks.filter((c) => c.kind !== 'tick' && c !== witness);
        return (
          <PaperCard
            key={g.title}
            title={g.title}
            glyph={g.glyph}
            // A pick from a list always has its answer (the celebrant witnesses, nearly always), so only what can be missing counts.
            done={g.checks.filter((c) => c.kind !== 'select' && done(values, c)).length}
            of={g.checks.filter((c) => c.kind !== 'select').length}
            flagged={g.checks.filter((c) => problems[c.id]).length}
          >
            {g.note ? <p className="max-w-xl type-body text-zebra-500">{g.note}</p> : null}
            {ticks.length ? (
              <ul className="space-y-2.5">
                {ticks.map((c) =>
                  locked ? (
                    <TickBack key={c.id} check={c} values={values} />
                  ) : (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-1.5">
                      <Checkbox label={c.label} checked={answerText(values[c.id]) === 'Yes'} onChange={(e) => onChange(c.id, e.target.checked ? 'Yes' : '')} />
                      {witness && c.id.endsWith('.signedNotice') ? (
                        <>
                          <span className="type-body text-zebra-500">witnessed by</span>
                          <Dropdown
                            inline
                            label="Witnessed by"
                            options={(witness.options ?? []).map((o) => ({ value: o, label: o }))}
                            value={valueOf(values, witness)}
                            onChange={(v) => onChange(witness.id, v)}
                          />
                        </>
                      ) : null}
                    </li>
                  ),
                )}
              </ul>
            ) : null}
            {fields.length ? (
              locked ? (
                <ReadBack rows={[...fields, ...(witness ? [witness] : [])].map((c) => [fullLabel(c), c.kind === 'date' ? formatDate(valueOf(values, c)) : valueOf(values, c)] as const)} />
              ) : (
                <div className="space-y-0.5">
                  {fields.map((c, i) => (
                    <div key={c.id}>
                      {/* A part's small heading over its first field ("First witness"), so the names under it stay short. */}
                      {c.part && c.part !== fields[i - 1]?.part ? (
                        <GroupLabel as="p" className="pt-3 pb-1">
                          {c.part}
                        </GroupLabel>
                      ) : null}
                      <CheckRow check={c} value={valueOf(values, c)} error={problems[c.id]} onChange={(v) => onChange(c.id, v)} />
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </PaperCard>
        );
      })}
    </div>
  );
}

/** A check with a value, as a ledger row. */
function CheckRow({ check: c, value, error, onChange }: { check: Check; value: string; error: string | undefined; onChange: (v: Answer) => void }) {
  if (c.kind === 'date') return <DateField row label={c.label} value={value} onChange={onChange} error={error} />;
  if (c.kind === 'select')
    return (
      <div>
        <Dropdown row label={c.label} options={(c.options ?? []).map((o) => ({ value: o, label: o }))} value={value} onChange={onChange} />
        {/* Under the value column: the name column's 9.5rem and the row's 1rem gap, as answer rows do. */}
        {error ? (
          <p role="alert" className="type-body text-danger sm:pl-[10.5rem]">
            {error}
          </p>
        ) : null}
      </div>
    );
  return <Input row label={c.label} value={value} error={error} onChange={(e) => onChange(e.target.value)} />;
}

/** A tick read back once lodged: a tick and what was done, or a dash for what was not. */
function TickBack({ check: c, values }: { check: Check; values: Record<string, Answer> }) {
  const yes = answerText(values[c.id]) === 'Yes';
  const Icon = yes ? CheckIcon : MinusIcon;
  return (
    <li className="flex items-center gap-2 type-body">
      <Icon aria-hidden="true" className={`size-4 shrink-0 ${yes ? 'text-grass-800' : 'text-zebra-400'}`} />
      <span className={yes ? 'text-zebra-950' : 'text-zebra-500'}>{c.label}</span>
      <span className="sr-only">{yes ? ', done' : ', not done'}</span>
    </li>
  );
}
