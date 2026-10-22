import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Paperwork } from '@/app/design-system/v2/pages/dashboard/bdm/bdm-data';
import { demoAnswers, SEEDS } from '@/app/design-system/v2/pages/dashboard/bdm/bdm-seeds';
import { usePaperwork } from '@/app/design-system/v2/pages/dashboard/bdm/bdm-store';
import { coupleChecks } from '@/app/design-system/v2/pages/dashboard/bdm/couple-checks';
import { useCoupleFormReturns } from '@/app/design-system/v2/pages/dashboard/bdm/couple-form-link';
import { formParts, withPrefillNotes } from '@/app/design-system/v2/pages/dashboard/bdm/couple-form-parts';
import { formQuestions, missing, prefill, withLinked } from '@/app/design-system/v2/pages/dashboard/bdm/noim-questions';

/**
 * The couple's form as they fill it in: the country asked only of those
 * who live abroad, each person's parts under their name, the parts named and
 * grouped for the rail, and names filled in from the booking flagged.
 */

const base = SEEDS[0]!;
const paper = (answers: Paperwork['answers'], names: [string, string] = ['Arjun Punekar', 'Priya Shah']): Paperwork => ({ ...base, names, answers });
const ids = (p: Paperwork) => formQuestions(p).map((q) => q.id);

describe('the home address', () => {
  it('asks no country of someone living in Australia, and offers the way out under the postcode', () => {
    const p = paper({ 'p1.addrCountry': 'Australia' });
    expect(ids(p)).not.toContain('p1.addrCountry');
    expect(ids(p)).toContain('p1.addrLine1');
    expect(formQuestions(p).find((q) => q.id === 'p1.addrPostcode')?.reveal?.label).toBe('I live outside Australia');
  });

  it('asks the country once they say they live abroad, and the full address once it is not Australia', () => {
    const away = paper({ 'p1.livesAbroad': 'Yes', 'p1.addrCountry': 'New Zealand' });
    expect(ids(away)).toContain('p1.addrCountry');
    expect(ids(away)).toContain('p1.addrIntl');
    expect(ids(away)).not.toContain('p1.addrLine1');
    expect(formQuestions(away).find((q) => q.id === 'p1.addrPostcode')).toBeUndefined();
  });

  it('copies living abroad to a partner who shares the home', () => {
    const linked = withLinked('p1.livesAbroad', 'Yes', { 'p2.sameAddress': 'Yes' });
    expect(linked['p2.livesAbroad']).toBe('Yes');
  });
});

describe('headings', () => {
  it('heads each person\'s parts by first name', () => {
    const titles = formQuestions(paper({})).filter((q) => q.type === 'section').map((q) => q.label);
    expect(titles.slice(0, 5)).toEqual(["Arjun's details", "Arjun's parent 1", "Arjun's parent 2", "Arjun's ID", "Priya's details"]);
  });

  it('names an unnamed second partner by the first', () => {
    const titles = formQuestions(paper({}, ['Arjun Punekar', ''])).filter((q) => q.type === 'section').map((q) => q.label);
    expect(titles).toContain("Arjun's partner's details");
  });
});

describe('formParts', () => {
  it('names each part and groups it by whose it is, done once nothing is missing', () => {
    const p = paper({});
    const parts = formParts(p, formQuestions(p), {});
    expect(parts.map((x) => `${x.group}: ${x.label}`)).toEqual([
      'Arjun: Details', 'Arjun: Parent 1', 'Arjun: Parent 2', 'Arjun: ID',
      'Priya: Details', 'Priya: Parent 1', 'Priya: Parent 2', 'Priya: ID',
      'Together: The two of you',
    ]);
    expect(parts.some((x) => x.done)).toBe(false);
  });
});

describe('withPrefillNotes', () => {
  it('notes names filled in from the booking under the heading, and drops it once they change them', () => {
    const p = paper(prefill(['Arjun Punekar', 'Priya Shah']));
    const head = (q: ReturnType<typeof withPrefillNotes>) => q.find((x) => x.id === 'p1.section')?.help ?? '';
    expect(head(withPrefillNotes(p, formQuestions(p)))).toContain('from your booking');
    const changed = paper({ ...p.answers, 'p1.givenName': 'Arjun', 'p1.familyName': 'Punekar-Rao' });
    expect(head(withPrefillNotes(changed, formQuestions(changed)))).toContain('from your booking');
    const retyped = paper({ 'p1.givenName': 'Arj', 'p1.familyName': 'P' });
    expect(head(withPrefillNotes(retyped, formQuestions(retyped)))).not.toContain('from your booking');
  });
});

describe('demoAnswers', () => {
  it('fills every question the form asks, with nothing the Registry would refuse', () => {
    const p = paper(demoAnswers(['Arjun Punekar', 'Priya Shah']));
    expect(missing(p)).toEqual([]);
    expect(coupleChecks(p).toFix).toEqual([]);
  });
});

describe('useCoupleFormReturns', () => {
  it('applies an answer and the Submit sent back from the couple\'s tab to this tab\'s paperwork', () => {
    const { result } = renderHook(() => {
      useCoupleFormReturns();
      return usePaperwork('Zoe & Liam');
    });
    const send = (change: object) =>
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: 'zebri-v2-couple-form-back', newValue: JSON.stringify(change) }));
      });
    send({ client: 'Zoe & Liam', kind: 'answer', id: 'p1.occupation', answer: 'Pilot', at: 1 });
    expect(result.current?.answers['p1.occupation']).toBe('Pilot');
    send({ client: 'Zoe & Liam', kind: 'submit', at: 2 });
    expect(result.current?.stage).toBe('returned');
  });
});
