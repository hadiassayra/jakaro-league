import { describe, expect, it } from 'vitest';
import { generateSchedule, newTournament, recordResult } from '../tournament';
import { deleteGroupMatch, saveManualMatch } from '../manualMatches';
import { applyReplacement, replacementSuggestions } from '../replacementMatches';
import { matchDay } from '../playDay';
import type { Weekday } from '../types';

function setup() {
  const initial = newTournament();
  initial.settings.tablesCount = 2;
  initial.teams = 'abcdefgh'.split('').map(id => ({ id, name: id, player1: '', player2: '', group: id < 'e' ? 'A' as const : 'B' as const, availableDays: [3] as Weekday[] }));
  const slot = { day: '2026-11-04', time: '16:00', dayRound: 1 as const, table: 1 };
  const scheduled = saveManualMatch(generateSchedule(initial), { ...slot, teamA: 'a', teamB: 'b' });
  const cancelled = scheduled.matches.find(m => m.teamA === 'a' && m.teamB === 'b' || m.teamA === 'b' && m.teamB === 'a')!;
  return { t: deleteGroupMatch(scheduled, cancelled.id), scheduled, cancelled, slot };
}
const pairIs = (x: { teamA: string | null; teamB: string | null }, a: string, b: string) => x.teamA === a && x.teamB === b || x.teamA === b && x.teamB === a;

describe('replacement fixtures after cancellation', () => {
  it('suggests compatible remaining pairs, prioritizes the same group, and preserves the exact slot on adoption', () => {
    const { t, cancelled, slot } = setup();
    const before = structuredClone(t);
    const candidates = replacementSuggestions(t, cancelled, slot);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].group).toBe('A');
    expect(candidates.some(x => pairIs(x, 'a', 'b'))).toBe(false);
    const chosen = candidates[0];
    const prior = t.matches.find(x => pairIs(x, chosen.teamA, chosen.teamB))!;
    const next = applyReplacement(t, cancelled, slot, chosen.teamA, chosen.teamB);
    expect(next.matches).toHaveLength(t.matches.length);
    expect(next.matches.find(x => x.id === prior.id)).toMatchObject({ playDay: slot.day, scheduledAt: cancelled.scheduledAt, dayRound: cancelled.dayRound, table: cancelled.table });
    expect(t).toEqual(before);
    expect(next.matches.filter(x => matchDay(x) && x.id !== prior.id)).toEqual(t.matches.filter(x => matchDay(x)));
  });
  it('excludes busy teams, unavailable days, active games, completed games and pairings already booked elsewhere', () => {
    let { t, cancelled, slot } = setup();
    t = saveManualMatch(t, { ...slot, table: 2, teamA: 'c', teamB: 'd' });
    t.teams.find(x => x.id === 'e')!.availableDays = [6];
    const fg = t.matches.find(x => pairIs(x, 'f', 'g'))!;
    t = recordResult(t, fg.id, 'f', 2);
    t.matches.find(x => pairIs(x, 'f', 'h'))!.status = 'playing';
    t.matches.find(x => pairIs(x, 'g', 'h'))!.playDay = '2026-11-11';
    expect(replacementSuggestions(t, cancelled, slot)).toEqual([]);
  });
  it('rejects stale suggestions when the slot is taken, groups are locked, or the cancelled match is restored', () => {
    const { t, scheduled, cancelled, slot } = setup();
    const chosen = replacementSuggestions(t, cancelled, slot)[0];
    const occupied = saveManualMatch(t, { ...slot, teamA: 'e', teamB: 'f' });
    expect(() => applyReplacement(occupied, cancelled, slot, chosen.teamA, chosen.teamB)).toThrow();
    expect(replacementSuggestions(scheduled, cancelled, slot)).toEqual([]);
    expect(replacementSuggestions({ ...t, groupsLocked: true }, cancelled, slot)).toEqual([]);
    expect(replacementSuggestions(t, cancelled, { ...slot, time: '' })).toEqual([]);
  });
  it('can propose a missing group pairing without scheduling another day or replaying the cancelled opponents', () => {
    const { t, cancelled, slot } = setup();
    const missing = { ...t, matches: t.matches.filter(x => !pairIs(x, 'a', 'c')) };
    expect(replacementSuggestions(missing, cancelled, slot).some(x => pairIs(x, 'a', 'c'))).toBe(true);
    const next = applyReplacement(missing, cancelled, slot, 'a', 'c');
    expect(next.matches).toHaveLength(missing.matches.length + 1);
    expect(new Set(next.matches.map(matchDay).filter(Boolean))).toEqual(new Set([slot.day]));
  });
});
