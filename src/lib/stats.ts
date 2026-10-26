import type { Match, Team } from './types';
import { isFinished, loserOf, teamStats } from './standings';

export interface TournamentStats {
  finished: number;
  total: number;
  biggestWins: Match[];
  unbeaten: { teamId: string; played: number }[];
  comebacks: { teamId: string; count: number }[];
  totalComebacks: number;
  avgMarblesLeft: number;
  shutouts: number;
  marbleLeaders: { teamId: string; marblePoints: number }[];
  longestStreak: { teamId: string; length: number } | null;
}

/** Results of one team in play order (group + knockout) */
export function teamResults(teamId: string, matches: Match[]): Match[] {
  return matches
    .filter((m) => isFinished(m) && (m.teamA === teamId || m.teamB === teamId))
    .sort(
      (a, b) =>
        (a.finishedAt ?? 0) - (b.finishedAt ?? 0) ||
        Number(a.stage === 'knockout') - Number(b.stage === 'knockout') ||
        a.round - b.round,
    );
}

/**
 * A "comeback" (عودة) = winning the next match right after a loss.
 */
export function countComebacks(teamId: string, matches: Match[]): number {
  const res = teamResults(teamId, matches);
  let c = 0;
  for (let i = 1; i < res.length; i++) {
    if (res[i - 1].winnerId !== teamId && res[i].winnerId === teamId) c++;
  }
  return c;
}

export function computeStats(teams: Team[], matches: Match[]): TournamentStats {
  const done = matches.filter(isFinished);
  const maxLeft = Math.max(-1, ...done.map((m) => m.loserMarbles ?? 0));
  const biggestWins = maxLeft >= 0 ? done.filter((m) => m.loserMarbles === maxLeft) : [];

  const unbeaten = teams
    .map((t) => ({ teamId: t.id, s: teamStats(t.id, matches) }))
    .filter((x) => x.s.played > 0 && x.s.lost === 0)
    .map((x) => ({ teamId: x.teamId, played: x.s.played }))
    .sort((a, b) => b.played - a.played);

  const comebacks = teams
    .map((t) => ({ teamId: t.id, count: countComebacks(t.id, matches) }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const avg = done.length ? done.reduce((s, m) => s + (m.loserMarbles ?? 0), 0) / done.length : 0;

  const groupMatches = matches.filter((m) => m.stage === 'group');
  const marbleLeaders = teams
    .map((t) => ({ teamId: t.id, marblePoints: teamStats(t.id, groupMatches).marblePoints }))
    .sort((a, b) => b.marblePoints - a.marblePoints)
    .slice(0, 5);

  let longestStreak: TournamentStats['longestStreak'] = null;
  teams.forEach((t) => {
    let cur = 0;
    let best = 0;
    teamResults(t.id, matches).forEach((m) => {
      cur = m.winnerId === t.id ? cur + 1 : 0;
      best = Math.max(best, cur);
    });
    if (best > 0 && (!longestStreak || best > longestStreak.length)) {
      longestStreak = { teamId: t.id, length: best };
    }
  });

  return {
    finished: done.length,
    total: matches.filter((m) => m.teamA && m.teamB).length,
    biggestWins,
    unbeaten,
    comebacks,
    totalComebacks: comebacks.reduce((s, c) => s + c.count, 0),
    avgMarblesLeft: Math.round(avg * 10) / 10,
    shutouts: done.filter((m) => m.loserMarbles === 0).length,
    marbleLeaders,
    longestStreak,
  };
}

export { loserOf };
