import { describe, expect, it } from 'vitest';
import { palestineDateTime, parseMatchTime, formatTime12, formatMatchTime, timeFrom12 } from '../matchTime';

describe('Palestine match time selection', () => {
  it('saves winter and summer times independently of the device timezone', () => {
    expect(parseMatchTime('2026-01-15', '16:00')).toBe(Date.parse('2026-01-15T16:00:00+02:00'));
    expect(parseMatchTime('2026-07-15', '19:30')).toBe(Date.parse('2026-07-15T19:30:00+03:00'));
  });
  it('preserves midnight and minutes when reopening a saved time', () => {
    for (const time of ['00:00', '16:15', '23:59']) {
      expect(palestineDateTime(parseMatchTime('2026-10-26', time))).toBe(`2026-10-26T${time}`);
    }
  });
  it('rejects invalid input', () => {
    expect(() => parseMatchTime('', '16:00')).toThrow();
    expect(() => parseMatchTime('2026-10-26', '25:00')).toThrow();
  });
  it('distinguishes midnight, noon, morning and evening in 12-hour display and selection', () => {
    for (const [raw, hour, minute, period, expected] of [
      ['00:00', 12, 0, 'AM', '12:00 ص'], ['12:00', 12, 0, 'PM', '12:00 م'],
      ['01:05', 1, 5, 'AM', '1:05 ص'], ['16:30', 4, 30, 'PM', '4:30 م'], ['23:59', 11, 59, 'PM', '11:59 م'],
    ] as const) {
      expect(timeFrom12(hour, minute, period)).toBe(raw);
      expect(formatTime12(raw)).toBe(expected);
      expect(formatMatchTime(parseMatchTime('2026-11-04', raw))).toBe(expected);
    }
    expect(formatTime12('')).toBe('');
  });
});
