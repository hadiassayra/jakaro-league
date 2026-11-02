import { describe, expect, it } from 'vitest';
import { dayImageMatches } from '../dayImage';
import { generateSchedule, newTournament, recordResult } from '../tournament';
import { parseMatchTime } from '../matchTime';

function tournament() {
  const t = newTournament();
  t.teams = 'abcdefgh'.split('').map(id => ({ id, name: id, player1: '', player2: '', group: id < 'e' ? 'A' as const : 'B' as const }));
  return generateSchedule(t);
}
describe('daily match image selection', () => {
  it('includes all groups and match states for the selected day even when hidden from the public', () => {
    let t = tournament();
    const a = t.matches.find(m => m.group === 'A')!, b = t.matches.find(m => m.group === 'B')!;
    a.playDay = '2026-11-04'; a.dayRound = 2;
    b.playDay = '2026-11-04'; b.dayRound = 1; b.status = 'playing';
    t = recordResult(t, a.id, a.teamA!, 3);
    t.settings.publicMatchDays = [];
    const before = structuredClone(t);
    expect(dayImageMatches(t, '2026-11-04').map(m => m.id)).toEqual([b.id, a.id]);
    expect(t).toEqual(before);
  });
  it('uses Palestinian dates for timestamp-only fixtures and excludes other days or undated fixtures', () => {
    const t = tournament();
    t.matches[0].scheduledAt = parseMatchTime('2026-11-04', '00:30');
    t.matches[1].scheduledAt = parseMatchTime('2026-11-03', '23:30');
    expect(dayImageMatches(t, '2026-11-04').map(m => m.id)).toEqual([t.matches[0].id]);
    expect(dayImageMatches(t, '2026-11-05')).toEqual([]);
  });
  it('includes knockout games alongside group fixtures without dropping either round', () => {
    const t = tournament();
    t.matches[0].playDay = '2026-11-04'; t.matches[0].dayRound = 1;
    t.matches[1].playDay = '2026-11-04'; t.matches[1].dayRound = 2;
    t.matches.push({ ...t.matches[0], id: 'ko', stage: 'knockout', group: undefined });
    expect(dayImageMatches(t, '2026-11-04').map(m => m.id)).toEqual([t.matches[0].id, t.matches[1].id, 'ko']);
  });
});
