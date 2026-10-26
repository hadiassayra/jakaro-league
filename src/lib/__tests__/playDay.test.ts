import { describe, expect, it } from 'vitest';
import { assignPlayDay, dayCounts, matchDay } from '../playDay';
import { generateSchedule, newTournament } from '../tournament';

function tournament() {
  const t = newTournament();
  t.teams = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id, player1: '', player2: '', group: 'A' as const }));
  return generateSchedule(t);
}
const day = '2026-10-26';

describe('play day planning', () => {
  it('assigns a round of the day explicitly and rejects a second game for a team in that round', () => {
    const t = tournament();
    const first = t.matches.filter(m => m.round === 1).map(m => m.id);
    const second = t.matches.filter(m => m.round === 2).map(m => m.id);
    const next = assignPlayDay(t, first, day, 1);
    expect(() => assignPlayDay(next, second, day, 1)).toThrow();
    const both = assignPlayDay(next, second, day, 2);
    expect(both.matches.filter(m => m.playDay === day && m.dayRound === 1)).toHaveLength(2);
    expect(both.matches.filter(m => m.playDay === day && m.dayRound === 2)).toHaveLength(2);
    const removed = assignPlayDay(both, second, null);
    expect(removed.matches.filter(m => second.includes(m.id)).every(m => m.dayRound === null)).toBe(true);
  });
  it('combines two rounds into two matches per team without changing rounds', () => {
    const t = tournament();
    const ids = t.matches.filter(m => m.round <= 2).map(m => m.id);
    const next = assignPlayDay(t, ids, day);
    expect([...dayCounts(next, day).values()]).toEqual([2, 2, 2, 2]);
    expect(next.currentPlayDay).toBe(day);
    expect(next.matches.map(m => m.round)).toEqual(t.matches.map(m => m.round));
    expect(t.matches.every(m => !m.playDay)).toBe(true);
    expect(() => assignPlayDay(next, t.matches.filter(m => m.round === 3).map(m => m.id), day)).toThrow();
  });

  it('counts finished matches toward the daily limit', () => {
    const t = tournament();
    const next = assignPlayDay(t, t.matches.filter(m => m.round <= 2).map(m => m.id), day);
    next.matches = next.matches.map(m => m.playDay ? { ...m, status: 'finished', winnerId: m.teamA, loserMarbles: 2 } : m);
    expect(() => assignPlayDay(next, next.matches.filter(m => m.round === 3).map(m => m.id), day)).toThrow();
    expect(() => assignPlayDay(next, [next.matches[0].id], null)).toThrow();
  });

  it('removes assignments and clears conflicting times when moving days', () => {
    const t = tournament();
    const m = t.matches[0];
    m.scheduledAt = Date.parse('2026-10-26T16:00:00+02:00');
    expect(matchDay(m)).toBe(day);
    const moved = assignPlayDay(t, [m.id], '2026-10-27');
    expect(moved.matches[0].scheduledAt).toBeNull();
    expect(matchDay(moved.matches[0])).toBe('2026-10-27');
    expect(matchDay(assignPlayDay(moved, [m.id], null).matches[0])).toBeNull();
  });

  it('keeps a matching time and rejects changes to locked groups', () => {
    const t = tournament();
    t.matches[0].scheduledAt = Date.parse('2026-10-26T16:00:00+02:00');
    expect(assignPlayDay(t, [t.matches[0].id], day).matches[0].scheduledAt).toBe(t.matches[0].scheduledAt);
    expect(() => assignPlayDay({ ...t, groupsLocked: true }, [t.matches[0].id], day)).toThrow();
  });
});
