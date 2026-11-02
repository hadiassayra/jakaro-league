import { describe, expect, it } from 'vitest';
import { groupOpponents } from '../opponents';
import { clearScheduleExceptDay, matchDay } from '../playDay';
import { generateSchedule, newTournament, recordResult } from '../tournament';
import { planByAvailability } from '../availability';
import { parseMatchTime } from '../matchTime';

function tournament() {
  const t = newTournament();
  t.settings.tablesCount = 2;
  t.teams = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: id, player1: '', player2: '', group: id === 'e' ? 'B' as const : 'A' as const, availableDays: [3, 6] as (3 | 6)[] }));
  return generateSchedule(t);
}

describe('day by day scheduling and opponent tracking', () => {
  it('keeps every November 4 assignment exactly and clears all other date forms without deleting results', () => {
    let t = tournament();
    const keep = t.matches[0];
    keep.playDay = '2026-11-04'; keep.scheduledAt = parseMatchTime('2026-11-04', '16:00'); keep.dayRound = 1;
    t.matches[1].scheduledAt = parseMatchTime('2026-11-04', '18:00');
    t.matches[2].playDay = '2026-11-07';
    t.matches[3].scheduledAt = parseMatchTime('2026-11-11', '18:00');
    t = recordResult(t, t.matches[2].id, t.matches[2].teamA!, 3);
    t.matches[2].cards = { [t.matches[2].teamA!]: { yellow: 1, red: false } };
    const before = structuredClone(t);
    const next = clearScheduleExceptDay(t, '2026-11-04');
    expect(next.matches.slice(0, 2)).toEqual(before.matches.slice(0, 2));
    expect(next.matches).toHaveLength(before.matches.length);
    expect(next.matches.slice(2).every(m => matchDay(m) === null)).toBe(true);
    expect(next.matches[2]).toMatchObject({ winnerId: before.matches[2].winnerId, loserMarbles: 3, status: 'finished', cards: before.matches[2].cards, scheduledAt: null, table: null });
    expect(next.currentPlayDay).toBe('2026-11-04');
    expect(t).toEqual(before);
  });
  it('lists all group opponents including missing fixtures, and distinguishes playing from played', () => {
    let t = tournament();
    const involvingA = t.matches.filter(m => m.teamA === 'a' || m.teamB === 'a');
    t = recordResult(t, involvingA[0].id, 'a', 2);
    t.matches.find(m => m.id === involvingA[1].id)!.status = 'playing';
    t.matches = t.matches.filter(m => m.id !== involvingA[2].id);
    const opponents = groupOpponents(t, 'a');
    expect(opponents).toHaveLength(3);
    expect(opponents.map(x => x.status).sort()).toEqual(['missing', 'played', 'playing']);
    expect(opponents.some(x => x.team.id === 'e' || x.team.id === 'a')).toBe(false);
    expect(groupOpponents(t, 'unknown')).toEqual([]);
  });
  it('only proposes the selected date by default, then schedules remaining pairings on a separately chosen day', () => {
    const t = tournament();
    const first = planByAvailability(t, '2026-11-04');
    expect(first.added).toBe(4);
    expect(first.unscheduled).toHaveLength(2);
    expect(new Set(first.matches.map(matchDay).filter(Boolean))).toEqual(new Set(['2026-11-04']));
    const second = planByAvailability({ ...t, matches: first.matches }, '2026-11-07');
    expect(second.added).toBe(2);
    expect(second.unscheduled).toEqual([]);
    expect(new Set(second.matches.map(m => m.id)).size).toBe(6);
    for (const m of first.matches.filter(m => matchDay(m))) expect(second.matches.find(x => x.id === m.id)).toEqual(m);
  });
});
