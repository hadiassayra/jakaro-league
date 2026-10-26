import type { GroupId, Match, QualStatus, StandingRow, Team } from './types';
import { isFinished } from './standings';

const MAX_ENUM = 16; // 2^16 scenarios at most

/**
 * Works out which teams are mathematically through / out of the top `q`.
 * Only points are certain; marble points can still swing a tie either way, so a
 * tie on points is treated as "could go either way" (worst case when proving
 * qualification, best case when proving elimination).
 *
 * Small numbers of remaining matches are enumerated exactly; otherwise a safe
 * bound is used (it never marks a team wrongly, it may just mark it later).
 */
export function qualificationStatus(
  teams: Team[],
  matches: Match[],
  group: GroupId,
  q: number,
  standings: StandingRow[],
): Record<string, QualStatus> {
  const ids = teams.filter((t) => t.group === group).map((t) => t.id);
  const gm = matches.filter((m) => m.stage === 'group' && m.group === group);
  const remaining = gm.filter((m) => !isFinished(m) && m.teamA && m.teamB);
  const result: Record<string, QualStatus> = {};
  if (!ids.length) return result;

  if (gm.length > 0 && remaining.length === 0) {
    // group finished: the standings decide (including tiebreaks)
    standings.forEach((r) => (result[r.teamId] = r.rank <= q ? 'qualified' : 'eliminated'));
    return result;
  }
  if (ids.length <= q) {
    ids.forEach((id) => (result[id] = 'qualified'));
    return result;
  }

  const pts = new Map(ids.map((id) => [id, 0]));
  gm.filter(isFinished).forEach((m) => pts.set(m.winnerId!, (pts.get(m.winnerId!) ?? 0) + 1));

  const canFail = new Set<string>(); // some scenario puts the team outside top q
  const canMake = new Set<string>(); // some scenario puts the team inside top q

  const evaluate = (p: Map<string, number>) => {
    ids.forEach((id) => {
      const mine = p.get(id)!;
      let higher = 0;
      let higherOrEqual = 0;
      ids.forEach((o) => {
        if (o === id) return;
        const v = p.get(o)!;
        if (v > mine) higher++;
        if (v >= mine) higherOrEqual++;
      });
      if (higherOrEqual + 1 > q) canFail.add(id);
      if (higher + 1 <= q) canMake.add(id);
    });
  };

  if (remaining.length <= MAX_ENUM) {
    const total = 1 << remaining.length;
    for (let mask = 0; mask < total; mask++) {
      const p = new Map(pts);
      remaining.forEach((m, i) => {
        const w = mask & (1 << i) ? m.teamA! : m.teamB!;
        p.set(w, p.get(w)! + 1);
      });
      evaluate(p);
    }
  } else {
    const left = new Map(ids.map((id) => [id, 0]));
    remaining.forEach((m) => {
      left.set(m.teamA!, left.get(m.teamA!)! + 1);
      left.set(m.teamB!, left.get(m.teamB!)! + 1);
    });
    ids.forEach((id) => {
      const minMine = pts.get(id)!;
      const maxMine = minMine + left.get(id)!;
      const threats = ids.filter((o) => o !== id && pts.get(o)! + left.get(o)! >= minMine).length;
      if (threats + 1 > q) canFail.add(id);
      const sureAbove = ids.filter((o) => o !== id && pts.get(o)! > maxMine).length;
      if (sureAbove + 1 <= q) canMake.add(id);
    });
  }

  ids.forEach((id) => {
    result[id] = !canFail.has(id) ? 'qualified' : !canMake.has(id) ? 'eliminated' : 'open';
  });
  return result;
}
