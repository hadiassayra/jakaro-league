import { describe, expect, it } from 'vitest';
import { palestineDateTime, parseMatchTime } from '../matchTime';

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
});
