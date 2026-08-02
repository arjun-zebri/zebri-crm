import { describe, expect, it } from 'vitest';

import {
  DURATION_STEP_MINUTES,
  formatDurationInput,
  parseDurationInput,
  stepDurationMinutes,
} from '@/lib/time-tracking/duration';

describe('parseDurationInput', () => {
  it('reads a bare number as minutes', () => {
    expect(parseDurationInput('90')).toBe(90);
    expect(parseDurationInput('45')).toBe(45);
  });

  it('reads the format the field itself renders', () => {
    expect(parseDurationInput('1h 30m')).toBe(90);
    expect(parseDurationInput('2h')).toBe(120);
    expect(parseDurationInput('45m')).toBe(45);
  });

  it('tolerates the shorthand people actually type', () => {
    expect(parseDurationInput('1h30')).toBe(90);
    expect(parseDurationInput('1H 30M')).toBe(90);
    expect(parseDurationInput('  1h   30m  ')).toBe(90);
    expect(parseDurationInput('1hr 30min')).toBe(90);
  });

  it('reads clock notation', () => {
    expect(parseDurationInput('1:30')).toBe(90);
    expect(parseDurationInput('0:20')).toBe(20);
    expect(parseDurationInput('12:05')).toBe(725);
  });

  it('reads decimal hours', () => {
    expect(parseDurationInput('1.5h')).toBe(90);
    expect(parseDurationInput('0.25h')).toBe(15);
  });

  it('rejects anything that is not a duration', () => {
    expect(parseDurationInput('')).toBeNull();
    expect(parseDurationInput('   ')).toBeNull();
    expect(parseDurationInput('abc')).toBeNull();
    expect(parseDurationInput('1h 30x')).toBeNull();
    expect(parseDurationInput('-30')).toBeNull();
  });

  it('rejects a zero-length session, which is not a session', () => {
    expect(parseDurationInput('0')).toBeNull();
    expect(parseDurationInput('0m')).toBeNull();
    expect(parseDurationInput('0:00')).toBeNull();
  });

  it('rejects clock notation with impossible minutes', () => {
    expect(parseDurationInput('1:60')).toBeNull();
    expect(parseDurationInput('1:99')).toBeNull();
  });

  it('round-trips whatever it formats', () => {
    for (const minutes of [15, 45, 60, 90, 125, 480, 1445]) {
      expect(parseDurationInput(formatDurationInput(minutes))).toBe(minutes);
    }
  });
});

describe('formatDurationInput', () => {
  it('writes minutes under the hour', () => {
    expect(formatDurationInput(45)).toBe('45m');
    expect(formatDurationInput(5)).toBe('5m');
  });

  it('drops a zero minute part', () => {
    expect(formatDurationInput(60)).toBe('1h');
    expect(formatDurationInput(120)).toBe('2h');
  });

  it('writes both parts when both are present', () => {
    expect(formatDurationInput(90)).toBe('1h 30m');
    expect(formatDurationInput(125)).toBe('2h 5m');
  });

  it('stays in hours past a day rather than inventing a day unit', () => {
    expect(formatDurationInput(1500)).toBe('25h');
  });
});

describe('stepDurationMinutes', () => {
  it('steps by the quarter hour when already on the grid', () => {
    expect(stepDurationMinutes(90, 1)).toBe(90 + DURATION_STEP_MINUTES);
    expect(stepDurationMinutes(90, -1)).toBe(90 - DURATION_STEP_MINUTES);
  });

  it('snaps an off-grid value onto the grid rather than keeping the offset', () => {
    expect(stepDurationMinutes(95, 1)).toBe(105);
    expect(stepDurationMinutes(95, -1)).toBe(90);
    expect(stepDurationMinutes(1, 1)).toBe(15);
    expect(stepDurationMinutes(29, -1)).toBe(15);
  });

  it('never steps below one quarter hour', () => {
    expect(stepDurationMinutes(15, -1)).toBe(15);
    expect(stepDurationMinutes(10, -1)).toBe(15);
    expect(stepDurationMinutes(0, -1)).toBe(15);
  });
});
