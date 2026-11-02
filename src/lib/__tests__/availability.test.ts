import { describe, expect, it } from 'vitest';
import type { Team, Weekday } from '../types';
import { assignedDate, commonDays, drawByAvailability, groupAvailability, parseAvailableDays, planByAvailability, slotOf, weekdayOf } from '../availability';
import { draftTeamsFromRows, parseTeamRows } from '../importTeams';
import { sourceAvailabilityRows } from '../availabilityRoster';
import { generateSchedule, newTournament, recordResult } from '../tournament';
import { assignPlayDay } from '../playDay';
import { palestineDateTime } from '../matchTime';

const team = (id: string, availableDays?: Weekday[]): Team => ({ id, name: id, player1: 'p1', player2: 'p2', group: 'A', availableDays });
const tournament = () => generateSchedule({ ...newTournament(), settings: { ...newTournament().settings, tablesCount: 2 }, teams: ['a', 'b', 'c', 'd'].map(id => team(id, [6])) });

describe('availability import and balanced grouping', () => {
  it('normalizes Arabic and English days, deduplicates and reports unknown tokens', () => {
    expect(parseAvailableDays('سبت , الأحد، اثنين, اربعاء، Thursday, السبت, مجهول')).toEqual({ days: [6, 0, 1, 3, 4], invalid: ['مجهول'] });
    expect(parseAvailableDays('')).toEqual({ days: [], invalid: [] });
  });
  it('reads the registration form columns without mistaking contact or timestamps for players', () => {
    const parsed = parseTeamRows([
      ['طابع زمني', 'اسم اعضاء الفريق ', 'اسم الفريق ', 'رقم الهاتف للتواصل', 'ما هي الايام التي تناسبك للعب المباريات'],
      [123, 'كرم / طارق', 'منحددوا بعدين', 'not imported', 'سبت، اثنين'],
      [124, 'فارس / نور', 'منحددوا بعدين', 'not imported', 'خميس'],
    ]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows.map(r => r.name)).toEqual(['منحددوا بعدين (كرم / طارق)', 'منحددوا بعدين (فارس / نور)']);
    expect(parsed.rows[0]).toMatchObject({ player1: 'كرم', player2: 'طارق', availableDays: [6, 1], group: null });
    expect(parsed.rows[1].issues).not.toContain('duplicate');
    expect(JSON.stringify(parsed)).not.toContain('not imported');
  });
  it('retains every registration in the supplied workbook and reuses existing metadata', () => {
    const old = { ...team('old', [0]), name: sourceAvailabilityRows[0].name, logo: 'stored-logo', pointsAdjustment: -1 };
    const draft = draftTeamsFromRows(sourceAvailabilityRows, [old]);
    expect(draft).toHaveLength(28);
    expect(new Set(draft.map(t => t.name)).size).toBe(28);
    expect(draft.every(t => t.availableDays?.length)).toBe(true);
    expect(draft[0]).toMatchObject({ id: 'old', logo: 'stored-logo', pointsAdjustment: -1, availableDays: [6] });
    expect(old.availableDays).toEqual([0]);
  });
  it('splits disjoint day clusters evenly without random incompatible pairings', () => {
    const teams = [0, 1, 2, 3].map(i => team(`sat${i}`, [6])).concat([0, 1, 2, 3].map(i => team(`wed${i}`, [3])));
    const assign = drawByAvailability(teams);
    expect(Object.values(assign).filter(g => g === 'A')).toHaveLength(4);
    expect(groupAvailability(teams.filter(t => assign[t.id] === 'A')).conflicts).toEqual([]);
    expect(groupAvailability(teams.filter(t => assign[t.id] === 'B')).conflicts).toEqual([]);
    expect(drawByAvailability(teams)).toEqual(assign);
    expect(teams.every(t => t.group === 'A')).toBe(true);
  });
  it('balances odd rosters and distinguishes missing days from actual conflicts', () => {
    const teams = [team('a', [6]), team('b', [3]), team('c')];
    const report = groupAvailability(teams);
    expect(report.conflicts).toHaveLength(1);
    expect(report.missing.map(t => t.id)).toEqual(['c']);
    expect(report.common).toEqual([]);
    expect(Object.values(drawByAvailability(teams)).filter(g => g === 'A')).toHaveLength(2);
    expect(commonDays(teams[0], teams[2])).toEqual([]);
  });
  it('reports unavoidable conflicts for the provided 28 registrations instead of claiming perfect compatibility', () => {
    const teams = draftTeamsFromRows(sourceAvailabilityRows, []);
    const assign = drawByAvailability(teams);
    const reports = (['A', 'B'] as const).map(g => groupAvailability(teams.filter(t => assign[t.id] === g)));
    expect(Object.values(assign).filter(g => g === 'A')).toHaveLength(14);
    expect(reports.reduce((n, r) => n + r.conflicts.length, 0)).toBeGreaterThan(0);
    expect(reports.some(r => r.common.includes(6))).toBe(true);
    expect(reports.reduce((n, r) => n + r.conflicts.length, 0)).toBeLessThan(15);
  });
});

describe('calendar planning from shared days', () => {
  it('books all round-robin games once, with two rounds, unique teams and unique tables in each slot', () => {
    const t = tournament();
    const plan = planByAvailability(t, '2026-11-07', { horizon: 8, times: { 1: '16:00', 2: '18:00' } });
    expect(plan.added).toBe(6);
    expect(plan.unscheduled).toEqual([]);
    expect(new Set(plan.matches.map(m => m.id)).size).toBe(6);
    const slots = new Map<string, typeof plan.matches>();
    const daily = new Map<string, number>();
    for (const m of plan.matches) {
      const date = assignedDate(m)!;
      expect(weekdayOf(date)).toBe(6);
      expect(palestineDateTime(m.scheduledAt!)).toBe(`${date}T${slotOf(m) === 1 ? '16:00' : '18:00'}`);
      const key = `${date}-${slotOf(m)}`;
      slots.set(key, [...(slots.get(key) ?? []), m]);
      for (const id of [m.teamA!, m.teamB!]) { const key = `${date}-${id}`; daily.set(key, (daily.get(key) ?? 0) + 1); }
    }
    for (const list of slots.values()) {
      expect(list.length).toBeLessThanOrEqual(2);
      expect(new Set(list.map(m => m.table)).size).toBe(list.length);
      expect(new Set(list.flatMap(m => [m.teamA, m.teamB])).size).toBe(list.length * 2);
    }
    expect([...daily.values()].every(n => n <= 2)).toBe(true);
    expect(t.matches.every(m => !assignedDate(m))).toBe(true);
  });
  it('leaves incompatible and unknown-day games unassigned', () => {
    const t = tournament();
    t.teams[1].availableDays = [3];
    t.teams[2].availableDays = undefined;
    const plan = planByAvailability(t, '2026-11-07');
    expect(plan.unscheduled.some(m => m.reason === 'noCommonDays')).toBe(true);
    expect(plan.unscheduled.some(m => m.reason === 'missingDays')).toBe(true);
    expect(plan.matches).toHaveLength(t.matches.length);
    for (const m of plan.matches.filter(m => assignedDate(m))) expect([m.teamA, m.teamB].every(id => id === 'a' || id === 'd')).toBe(true);
  });
  it('preserves finished, in-progress and previously assigned games and their cards', () => {
    let t = tournament();
    const [first, second, third] = t.matches;
    t = recordResult(t, first.id, first.teamA!, 3);
    t.matches[0].cards = { [first.teamA!]: { yellow: 1, red: false } };
    t.matches[1] = { ...second, status: 'playing', startedAt: 123 };
    t.matches[2] = { ...third, playDay: '2026-11-07', dayRound: 1, table: 1, scheduledAt: 1794045600000 };
    const before = structuredClone(t);
    const plan = planByAvailability(t, '2026-11-07');
    expect(plan.matches.slice(0, 3)).toEqual(before.matches.slice(0, 3));
    expect(t).toEqual(before);
  });
  it('respects a one-table limit and reports the finite planning horizon', () => {
    const t = tournament(); t.settings.tablesCount = 1;
    const plan = planByAvailability(t, '2026-11-07', { horizon: 1 });
    expect(plan.added).toBe(2);
    expect(plan.unscheduled).toHaveLength(4);
    expect(plan.unscheduled.every(m => m.reason === 'horizon')).toBe(true);
    expect(plan.matches.filter(m => assignedDate(m)).every(m => m.table === 1)).toBe(true);
  });
  it('rejects locked groups, invalid dates and manual assignments outside declared availability', () => {
    const t = tournament();
    expect(() => planByAvailability({ ...t, groupsLocked: true }, '2026-11-07')).toThrow();
    expect(() => planByAvailability(t, '2026-02-31')).toThrow();
    expect(() => planByAvailability(t, 'invalid')).toThrow();
    expect(() => assignPlayDay(t, [t.matches[0].id], '2026-11-02', 1)).toThrow();
    expect(assignPlayDay(t, [t.matches[0].id], '2026-11-07', 1).matches[0].playDay).toBe('2026-11-07');
  });
});
