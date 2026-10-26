import { describe, expect, it } from 'vitest';
import { circleRounds, generateGroupSchedule } from '../roundRobin';
import { computeStandings, unresolvedTies } from '../standings';
import { bracketOrder, buildBracket, champion, crossSeedPairs, roundName, syncBracket } from '../knockout';
import { qualificationStatus } from '../qualification';
import { computeStats, countComebacks } from '../stats';
import type { GroupId, Match, StandingRow, Team } from '../types';
import { canLockGroups, clearResult, generateKnockout, lockGroups, newTournament, recordResult, unlockGroups } from '../tournament';
import { sampleTournament } from '../sample';

const team = (id: string, group: GroupId = 'A'): Team => ({ id, name: id, player1: 'x', player2: 'y', group });

let mc = 0;
const played = (a: string, b: string, winner: string, left: number, group: GroupId = 'A', round = 1): Match => ({
  id: `m${++mc}`,
  stage: 'group',
  group,
  round,
  table: null,
  teamA: a,
  teamB: b,
  winnerId: winner,
  loserMarbles: left,
  status: 'finished',
  startedAt: null,
  finishedAt: mc,
});
const pending = (a: string, b: string, group: GroupId = 'A'): Match => ({
  ...played(a, b, a, 0, group),
  winnerId: null,
  loserMarbles: null,
  status: 'upcoming',
  finishedAt: null,
});

describe('round robin (circle method)', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8]) {
    it(`every pair meets exactly once for ${n} teams`, () => {
      const ids = Array.from({ length: n }, (_, i) => `t${i}`);
      const rounds = circleRounds(ids);
      const pairs = rounds.flat().map(([a, b]) => [a, b].sort().join('-'));
      expect(pairs.length).toBe((n * (n - 1)) / 2);
      expect(new Set(pairs).size).toBe(pairs.length);
      expect(rounds.length).toBe(n % 2 === 0 ? n - 1 : n);
      // nobody plays twice in a round
      rounds.forEach((r) => {
        const seen = r.flat();
        expect(new Set(seen).size).toBe(seen.length);
      });
    });
  }

  it('builds a schedule for both groups with shared rounds and tables', () => {
    const teams = [...'abcdef'].map((x) => team(x, 'A')).concat([...'ghijkl'].map((x) => team(x, 'B')));
    const ms = generateGroupSchedule(teams, 3);
    expect(ms.length).toBe(30);
    expect(ms.filter((m) => m.round === 1).map((m) => m.table)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(generateGroupSchedule(teams, 0).every((m) => m.table === null)).toBe(true);
  });
});

describe('standings and tiebreaks', () => {
  const teams = ['a', 'b', 'c', 'd'].map((x) => team(x));

  it('counts points and marble points', () => {
    const ms = [played('a', 'b', 'a', 5), played('a', 'c', 'c', 2), played('b', 'c', 'b', 3)];
    const rows = computeStandings(teams, ms, 'A');
    const a = rows.find((r) => r.teamId === 'a')!;
    expect(a).toMatchObject({ played: 2, won: 1, lost: 1, points: 1, marblePoints: 5 - 2, form: ['W', 'L'] });
    const c = rows.find((r) => r.teamId === 'c')!;
    expect(c.marblePoints).toBe(2 - 3);
  });

  it('ranks by points, then marble points', () => {
    const ms = [played('a', 'b', 'a', 1), played('c', 'd', 'c', 6), played('a', 'd', 'a', 1), played('b', 'c', 'b', 1)];
    // a: 2 pts (+2), c: 1 pt (+6-1=+5), b: 1 pt (-1+1=0), d: 0
    const rows = computeStandings(teams, ms, 'A');
    expect(rows.map((r) => r.teamId)).toEqual(['a', 'c', 'b', 'd']);
    expect(rows[1].tiebreak).toBe('marbles');
  });

  it('uses head-to-head when points and marble points are equal', () => {
    const ms = [played('a', 'b', 'b', 3), played('a', 'c', 'a', 3), played('b', 'd', 'd', 3), played('c', 'd', 'c', 3)];
    // a,b,c,d all 1 pt, 0 marbles. b beat a → b above a; c... mini-league among all four
    const rows = computeStandings(teams, ms, 'A');
    expect(rows.every((r) => r.points === 1 && r.marblePoints === 0)).toBe(true);
    // all four have one win in mini-league → can't split → unresolved
    expect(rows.every((r) => r.tiebreak === 'unresolved')).toBe(true);
    expect(unresolvedTies(rows)).toHaveLength(1);
  });

  it('two-team tie decided by their match', () => {
    const t3 = ['a', 'b', 'c'].map((x) => team(x));
    const ms = [played('a', 'b', 'b', 4), played('a', 'c', 'a', 4), played('b', 'c', 'c', 0)];
    // all 1 point; a: +4-4=0, b: +4-0=4? b won vs a(4) lost vs c (0) → +4; c: +0 -4 = -4
    const rows = computeStandings(t3, ms, 'A');
    expect(rows.map((r) => r.teamId)).toEqual(['b', 'a', 'c']);
    const t2 = ['a', 'b', 'c', 'd'].map((x) => team(x));
    const ms2 = [played('a', 'b', 'b', 2), played('a', 'c', 'a', 2), played('b', 'd', 'd', 2), played('c', 'd', 'd', 2)];
    // d: 2 pts. a,b: 1 pt, 0 marbles each; c: 0. b beat a
    const rows2 = computeStandings(t2, ms2, 'A');
    expect(rows2.map((r) => r.teamId)).toEqual(['d', 'b', 'a', 'c']);
    expect(rows2[1].tiebreak).toBe('h2h');
  });

  it('manual override settles a circular tie and is flagged', () => {
    const t3 = ['a', 'b', 'c'].map((x) => team(x));
    const ms = [played('a', 'b', 'a', 3), played('b', 'c', 'b', 3), played('c', 'a', 'c', 3)];
    const rows = computeStandings(t3, ms, 'A', ['c', 'a', 'b']);
    expect(rows.map((r) => r.teamId)).toEqual(['c', 'a', 'b']);
    expect(rows.every((r) => r.tiebreak === 'override')).toBe(true);
    expect(unresolvedTies(rows)).toHaveLength(0);
  });
});

describe('knockout seeding and progression', () => {
  it('bracket order', () => {
    expect(bracketOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(bracketOrder(4)).toEqual([1, 4, 2, 3]);
  });

  it('cross seeding for 4 qualifiers: A1-B4, B2-A3, B1-A4, A2-B3', () => {
    const label = crossSeedPairs(4).map(([a, b]) => `${a.group}${a.pos}-${b.group}${b.pos}`);
    expect(label).toEqual(['A1-B4', 'B2-A3', 'B1-A4', 'A2-B3']);
  });

  it('cross seeding for 8 qualifiers is always A vs B with A1/B1 in opposite halves', () => {
    const pairs = crossSeedPairs(8);
    expect(pairs).toHaveLength(8);
    pairs.forEach(([a, b]) => {
      expect(a.group).not.toBe(b.group);
      expect(a.pos + b.pos).toBe(9);
    });
    const flat = pairs.flat().map((s) => `${s.group}${s.pos}`);
    expect(flat.indexOf('A1')).toBeLessThan(8);
    expect(flat.indexOf('B1')).toBeGreaterThanOrEqual(8);
  });

  it('round names', () => {
    expect([8, 4, 2, 1].map(roundName)).toEqual(['دور الـ16', 'ربع النهائي', 'نصف النهائي', 'النهائي']);
  });

  const rows = (g: string, n: number): StandingRow[] =>
    Array.from({ length: n }, (_, i) => ({
      teamId: `${g}${i + 1}`,
      rank: i + 1,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      marblePoints: 0,
      form: [],
      tiebreak: 'none',
    }));

  const finish = (ms: Match[], id: string, winner: 'A' | 'B'): Match[] =>
    syncBracket(
      ms.map((m) =>
        m.id === id
          ? { ...m, winnerId: winner === 'A' ? m.teamA : m.teamB, loserMarbles: 3, status: 'finished', finishedAt: 1 }
          : m,
      ),
    );

  it('builds QF→SF→F (+3rd place) and advances winners', () => {
    let ms = buildBracket({ A: rows('A', 6), B: rows('B', 6) }, 4, true);
    expect(ms.filter((m) => m.round === 0).map((m) => `${m.teamA}-${m.teamB}`)).toEqual([
      'A1-B4',
      'B2-A3',
      'B1-A4',
      'A2-B3',
    ]);
    expect(ms).toHaveLength(4 + 2 + 1 + 1);
    const qf = ms.filter((m) => m.round === 0);
    ms = finish(ms, qf[0].id, 'A'); // A1
    ms = finish(ms, qf[1].id, 'B'); // A3
    ms = finish(ms, qf[2].id, 'A'); // B1
    ms = finish(ms, qf[3].id, 'A'); // A2
    const sf = ms.filter((m) => m.round === 1 && !m.thirdPlace);
    expect(sf.map((m) => `${m.teamA}-${m.teamB}`)).toEqual(['A1-A3', 'B1-A2']);
    ms = finish(ms, sf[0].id, 'A');
    ms = finish(ms, sf[1].id, 'B');
    const final = ms.find((m) => m.round === 2 && !m.thirdPlace)!;
    const third = ms.find((m) => m.thirdPlace)!;
    expect([final.teamA, final.teamB]).toEqual(['A1', 'A2']);
    expect([third.teamA, third.teamB]).toEqual(['A3', 'B1']);
    ms = finish(ms, final.id, 'B');
    expect(champion(ms)).toBe('A2');

    // changing a QF result clears dependent later results
    ms = finish(ms, qf[0].id, 'B'); // B4 now wins QF1
    const sf1 = ms.find((m) => m.round === 1 && m.slot === 0 && !m.thirdPlace)!;
    expect(sf1.teamA).toBe('B4');
    expect(sf1.winnerId).toBeNull();
    expect(champion(ms)).toBeNull();
  });

  it('8 qualifiers per group creates a round of 16', () => {
    const ms = buildBracket({ A: rows('A', 8), B: rows('B', 8) }, 8, false);
    expect(ms.filter((m) => m.round === 0)).toHaveLength(8);
    expect(ms).toHaveLength(15);
  });
});

describe('qualification prediction', () => {
  it('marks clinched and eliminated teams', () => {
    const teams = ['a', 'b', 'c', 'd'].map((x) => team(x));
    // top 2 qualify. a won 2 of 2, d lost 2 of 2
    const ms = [
      played('a', 'b', 'a', 1),
      played('a', 'c', 'a', 1),
      played('b', 'd', 'b', 1),
      played('c', 'd', 'c', 1),
      pending('a', 'd'),
      pending('b', 'c'),
    ];
    const st = computeStandings(teams, ms, 'A');
    const q = qualificationStatus(teams, ms, 'A', 2, st);
    expect(q.a).toBe('qualified'); // a has 2, at most one of b/c reaches 2 → a top 2 for sure
    expect(q.d).toBe('eliminated'); // max 1 point, b or c will have 2 and a has 2
    expect(q.b).toBe('open');
    expect(q.c).toBe('open');
  });

  it('uses final standings when the group is complete', () => {
    const teams = ['a', 'b', 'c'].map((x) => team(x));
    const ms = [played('a', 'b', 'a', 1), played('a', 'c', 'a', 1), played('b', 'c', 'b', 1)];
    const st = computeStandings(teams, ms, 'A');
    expect(qualificationStatus(teams, ms, 'A', 2, st)).toEqual({ a: 'qualified', b: 'qualified', c: 'eliminated' });
  });
});

describe('stats', () => {
  it('biggest win, unbeaten, comebacks, average', () => {
    const teams = ['a', 'b', 'c'].map((x) => team(x));
    const ms = [played('a', 'b', 'a', 7), played('b', 'c', 'b', 2), played('c', 'a', 'a', 3)];
    const s = computeStats(teams, ms);
    expect(s.biggestWins.map((m) => m.loserMarbles)).toEqual([7]);
    expect(s.unbeaten.map((u) => u.teamId)).toEqual(['a']);
    expect(countComebacks('b', ms)).toBe(1); // lost to a then beat c
    expect(s.avgMarblesLeft).toBe(4);
  });
});

describe('tournament flow', () => {
  it('sample data → lock → bracket → champion; unlock removes bracket', () => {
    let t = sampleTournament('knockout');
    expect(t.teams).toHaveLength(12);
    expect(t.groupsLocked).toBe(true);
    const ko = t.matches.filter((m) => m.stage === 'knockout');
    expect(ko.length).toBe(8);
    // finish everything
    for (let i = 0; i < 10; i++) {
      const next = t.matches.find((m) => m.stage === 'knockout' && m.teamA && m.teamB && m.status !== 'finished');
      if (!next) break;
      t = recordResult(t, next.id, next.teamA!, 2);
    }
    expect(champion(t.matches)).not.toBeNull();
    t = unlockGroups(t);
    expect(t.matches.some((m) => m.stage === 'knockout')).toBe(false);
    expect(canLockGroups(t)).toBeNull();
    t = generateKnockout(lockGroups(t));
    expect(t.matches.filter((m) => m.stage === 'knockout')).toHaveLength(8);
  });

  it('records and clears results with clamping and a log', () => {
    let t = sampleTournament('groups');
    const m = t.matches.find((x) => x.status === 'upcoming')!;
    t = recordResult(t, m.id, m.teamB!, 99);
    const after = t.matches.find((x) => x.id === m.id)!;
    expect(after.loserMarbles).toBe(8);
    expect(after.status).toBe('finished');
    expect(t.log[0].text).toContain('نتيجة');
    t = clearResult(t, m.id);
    expect(t.matches.find((x) => x.id === m.id)!.winnerId).toBeNull();
    expect(() => recordResult(t, m.id, 'nobody', 1)).toThrow();
  });

  it('cannot lock with no schedule', () => {
    expect(canLockGroups(newTournament())).not.toBeNull();
  });
});
