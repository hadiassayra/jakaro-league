import { describe, expect, it } from 'vitest';
import type { Match, Tournament } from '../types';
import { cardsFor, correctLastCard, correctTeamPoints, issueCard, setMatchCards } from '../discipline';
import { allStandings, clearResult, newTournament, recordResult, setMatchStatus } from '../tournament';
import { isFinished } from '../standings';
import { computeStats } from '../stats';
import { qualificationStatus } from '../qualification';
import { buildBracket } from '../knockout';

function fixture(): Tournament {
  const t = newTournament();
  t.teams = ['a', 'b', 'c'].map(id => ({ id, name: id, player1: '', player2: '', group: 'A' }));
  const match = (id: string, a: string, b: string): Match => ({ id, teamA: a, teamB: b, stage: 'group', group: 'A', round: 1, table: 1, winnerId: null, loserMarbles: null, status: 'playing', startedAt: 100, finishedAt: null });
  t.matches = [match('m1', 'a', 'b'), match('m2', 'a', 'c'), match('m3', 'b', 'c')];
  return t;
}
const yellow = (t: Tournament, id = 'm1', team = 'a') => issueCard(t, id, team, 'yellow', 'غش');
const points = (t: Tournament, id = 'a') => allStandings(t).A.find(r => r.teamId === id)!.points;

describe('cards, forfeits and administrative points', () => {
  it('warns once, deducts exactly one point on the second yellow, and forfeits on the third offence', () => {
    const original = fixture();
    let t = yellow(original);
    expect(points(t)).toBe(0);
    expect(t.matches[0].status).toBe('playing');
    t = yellow(t);
    expect(points(t)).toBe(-1);
    expect(t.matches[0].status).toBe('playing');
    t = yellow(t);
    expect(cardsFor(t.matches[0], 'a')).toEqual({ yellow: 2, red: true });
    expect(isFinished(t.matches[0])).toBe(true);
    expect(t.matches[0].winnerId).toBe('b');
    expect(points(t, 'b')).toBe(1);
    expect(points(t)).toBe(-1);
    expect(original.matches[0].cards).toBeUndefined();
    expect(() => yellow(t)).toThrow();
  });

  it('starts card counts afresh each match and accumulates deductions across matches', () => {
    let t = yellow(yellow(fixture()));
    t = yellow(t, 'm2');
    expect(cardsFor(t.matches[1], 'a').yellow).toBe(1);
    expect(points(t)).toBe(-1);
    t = yellow(t, 'm2');
    expect(points(t)).toBe(-2);
    expect(t.matches.every(m => !m.forfeit)).toBe(true);
  });

  it('corrects yellows without double-deducting or losing other matches penalties', () => {
    let t = yellow(yellow(yellow(yellow(fixture()), 'm2'), 'm2'));
    expect(points(t)).toBe(-2);
    t = correctLastCard(t, 'm1', 'a', 'تصحيح بطاقة بالخطأ');
    expect(points(t)).toBe(-1);
    t = yellow(t);
    expect(points(t)).toBe(-2);
  });

  it('restores the ongoing match when a red card is corrected', () => {
    let t = issueCard(fixture(), 'm1', 'a', 'red', 'قرار المنظم');
    expect(t.matches[0].winnerId).toBe('b');
    expect(() => recordResult(t, 'm1', 'a', 4)).toThrow();
    expect(() => clearResult(t, 'm1')).toThrow();
    expect(setMatchStatus(t, 'm1', 'playing')).toBe(t);
    expect(() => issueCard(t, 'm1', 'b', 'red', 'قرار')).toThrow();
    t = correctLastCard(t, 'm1', 'a', 'الحمراء صدرت بالخطأ');
    expect(t.matches[0]).toMatchObject({ status: 'playing', startedAt: 100, winnerId: null, loserMarbles: null });
    expect(t.matches[0].forfeit).toBeUndefined();
  });

  it('restores an existing result after correcting a later red', () => {
    let t = recordResult(fixture(), 'm1', 'a', 5);
    const before = t.matches[0];
    t = issueCard(t, 'm1', 'a', 'red', 'غش');
    t = correctLastCard(t, 'm1', 'a', 'تصحيح');
    expect(t.matches[0]).toMatchObject({ winnerId: 'a', loserMarbles: 5, finishedAt: before.finishedAt });
    expect(points(t)).toBe(1);
  });

  it('does not apply group point deductions for knockout cards or count forfeits as played marble scores', () => {
    const initial = fixture();
    initial.matches[0].stage = 'knockout';
    initial.matches[0].round = 0;
    initial.matches[0].slot = 0;
    const t = yellow(yellow(yellow(initial)));
    expect(points(t)).toBe(0);
    const stats = computeStats(t.teams, t.matches);
    expect(stats.finished).toBe(1);
    expect(stats.shutouts).toBe(0);
    expect(stats.biggestWins).toEqual([]);
    expect(stats.avgMarblesLeft).toBe(0);
  });

  it('uses the corrected total and deductions for standings and qualification', () => {
    let t = recordResult(fixture(), 'm1', 'a', 3);
    t = yellow(yellow(t));
    expect(points(t)).toBe(0);
    t = correctTeamPoints(t, 'a', 7, 'تصحيح رصيد النقاط');
    expect(points(t)).toBe(7);
    expect(t.teams[0].pointsAdjustment).toBe(7);
    expect(t.matches[0].winnerId).toBe('a');
    const q = qualificationStatus(t.teams, t.matches, 'A', 1, allStandings(t).A);
    expect(q.a).toBe('qualified');
    t = correctLastCard(t, 'm1', 'a', 'تصحيح البطاقة');
    expect(points(t)).toBe(8);
    t = correctTeamPoints(t, 'a', 1, 'إلغاء التصحيح السابق');
    expect(points(t)).toBe(1);
  });

  it('rejects invalid cards, foreign teams, missing reasons and locked edits', () => {
    const t = fixture();
    expect(() => setMatchCards(t, 'm1', 'a', { yellow: 3, red: false }, 'غش')).toThrow();
    expect(() => yellow(t, 'm1', 'c')).toThrow();
    expect(() => issueCard(t, 'm1', 'a', 'red', ' ')).toThrow();
    expect(() => correctTeamPoints(t, 'a', NaN, 'خطأ')).toThrow();
    expect(() => correctTeamPoints(t, 'a', 1.5, 'خطأ')).toThrow();
    expect(() => correctTeamPoints(t, 'a', 1, '')).toThrow();
    expect(() => yellow({ ...t, groupsLocked: true })).toThrow();
    expect(() => correctTeamPoints({ ...t, groupsLocked: true }, 'a', 3, 'خطأ')).toThrow();
  });

  it('advances a knockout winner and clears stale cards when participants change after a correction', () => {
    const t = fixture();
    t.teams.push({ id: 'd', name: 'd', player1: '', player2: '', group: 'B' });
    const row = (teamId: string) => ({ teamId, rank: 1, played: 0, won: 0, lost: 0, points: 0, marblePoints: 0, form: [] as ('W' | 'L')[], tiebreak: 'none' as const });
    t.matches = buildBracket({ A: [row('a'), row('b')], B: [row('c'), row('d')] }, 2, false);
    const [first, second] = t.matches.filter(m => m.round === 0);
    let next = issueCard(t, first.id, first.teamA!, 'red', 'غش');
    next = recordResult(next, second.id, second.teamA!, 3);
    const final = next.matches.find(m => m.round === 1)!;
    next = issueCard(next, final.id, final.teamA!, 'red', 'غش');
    expect(isFinished(next.matches.find(m => m.id === final.id)!)).toBe(true);
    next = correctLastCard(next, first.id, first.teamA!, 'تصحيح الحمراء');
    const correctedFinal = next.matches.find(m => m.id === final.id)!;
    expect(correctedFinal.cards).toBeUndefined();
    expect(correctedFinal.forfeit).toBeUndefined();
    expect(correctedFinal.winnerId).toBeNull();
  });
});
