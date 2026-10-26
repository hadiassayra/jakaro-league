import type { GroupId, Match, Team } from './types';
import { uid } from './id';

export type Pairing = [string, string];

/**
 * Circle method: fix the first team, rotate the rest.
 * Returns rounds, each a list of pairings. Odd counts get a bye (that team sits out).
 */
export function circleRounds(teamIds: string[]): Pairing[][] {
  const ids: (string | null)[] = teamIds.slice();
  if (ids.length < 2) return [];
  if (ids.length % 2 === 1) ids.push(null);
  const n = ids.length;
  const rounds: Pairing[][] = [];
  let arr = ids.slice();
  for (let r = 0; r < n - 1; r++) {
    const round: Pairing[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== null && b !== null) {
        // alternate sides so the fixed team isn't always listed first
        round.push(r % 2 === 0 || i > 0 ? [a, b] : [b, a]);
      }
    }
    rounds.push(round);
    // rotate everything except index 0
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return rounds;
}

/**
 * Builds the full group-stage schedule. Round r of group A and round r of group B
 * share the same round number so they can run in parallel. Tables (1..tablesCount)
 * are assigned in order across each combined round, cycling if there are more
 * matches than tables.
 */
export function generateGroupSchedule(teams: Team[], tablesCount: number): Match[] {
  const byGroup: Record<GroupId, string[]> = { A: [], B: [] };
  teams.forEach((t) => t.group && byGroup[t.group].push(t.id));
  const roundsA = circleRounds(byGroup.A);
  const roundsB = circleRounds(byGroup.B);
  const total = Math.max(roundsA.length, roundsB.length);
  const matches: Match[] = [];
  for (let r = 0; r < total; r++) {
    let tableIdx = 0;
    const add = (group: GroupId, p: Pairing) => {
      matches.push({
        id: uid('m'),
        stage: 'group',
        group,
        round: r + 1,
        table: tablesCount > 0 ? (tableIdx++ % tablesCount) + 1 : null,
        teamA: p[0],
        teamB: p[1],
        winnerId: null,
        loserMarbles: null,
        status: 'upcoming',
        startedAt: null,
        finishedAt: null,
      });
    };
    (roundsA[r] ?? []).forEach((p) => add('A', p));
    (roundsB[r] ?? []).forEach((p) => add('B', p));
  }
  return matches;
}
