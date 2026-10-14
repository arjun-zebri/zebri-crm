/**
 * Booking form questions - submit_booking answer validation and mapping.
 *
 * `submit_booking` is anon-callable, so the SQL re-applies the rules that
 * `validateAnswers` (lib/booking/questions.ts) applies in the app. These tests
 * drive the RPC through the anon client, as the public route does, and prove
 * that a hostile or stale client cannot store answers the MC did not define.
 */
import { afterAll, describe, expect, it } from 'vitest';

import type { Json } from '@/types/database';

import {
  anonClient,
  createTestUser,
  serviceClient,
  type TestUser,
} from '../helpers/supabase';

const pro = {
  account_type: 'vendor',
  subscription_status: 'active',
  subscription_plan: 'pro',
};

type Question = { [key: string]: Json };

const cleanupQueue: Array<() => Promise<void>> = [];
afterAll(async () => {
  await Promise.all(cleanupQueue.map((fn) => fn().catch(() => undefined)));
});

/** Create an MC with one meeting type carrying the given questions. */
async function arrange(opts: {
  questions?: Question[];
  phoneField?: 'hidden' | 'optional' | 'required';
  active?: boolean;
} = {}): Promise<{ user: TestUser; token: string; typeId: string }> {
  const user = await createTestUser({}, pro);
  cleanupQueue.push(user.cleanup);

  const { data, error } = await serviceClient()
    .from('meeting_types')
    .insert({
      user_id: user.id,
      name: 'Consultation',
      duration_minutes: 30,
      location_type: 'video',
      active: opts.active !== false,
      questions: opts.questions ?? [],
      phone_field: opts.phoneField ?? 'optional',
    })
    .select('id, share_token')
    .single();
  if (error || !data) throw new Error(`meeting_type insert failed: ${error?.message}`);

  return {
    user,
    token: data.share_token as string,
    typeId: data.id as string,
  };
}

/** A slot far enough in the future to never collide with another test. */
function slot(hoursAhead = 48) {
  const starts = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const ends = new Date(starts.getTime() + 30 * 60 * 1000);
  return { starts: starts.toISOString(), ends: ends.toISOString() };
}

/** Call submit_booking as the public route does, with sensible defaults. */
async function submit(
  token: string,
  overrides: {
    email?: string;
    phone?: string | null;
    notes?: string | null;
    answers?: unknown;
    hoursAhead?: number;
  } = {},
) {
  const { starts, ends } = slot(overrides.hoursAhead);
  const { data, error } = await anonClient().rpc('submit_booking', {
    token,
    p_starts_at: starts,
    p_ends_at: ends,
    p_timezone: 'Australia/Sydney',
    p_name: 'Jamie Lee',
    p_email: overrides.email ?? `booker-${crypto.randomUUID()}@example.test`,
    // The generated RPC types say optional string; null is the real wire value.
    p_phone: (overrides.phone === undefined ? '+61 400 000 000' : overrides.phone) as string,
    p_notes: (overrides.notes ?? null) as string,
    // `unknown` on purpose: the RPC must cope with anything the wire can carry.
    ...(overrides.answers === undefined ? {} : { p_answers: overrides.answers as Json }),
  });
  if (error) throw new Error(`submit_booking failed: ${error.message}`);
  return data as {
    ok?: boolean;
    error?: string;
    booking_id?: string;
    couple_id?: string | null;
  };
}

/** Count bookings for a user, bypassing RLS. */
async function bookingCount(userId: string): Promise<number> {
  const { count } = await serviceClient()
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count ?? 0;
}

/** Read a booking's stored answers. */
async function storedAnswers(bookingId: string) {
  const { data } = await serviceClient()
    .from('bookings')
    .select('answers, partner_name')
    .eq('id', bookingId)
    .single();
  return data as { answers: Array<Record<string, unknown>>; partner_name: string | null };
}

const shortText = (id: string, extra: Question = {}): Question => ({
  id,
  label: `Label ${id}`,
  type: 'short_text',
  required: false,
  ...extra,
});

describe('submit_booking - required questions', () => {
  it('rejects a booking that leaves a required question unanswered', async () => {
    const arr = await arrange({
      questions: [shortText('company', { required: true, label: 'Company' })],
    });

    const result = await submit(arr.token, { answers: [] });
    expect(result.error).toBe('invalid');
    expect(await bookingCount(arr.user.id)).toBe(0);
  });

  it('treats a whitespace-only answer to a required question as missing', async () => {
    const arr = await arrange({
      questions: [shortText('company', { required: true, label: 'Company' })],
    });

    const result = await submit(arr.token, {
      answers: [{ question_id: 'company', value: '   ' }],
    });
    expect(result.error).toBe('invalid');
  });

  it('accepts an optional question left blank', async () => {
    const arr = await arrange({ questions: [shortText('company')] });

    const result = await submit(arr.token, { answers: [] });
    expect(result.ok).toBe(true);
    const row = await storedAnswers(result.booking_id!);
    expect(row.answers).toEqual([]);
  });
});

describe('submit_booking - answer values', () => {
  it('filters multi_choice to its options, keeping option order', async () => {
    const arr = await arrange({
      questions: [
        {
          id: 'extras',
          label: 'Extras',
          type: 'multi_choice',
          required: false,
          options: ['Photos', 'Video', 'Flowers'],
        },
      ],
    });

    const result = await submit(arr.token, {
      answers: [{ question_id: 'extras', value: ['Flowers', 'Hacked', 'Photos'] }],
    });
    expect(result.ok).toBe(true);
    const row = await storedAnswers(result.booking_id!);
    expect(row.answers[0]?.value).toEqual(['Photos', 'Flowers']);
  });

  it('treats a multi_choice with no valid picks as unanswered', async () => {
    const arr = await arrange({
      questions: [
        {
          id: 'extras',
          label: 'Extras',
          type: 'multi_choice',
          required: true,
          options: ['Photos', 'Video'],
        },
      ],
    });

    const result = await submit(arr.token, {
      answers: [{ question_id: 'extras', value: ['Nope'] }],
    });
    expect(result.error).toBe('invalid');
  });

  it('rejects a single_choice value that is not one of its options', async () => {
    const arr = await arrange({
      questions: [
        {
          id: 'budget',
          label: 'Budget',
          type: 'single_choice',
          required: false,
          options: ['Under 5k', 'Over 5k'],
        },
      ],
    });

    const result = await submit(arr.token, {
      answers: [{ question_id: 'budget', value: 'Free' }],
    });
    expect(result.error).toBe('invalid');
    expect(await bookingCount(arr.user.id)).toBe(0);
  });

  it('accepts a single_choice value that is one of its options', async () => {
    const arr = await arrange({
      questions: [
        {
          id: 'budget',
          label: 'Budget',
          type: 'single_choice',
          required: false,
          options: ['Under 5k', 'Over 5k'],
        },
      ],
    });

    const result = await submit(arr.token, {
      answers: [{ question_id: 'budget', value: 'Over 5k' }],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a date that is not a real calendar day', async () => {
    const arr = await arrange({
      questions: [{ id: 'when', label: 'When', type: 'date', required: false }],
    });

    const feb30 = await submit(arr.token, {
      answers: [{ question_id: 'when', value: '2030-02-30' }],
    });
    expect(feb30.error).toBe('invalid');

    const wrongShape = await submit(arr.token, {
      answers: [{ question_id: 'when', value: '30/12/2030' }],
    });
    expect(wrongShape.error).toBe('invalid');
  });

  it('accepts a real date', async () => {
    const arr = await arrange({
      questions: [{ id: 'when', label: 'When', type: 'date', required: false }],
    });

    const result = await submit(arr.token, {
      answers: [{ question_id: 'when', value: '2030-02-28' }],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a number that is not numeric', async () => {
    const arr = await arrange({
      questions: [{ id: 'guests', label: 'Guests', type: 'number', required: false }],
    });

    for (const value of ['twelve', '1e3', '12 people']) {
      const result = await submit(arr.token, {
        answers: [{ question_id: 'guests', value }],
      });
      expect(result.error).toBe('invalid');
    }

    const ok = await submit(arr.token, {
      answers: [{ question_id: 'guests', value: '-12.5' }],
    });
    expect(ok.ok).toBe(true);
  });

  it('rejects an answer longer than 2000 characters', async () => {
    const arr = await arrange({
      questions: [{ id: 'story', label: 'Story', type: 'long_text', required: false }],
    });

    const result = await submit(arr.token, {
      answers: [{ question_id: 'story', value: 'a'.repeat(2001) }],
    });
    expect(result.error).toBe('invalid');
  });

  it('trims text answers before storing them', async () => {
    const arr = await arrange({ questions: [shortText('company')] });

    const result = await submit(arr.token, {
      answers: [{ question_id: 'company', value: '  Acme Pty Ltd  ' }],
    });
    expect(result.ok).toBe(true);
    const row = await storedAnswers(result.booking_id!);
    expect(row.answers[0]?.value).toBe('Acme Pty Ltd');
  });
});

describe('submit_booking - answer shape', () => {
  it('takes the label and type from the question, not the input', async () => {
    const arr = await arrange({
      questions: [shortText('company', { label: 'Company name' })],
    });

    const result = await submit(arr.token, {
      answers: [
        {
          question_id: 'company',
          label: 'Forged label',
          type: 'number',
          value: 'Acme',
        },
      ],
    });
    expect(result.ok).toBe(true);
    const row = await storedAnswers(result.booking_id!);
    expect(row.answers).toEqual([
      {
        question_id: 'company',
        label: 'Company name',
        type: 'short_text',
        value: 'Acme',
      },
    ]);
  });

  it('ignores answers for question ids the meeting type does not define', async () => {
    const arr = await arrange({ questions: [shortText('company')] });

    const result = await submit(arr.token, {
      answers: [
        { question_id: 'not_a_question', value: 'smuggled' },
        { question_id: 'company', value: 'Acme' },
      ],
    });
    expect(result.ok).toBe(true);
    const row = await storedAnswers(result.booking_id!);
    expect(row.answers.map((a) => a.question_id)).toEqual(['company']);
  });

  it('treats a non-array answers payload as no answers', async () => {
    const arr = await arrange({ questions: [shortText('company')] });

    const result = await submit(arr.token, { answers: { question_id: 'company', value: 'x' } });
    expect(result.ok).toBe(true);
    const row = await storedAnswers(result.booking_id!);
    expect(row.answers).toEqual([]);
  });

  it('rejects more than 50 answers', async () => {
    const arr = await arrange({ questions: [shortText('company')] });

    const answers = Array.from({ length: 51 }, (_, i) => ({
      question_id: `junk_${i}`,
      value: 'x',
    }));
    const result = await submit(arr.token, { answers });
    expect(result.error).toBe('invalid');
  });
});

describe('submit_booking - mapped questions and couple notes', () => {
  it('fills couple secondary_name, event_date and venue, and bookings.partner_name', async () => {
    const arr = await arrange({
      questions: [
        shortText('partner', { label: "Partner's name", maps_to: 'partner_name' }),
        { id: 'wedding', label: 'Wedding date', type: 'date', required: false, maps_to: 'event_date' },
        shortText('venue', { label: 'Venue', maps_to: 'venue' }),
      ],
    });

    const result = await submit(arr.token, {
      answers: [
        { question_id: 'partner', value: 'Sam Rivers' },
        { question_id: 'wedding', value: '2030-06-14' },
        { question_id: 'venue', value: 'Cockatoo Island' },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.couple_id).toBeTruthy();

    const admin = serviceClient();
    const { data: couple } = await admin
      .from('couples')
      .select('secondary_name, event_date, venue, notes')
      .eq('id', result.couple_id!)
      .single();
    expect(couple?.secondary_name).toBe('Sam Rivers');
    expect(couple?.event_date).toBe('2030-06-14');
    expect(couple?.venue).toBe('Cockatoo Island');
    // Mapped answers land in their own fields, not in notes.
    expect(couple?.notes).toBeNull();

    const row = await storedAnswers(result.booking_id!);
    expect(row.partner_name).toBe('Sam Rivers');
    expect(row.answers).toHaveLength(3);
  });

  it('ignores a mapping whose question type cannot fill that field', async () => {
    // A number cannot fill event_date; the answer falls through to notes.
    const arr = await arrange({
      questions: [
        { id: 'bad', label: 'Guests', type: 'number', required: false, maps_to: 'event_date' },
      ],
    });

    const result = await submit(arr.token, {
      answers: [{ question_id: 'bad', value: '120' }],
    });
    expect(result.ok).toBe(true);
    const { data: couple } = await serviceClient()
      .from('couples')
      .select('event_date, notes')
      .eq('id', result.couple_id!)
      .single();
    expect(couple?.event_date).toBeNull();
    expect(couple?.notes).toBe('Guests: 120');
  });

  it('folds unmapped answers into the new couple notes after the booker message', async () => {
    const arr = await arrange({
      questions: [
        shortText('company', { label: 'Company' }),
        {
          id: 'extras',
          label: 'Extras',
          type: 'multi_choice',
          required: false,
          options: ['Photos', 'Video'],
        },
      ],
    });

    const result = await submit(arr.token, {
      notes: 'Looking for a quote',
      answers: [
        { question_id: 'company', value: 'Acme' },
        { question_id: 'extras', value: ['Photos', 'Video'] },
      ],
    });
    expect(result.ok).toBe(true);
    const { data: couple } = await serviceClient()
      .from('couples')
      .select('notes')
      .eq('id', result.couple_id!)
      .single();
    expect(couple?.notes).toBe('Looking for a quote\nCompany: Acme\nExtras: Photos, Video');
  });

  it('does not write answers into an existing couple record', async () => {
    const arr = await arrange({
      questions: [shortText('partner', { label: "Partner's name", maps_to: 'partner_name' })],
    });
    const email = 'existing@example.test';
    const { data: existing } = await serviceClient()
      .from('couples')
      .insert({
        user_id: arr.user.id,
        name: 'Existing',
        primary_name: 'Alex',
        primary_email: email,
        status: 'new',
      })
      .select('id, secondary_name')
      .single();

    const result = await submit(arr.token, {
      email,
      answers: [{ question_id: 'partner', value: 'New Partner' }],
    });
    expect(result.couple_id).toBe(existing!.id);

    const { data: couple } = await serviceClient()
      .from('couples')
      .select('secondary_name')
      .eq('id', existing!.id)
      .single();
    expect(couple?.secondary_name).toBeNull();

    // The answer is still kept on the booking itself.
    const row = await storedAnswers(result.booking_id!);
    expect(row.partner_name).toBe('New Partner');
  });
});

describe('submit_booking - phone mode', () => {
  it('rejects a blank phone when the phone field is required', async () => {
    const arr = await arrange({ phoneField: 'required' });

    const blank = await submit(arr.token, { phone: '   ' });
    expect(blank.error).toBe('invalid');

    const missing = await submit(arr.token, { phone: null });
    expect(missing.error).toBe('invalid');
    expect(await bookingCount(arr.user.id)).toBe(0);
  });

  it('stores the phone when the phone field is required and filled', async () => {
    const arr = await arrange({ phoneField: 'required' });

    const result = await submit(arr.token, { phone: '+61 411 222 333' });
    expect(result.ok).toBe(true);
    const { data } = await serviceClient()
      .from('bookings')
      .select('phone')
      .eq('id', result.booking_id!)
      .single();
    expect(data?.phone).toBe('+61 411 222 333');
  });

  it('drops the phone when the phone field is hidden', async () => {
    const arr = await arrange({ phoneField: 'hidden' });

    const result = await submit(arr.token, { phone: '+61 411 222 333' });
    expect(result.ok).toBe(true);
    const { data } = await serviceClient()
      .from('bookings')
      .select('phone')
      .eq('id', result.booking_id!)
      .single();
    expect(data?.phone).toBeNull();
  });

  it('accepts a blank phone when the phone field is optional', async () => {
    const arr = await arrange({ phoneField: 'optional' });

    const result = await submit(arr.token, { phone: null });
    expect(result.ok).toBe(true);
  });
});

describe('get_public_booking_page - questions and phone mode', () => {
  it('returns the questions and phone_field for an active token', async () => {
    const questions = [shortText('partner', { label: "Partner's name", maps_to: 'partner_name' })];
    const arr = await arrange({ questions, phoneField: 'required' });

    const { data, error } = await anonClient().rpc('get_public_booking_page', {
      token: arr.token,
    });
    expect(error).toBeNull();
    const page = data as unknown as { questions: Question[]; phone_field: string };
    expect(page.phone_field).toBe('required');
    expect(page.questions).toEqual(questions);
  });

  it('defaults a meeting type with no questions to an empty list and optional phone', async () => {
    const arr = await arrange();

    const { data } = await anonClient().rpc('get_public_booking_page', {
      token: arr.token,
    });
    const page = data as unknown as { questions: unknown[]; phone_field: string };
    expect(page.questions).toEqual([]);
    expect(page.phone_field).toBe('optional');
  });
});
