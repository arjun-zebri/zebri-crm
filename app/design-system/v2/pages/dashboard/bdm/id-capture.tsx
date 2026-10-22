'use client';

import { useCallback, useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { GlobeIcon, IdCardIcon, LandmarkIcon, type ZebriIcon } from '@/components/ui-v2/icons';

import { QuestionField } from '../questionnaires/fields/question-field';
import { answerText, type Answer, type Question } from '../questionnaires/questionnaire-data';

import { IdPhotoAsk, IdPhotoReading } from './id-photo';
import { ID_TYPES } from './reference';

/**
 * A person's ID on the couple's form, as a premium app asks for one
 * (user, 2026-10-15) rather than as a list of numbers to copy out: pick
 * the document on a card, photograph it (`id-photo.tsx`), and the
 * details it carries are read off it and set out to check, each still a
 * field to correct. Typing them in stays a link away. How far they got is
 * kept with the answers (`<who>.idPhoto`: read or typed), so the step
 * reopens where it was. Demo only: the read is pretend, the details made
 * up from what the form already knows.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/id-capture
 */

export interface IdCaptureProps {
  /** Whose ID: "p1" or "p2". */
  who: string;
  /** The ID part's questions under its heading: the choice, then its details. */
  questions: Question[];
  answers: Record<string, Answer>;
  onAnswer: (id: string, a: Answer) => void;
  problems?: Record<string, string> | undefined;
}

/** The documents on cards, each with its glyph and a line saying which it is. */
const DOCS: { type: (typeof ID_TYPES)[number]; icon: ZebriIcon; line: string; name: string }[] = [
  { type: ID_TYPES[0], icon: LandmarkIcon, line: 'Issued by a state registry', name: 'birth certificate' },
  { type: ID_TYPES[1], icon: IdCardIcon, line: 'Current, or expired under two years', name: 'passport' },
  { type: ID_TYPES[2], icon: GlobeIcon, line: 'From the country that issued it', name: 'passport' },
];

/** Six digits that stay the same for a person, so a retake reads the same. */
const digits = (seed: string) => String([...seed].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 900000, 7) + 100000);

/** What the pretend read finds on the document. */
function readOff(who: string, type: string, a: Record<string, Answer>): Record<string, Answer> {
  const seed = `${answerText(a[`${who}.givenName`])}${answerText(a[`${who}.familyName`])}`;
  const born = answerText(a[`${who}.birthCountry`]);
  if (type === ID_TYPES[0]) {
    const year = answerText(a[`${who}.dob`]).slice(0, 4) || '1994';
    return { [`${who}.idCertYear`]: year, [`${who}.idCertNumber`]: `${year}/0${digits(seed).slice(0, 5)}` };
  }
  if (type === ID_TYPES[1]) return { [`${who}.idPassportNumber`]: `PA${digits(seed)}1` };
  return { [`${who}.idPassportCountry`]: born && born !== 'Australia' ? born : 'New Zealand', [`${who}.idPassportNumber`]: `LA${digits(seed)}` };
}

/** The ID step. See {@link IdCaptureProps}. */
export function IdCapture({ who, questions, answers, onAnswer, problems }: IdCaptureProps) {
  const type = answerText(answers[`${who}.id`]);
  const doc = DOCS.find((d) => d.type === type);
  const stage = answerText(answers[`${who}.idPhoto`]);
  // The photo lives only in this browser, for as long as the step is open.
  const [photo, setPhoto] = useState<string | null>(null);
  const details = questions.filter((q) => q.id !== `${who}.id`);
  const pick = (next: string) => {
    onAnswer(`${who}.id`, next);
    onAnswer(`${who}.idPhoto`, '');
    setPhoto(null);
  };
  const onRead = useCallback(() => {
    Object.entries(readOff(who, type, answers)).forEach(([id, a]) => onAnswer(id, a));
    onAnswer(`${who}.idPhoto`, 'read');
  }, [who, type, answers, onAnswer]);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="type-label text-zebra-900">Which ID will you show?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {DOCS.map((d) => (
            <ChoiceCard key={d.type} selected={type === d.type} onClick={() => pick(d.type)}>
              <span className="flex flex-col gap-2">
                <d.icon aria-hidden="true" className="size-5 text-zebra-500" />
                <span className="type-label">{d.type}</span>
                <span className="type-body text-zebra-500">{d.line}</span>
              </span>
            </ChoiceCard>
          ))}
        </div>
        {type === ID_TYPES[3] ? (
          <p className="rounded-panel bg-zebra-50 p-4 type-body text-zebra-700">No problem. Your celebrant will talk you through what else they can accept.</p>
        ) : (
          <Button variant="text" onClick={() => pick(ID_TYPES[3])}>
            I do not have any of these
          </Button>
        )}
      </div>
      {!doc ? null : stage === 'read' || stage === 'typed' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-panel bg-zebra-50 p-3">
            {photo && stage === 'read' ? (
              // An object URL of the couple's own photo: next/image cannot take it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={`Your ${doc.name}`} className="h-12 w-auto shrink-0 rounded-check object-cover ring-1 ring-hairline" />
            ) : (
              <IdCardIcon aria-hidden="true" className="size-5 shrink-0 text-zebra-500" />
            )}
            <p className="min-w-0 flex-1 type-body text-zebra-700">
              {stage === 'read' ? `Read from your photo. Check each one against your ${doc.name}.` : `Enter them as they appear on your ${doc.name}.`}
            </p>
            <Button
              variant="text"
              onClick={() => {
                setPhoto(null);
                onAnswer(`${who}.idPhoto`, '');
              }}
            >
              {stage === 'read' ? 'Retake' : 'Take a photo instead'}
            </Button>
          </div>
          <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2">
            {details.map((q) => (
              <QuestionField key={q.id} boxed question={q} value={answers[q.id]} onChange={(a) => onAnswer(q.id, a)} error={problems?.[q.id]} />
            ))}
          </div>
        </div>
      ) : photo ? (
        <IdPhotoReading url={photo} doc={doc.name} onRead={onRead} />
      ) : (
        <IdPhotoAsk doc={doc.name} onPhoto={setPhoto} onType={() => onAnswer(`${who}.idPhoto`, 'typed')} />
      )}
    </div>
  );
}
