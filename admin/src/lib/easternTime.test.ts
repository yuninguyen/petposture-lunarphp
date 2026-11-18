import { describe, expect, it } from 'vitest';
import { easternInputToUtcIso, formatEastern, isFutureEasternInput, utcIsoToEasternInput } from './easternTime';

describe('Eastern Time <-> UTC', () => {
  it('turns the planned 10:47 AM on Saturday 21 Nov 2026 (EST, UTC-5) into 15:47 UTC', () => {
    expect(easternInputToUtcIso('2026-11-21T10:47')).toBe('2026-11-21T15:47:00.000Z');
  });

  it('uses the daylight-saving offset (UTC-4) in summer', () => {
    expect(easternInputToUtcIso('2026-07-04T10:47')).toBe('2026-07-04T14:47:00.000Z');
  });

  it('shows a UTC moment as the Eastern wall time, and the two directions agree', () => {
    expect(utcIsoToEasternInput('2026-11-21T15:47:00.000Z')).toBe('2026-11-21T10:47');
    expect(utcIsoToEasternInput('2026-11-14T15:47:11+00:00')).toBe('2026-11-14T10:47');
    expect(utcIsoToEasternInput('2026-07-04T14:47:00Z')).toBe('2026-07-04T10:47');

    for (const input of ['2026-01-15T00:00', '2026-03-08T01:30', '2026-03-08T03:30', '2026-06-30T23:59', '2026-11-01T00:30', '2026-11-01T02:30', '2026-12-31T23:59']) {
      expect(utcIsoToEasternInput(easternInputToUtcIso(input)), input).toBe(input);
    }
  });

  it('is correct around the clocks going forward (8 Mar 2026) and back (1 Nov 2026)', () => {
    expect(easternInputToUtcIso('2026-03-08T01:30')).toBe('2026-03-08T06:30:00.000Z'); // still EST
    expect(easternInputToUtcIso('2026-03-08T03:30')).toBe('2026-03-08T07:30:00.000Z'); // already EDT
    expect(easternInputToUtcIso('2026-03-08T02:30')).toBe('2026-03-08T07:30:00.000Z'); // the skipped hour joins the one after
    expect(easternInputToUtcIso('2026-11-01T01:30')).toBe('2026-11-01T05:30:00.000Z'); // the repeated hour is the first one
    expect(easternInputToUtcIso('2026-11-01T02:30')).toBe('2026-11-01T07:30:00.000Z'); // after the change, EST
  });

  it('gives nothing for an empty or unreadable value', () => {
    expect(easternInputToUtcIso('')).toBeNull();
    expect(easternInputToUtcIso(null)).toBeNull();
    expect(easternInputToUtcIso('not a date')).toBeNull();
    expect(utcIsoToEasternInput('')).toBe('');
    expect(utcIsoToEasternInput(null)).toBe('');
    expect(utcIsoToEasternInput('nonsense')).toBe('');
    expect(formatEastern(null)).toBe('');
  });

  it('writes the time for the list with its zone', () => {
    expect(formatEastern('2026-11-21T15:47:00Z')).toBe('Nov 21, 2026, 10:47 AM EST');
    expect(formatEastern('2026-07-04T14:47:00Z')).toBe('Jul 4, 2026, 10:47 AM EDT');
  });

  it('knows whether a typed Eastern time is still ahead', () => {
    const now = Date.parse('2026-11-21T15:00:00Z'); // 10:00 AM EST

    expect(isFutureEasternInput('2026-11-21T10:47', now)).toBe(true);
    expect(isFutureEasternInput('2026-11-21T09:59', now)).toBe(false);
    expect(isFutureEasternInput('', now)).toBe(false);
  });
});
