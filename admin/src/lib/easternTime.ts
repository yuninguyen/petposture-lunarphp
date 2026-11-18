// Blog posts are scheduled in US Eastern Time (America/New_York, daylight saving included) and stored in UTC.
// The browser's own time zone is never used, so the same entry means the same moment for everyone on the team.

const ZONE = 'America/New_York';

const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function easternParts(instant: Date) {
  const parts = Object.fromEntries(wallClock.formatToParts(instant).map((part) => [part.type, part.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** How far New York is from UTC at that instant, in milliseconds (negative: behind UTC). */
function offsetAt(instant: Date): number {
  const p = easternParts(instant);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);

  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * "2026-11-21T10:47" typed as Eastern Time -> "2026-11-21T15:47:00.000Z" (UTC), or null when empty or not a date-time.
 * A time that does not exist (the hour skipped when clocks go forward) lands on the same instant as the hour after it;
 * a time that happens twice (clocks go back) is the first one.
 */
export function easternInputToUtcIso(input: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(input ?? '');
  if (!match) return null;

  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);

  // Two candidates from the offset before and after a change; the first one that reads back as the typed wall time wins.
  // None reads back only for a time that does not exist, which then takes the first (the later clock reading).
  const first = wall - offsetAt(new Date(wall));
  const second = wall - offsetAt(new Date(first));
  const reads = (utc: number) => utcIsoToEasternInput(new Date(utc).toISOString()) === (input as string).slice(0, 16);
  const utc = [first, second].find(reads) ?? first;

  return new Date(utc).toISOString();
}

/** A UTC moment shown as the Eastern wall time a datetime-local input expects ("2026-11-21T10:47"), or "" when empty. */
export function utcIsoToEasternInput(iso: string | null | undefined): string {
  const date = new Date(iso ?? '');
  if (!iso || Number.isNaN(date.getTime())) return '';

  const p = easternParts(date);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const display = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

/** "Nov 21, 2026, 10:47 AM EST" for a UTC moment, or "" when empty. */
export function formatEastern(iso: string | null | undefined): string {
  const date = new Date(iso ?? '');

  return !iso || Number.isNaN(date.getTime()) ? '' : display.format(date);
}

/** True when an Eastern date-time typed in the form is still ahead of now. */
export function isFutureEasternInput(input: string | null | undefined, now: number = Date.now()): boolean {
  const iso = easternInputToUtcIso(input);

  return iso !== null && new Date(iso).getTime() > now;
}
