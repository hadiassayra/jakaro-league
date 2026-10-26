import type { GroupId, Match, StandingRow, Team, TiebreakReason } from './types';

export function isFinished(m: Match): boolean {
  return m.status === 'finished' && !!m.winnerId && m.loserMarbles !== null;
}

export function loserOf(m: Match): string | null {
  if (!m.winnerId) return null;
  return m.winnerId === m.teamA ? m.teamB : m.teamA;
}

function matchOrder(a: Match, b: Match): number {
  return (a.finishedAt ?? 0) - (b.finishedAt ?? 0) || a.round - b.round;
}

interface BaseStats {
  played: number;
  won: number;
  lost: number;
  points: number;
  marblePoints: number;
  form: ('W' | 'L')[];
}

export function teamStats(teamId: string, matches: Match[]): BaseStats {
  const s: BaseStats = { played: 0, won: 0, lost: 0, points: 0, marblePoints: 0, form: [] };
  matches
    .filter((m) => isFinished(m) && (m.teamA === teamId || m.teamB === teamId))
    .sort(matchOrder)
    .forEach((m) => {
      s.played++;
      const lm = m.loserMarbles ?? 0;
      if (m.winnerId === teamId) {
        s.won++;
        s.points += 1;
        s.marblePoints += lm;
        s.form.push('W');
      } else {
        s.lost++;
        s.marblePoints -= lm;
        s.form.push('L');
      }
    });
  return s;
}

/** Wins of each team counted only in matches between teams of the given set */
function headToHeadWins(ids: string[], matches: Match[]): Map<string, number> {
  const set = new Set(ids);
  const wins = new Map(ids.map((id) => [id, 0]));
  matches.forEach((m) => {
    if (!isFinished(m) || !m.teamA || !m.teamB) return;
    if (set.has(m.teamA) && set.has(m.teamB) && m.winnerId) {
      wins.set(m.winnerId, (wins.get(m.winnerId) ?? 0) + 1);
    }
  });
  return wins;
}

/** Splits a sorted list into runs of equal key */
function partition<T>(items: T[], key: (t: T) => number): T[][] {
  const out: T[][] = [];
  items.forEach((it) => {
    const last = out[out.length - 1];
    if (last && key(last[0]) === key(it)) last.push(it);
    else out.push([it]);
  });
  return out;
}

interface Resolved {
  ids: string[];
  reason: Map<string, TiebreakReason>;
}

/**
 * Orders a cluster of teams that are level on points and marble points:
 * head-to-head (mini-league among the tied teams, re-applied to any remaining
 * sub-tie), then manual override, otherwise marked unresolved.
 */
function resolveTie(ids: string[], matches: Match[], override: string[], depth = 0): Resolved {
  const reason = new Map<string, TiebreakReason>();
  if (ids.length === 1) return { ids, reason };
  const h2h = headToHeadWins(ids, matches);
  const sorted = ids.slice().sort((a, b) => (h2h.get(b) ?? 0) - (h2h.get(a) ?? 0));
  const parts = partition(sorted, (id) => h2h.get(id) ?? 0);
  if (parts.length > 1 && depth < 10) {
    const out: string[] = [];
    parts.forEach((p) => {
      if (p.length === 1) {
        reason.set(p[0], 'h2h');
        out.push(p[0]);
      } else {
        const r = resolveTie(p, matches, override, depth + 1);
        r.ids.forEach((id) => {
          out.push(id);
          reason.set(id, r.reason.get(id) ?? 'h2h');
        });
      }
    });
    return { ids: out, reason };
  }
  // head-to-head can't separate them → manual override
  const idx = (id: string) => {
    const i = override.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const allOverridden = ids.every((id) => override.includes(id));
  const ordered = ids.slice().sort((a, b) => idx(a) - idx(b));
  ordered.forEach((id) => reason.set(id, allOverridden ? 'override' : 'unresolved'));
  return { ids: ordered, reason };
}

export function computeStandings(
  teams: Team[],
  matches: Match[],
  group: GroupId,
  override: string[] = [],
): StandingRow[] {
  const groupTeams = teams.filter((t) => t.group === group);
  const groupMatches = matches.filter((m) => m.stage === 'group' && m.group === group);
  const base = groupTeams.map((t) => ({ teamId: t.id, ...teamStats(t.id, groupMatches) }));
  base.sort((a, b) => b.points - a.points || b.marblePoints - a.marblePoints);

  const rows: StandingRow[] = [];
  const byPoints = partition(base, (r) => r.points);
  byPoints.forEach((pointsGroup) => {
    const byMarbles = partition(pointsGroup, (r) => r.marblePoints);
    byMarbles.forEach((cluster) => {
      if (cluster.length === 1) {
        const r = cluster[0];
        const reason: TiebreakReason =
          byMarbles.length > 1 ? 'marbles' : pointsGroup.length === 1 ? 'points' : 'none';
        rows.push({ ...r, rank: 0, tiebreak: reason });
        return;
      }
      const resolved = resolveTie(
        cluster.map((c) => c.teamId),
        groupMatches,
        override,
      );
      resolved.ids.forEach((id) => {
        const r = cluster.find((c) => c.teamId === id)!;
        rows.push({ ...r, rank: 0, tiebreak: resolved.reason.get(id) ?? 'none' });
      });
    });
  });
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** Team ids that are tied with no way to separate them (need admin decision) */
export function unresolvedTies(rows: StandingRow[]): string[][] {
  const out: string[][] = [];
  let cur: StandingRow[] = [];
  const flush = () => {
    if (cur.length > 1) out.push(cur.map((r) => r.teamId));
    cur = [];
  };
  rows.forEach((r) => {
    if (r.tiebreak !== 'unresolved') return flush();
    const last = cur[cur.length - 1];
    if (last && (last.points !== r.points || last.marblePoints !== r.marblePoints)) flush();
    cur.push(r);
  });
  flush();
  return out;
}

export function groupMatchesDone(matches: Match[]): boolean {
  const g = matches.filter((m) => m.stage === 'group');
  return g.length > 0 && g.every(isFinished);
}
