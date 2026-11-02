import { describe, expect, it } from 'vitest';
import { publicMatches } from '../publicMatches';
import { allStandings, generateSchedule, newTournament, recordResult } from '../tournament';
import { parseMatchTime } from '../matchTime';

describe('published fixture days', () => {
  const t = newTournament();
  t.teams = ['a', 'b', 'c'].map(id => ({ id, name: id, player1: '', player2: '', group: 'A' }));
  const scheduled = generateSchedule(t);
  scheduled.matches[0].playDay = '2026-11-07';
  scheduled.matches[1].scheduledAt = parseMatchTime('2026-11-08', '00:30');

  it('preserves backwards compatibility and includes unassigned fixtures in all-days mode', () => {
    expect(publicMatches(scheduled)).toHaveLength(3);
    expect(publicMatches({ ...scheduled, settings: { ...scheduled.settings, publicMatchDays: null } })).toHaveLength(3);
  });
  it('includes only selected Palestinian dates, including matches with a timestamp only', () => {
    const shown = publicMatches({ ...scheduled, settings: { ...scheduled.settings, publicMatchDays: ['2026-11-08'] } });
    expect(shown.map(x => x.id)).toEqual([scheduled.matches[1].id]);
    expect(scheduled.matches).toHaveLength(3);
  });
  it('can hide every fixture while standings still include all results', () => {
    const finished = recordResult(scheduled, scheduled.matches[0].id, scheduled.matches[0].teamA!, 3);
    const hidden = { ...finished, settings: { ...finished.settings, publicMatchDays: [] } };
    expect(publicMatches(hidden)).toEqual([]);
    expect(allStandings(hidden)).toEqual(allStandings(finished));
  });
});
