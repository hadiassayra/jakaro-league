import { describe, expect, it } from 'vitest';
import { deleteGroupMatch, saveManualMatch } from '../manualMatches';
import { allStandings, generateSchedule, newTournament, recordResult } from '../tournament';
import { parseMatchTime } from '../matchTime';

function tournament() {
  const t = newTournament();
  t.teams = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: id, player1: '', player2: '', group: id === 'e' ? 'B' as const : 'A' as const }));
  return generateSchedule(t);
}
const input = { teamA: 'a', teamB: 'b', day: '2026-11-07', time: '16:00', dayRound: 1 as const, table: 1 };

describe('manual fixture management', () => {
  it('reschedules the existing pairing in either order without duplicating or losing cards', () => {
    const t = tournament();
    const m = t.matches.find(m => [m.teamA, m.teamB].includes('a') && [m.teamA, m.teamB].includes('b'))!;
    m.cards = { a: { yellow: 1, red: false } };
    const next = saveManualMatch(t, { ...input, teamA: 'b', teamB: 'a' });
    expect(next.matches).toHaveLength(t.matches.length);
    expect(next.matches.find(x => x.id === m.id)).toMatchObject({ playDay: input.day, dayRound: 1, table: 1, scheduledAt: parseMatchTime(input.day, input.time), cards: m.cards });
    expect(t.matches.find(x => x.id === m.id)?.playDay).toBeUndefined();
  });
  it('can cancel a completed match, recalculate standings, and create the pairing again', () => {
    const t = tournament();
    const m = t.matches.find(m => [m.teamA, m.teamB].includes('a') && [m.teamA, m.teamB].includes('b'))!;
    const finished = recordResult(t, m.id, 'a', 3);
    expect(allStandings(finished).A.find(x => x.teamId === 'a')?.points).toBe(1);
    const deleted = deleteGroupMatch(finished, m.id);
    expect(allStandings(deleted).A.find(x => x.teamId === 'a')?.points).toBe(0);
    expect(finished.matches.some(x => x.id === m.id)).toBe(true);
    const recreated = saveManualMatch(deleted, input);
    expect(recreated.matches).toHaveLength(t.matches.length);
    const added = recreated.matches.find(x => !deleted.matches.some(old => old.id === x.id))!;
    expect(added).toMatchObject({ teamA: 'a', teamB: 'b', status: 'upcoming', winnerId: null, playDay: input.day });
  });
  it('rejects invalid pairings, locked groups, and active/finished duplicates', () => {
    const t = tournament();
    for (const teamB of ['a', 'e', 'missing']) expect(() => saveManualMatch(t, { ...input, teamB })).toThrow();
    expect(() => saveManualMatch({ ...t, groupsLocked: true }, input)).toThrow();
    expect(() => deleteGroupMatch({ ...t, groupsLocked: true }, t.matches[0].id)).toThrow();
    const next = saveManualMatch(t, input);
    const m = next.matches.find(x => x.playDay)!;
    m.status = 'playing';
    expect(() => saveManualMatch(next, input)).toThrow();
    expect(() => saveManualMatch(recordResult(next, m.id, 'a', 2), input)).toThrow();
  });
  it('lets the admin create and reschedule games outside either team’s declared days without changing availability', () => {
    const t = tournament();
    t.teams[0].availableDays = [0];
    t.teams[1].availableDays = [1];
    const original = structuredClone(t);
    const existing = saveManualMatch(t, input);
    expect(existing.matches.find(m => m.playDay)?.playDay).toBe(input.day);
    const pairing = t.matches.find(m => (m.teamA === 'a' && m.teamB === 'b') || (m.teamA === 'b' && m.teamB === 'a'))!;
    const missing = deleteGroupMatch(t, pairing.id);
    const created = saveManualMatch(missing, input);
    expect(created.matches).toHaveLength(t.matches.length);
    expect(created.teams).toEqual(original.teams);
    expect(t).toEqual(original);
    expect(() => saveManualMatch(existing, { ...input, teamB: 'c', table: null })).toThrow();
  });
  it('enforces team rounds, the two games per day limit, and table conflicts', () => {
    const first = saveManualMatch(tournament(), input);
    expect(() => saveManualMatch(first, { ...input, teamB: 'c', table: null })).toThrow();
    expect(() => saveManualMatch(first, { ...input, teamA: 'c', teamB: 'd' })).toThrow();
    const second = saveManualMatch(first, { ...input, teamB: 'c', time: '18:00', dayRound: 2 });
    expect(() => saveManualMatch(second, { ...input, teamB: 'd', table: null })).toThrow();
    expect(() => saveManualMatch(first, { ...input, table: 999 })).toThrow();
  });
});
