import type { Match, StandingRow } from './types';
import { uid } from './id';
import { isFinished, loserOf } from './standings';

/** Standard bracket order for n seeds (n power of 2): 8 → [1,8,4,5,2,7,3,6] */
export function bracketOrder(n: number): number[] {
  let order = [1, 2];
  while (order.length < n) {
    const size = order.length * 2;
    order = order.flatMap((s) => [s, size + 1 - s]);
  }
  return order.slice(0, n);
}

export interface SeedRef {
  group: 'A' | 'B';
  pos: number; // 1-based position in group
}

/**
 * Cross seeding. Combined seeds interleave the groups (A1, B1, A2, B2, …) and are
 * placed with the standard bracket order, so every first-round match is A vs B and
 * A1/B1 sit in opposite halves (they can only meet in the final).
 * For 4 per group: A1–B4, B2–A3, B1–A4, A2–B3.
 */
export function crossSeedPairs(qualifiersPerGroup: number): [SeedRef, SeedRef][] {
  const q = qualifiersPerGroup;
  if (q < 1 || (q & (q - 1)) !== 0) throw new Error('qualifiersPerGroup must be a power of 2');
  const seedRef = (s: number): SeedRef =>
    s % 2 === 1 ? { group: 'A', pos: (s + 1) / 2 } : { group: 'B', pos: s / 2 };
  const order = bracketOrder(q * 2);
  const pairs: [SeedRef, SeedRef][] = [];
  for (let i = 0; i < order.length; i += 2) pairs.push([seedRef(order[i]), seedRef(order[i + 1])]);
  return pairs;
}

export function roundName(matchesInRound: number): string {
  switch (matchesInRound) {
    case 1:
      return 'النهائي';
    case 2:
      return 'نصف النهائي';
    case 4:
      return 'ربع النهائي';
    case 8:
      return 'دور الـ16';
    case 16:
      return 'دور الـ32';
    default:
      return `دور الـ${matchesInRound * 2}`;
  }
}

export function koRoundLabel(m: Match, allKo: Match[]): string {
  if (m.thirdPlace) return 'مباراة المركز الثالث';
  const count = allKo.filter((x) => !x.thirdPlace && x.round === m.round).length;
  return roundName(count);
}

function emptyKo(round: number, slot: number, thirdPlace = false): Match {
  return {
    id: uid('k'),
    stage: 'knockout',
    round,
    slot,
    thirdPlace,
    table: null,
    teamA: null,
    teamB: null,
    winnerId: null,
    loserMarbles: null,
    status: 'upcoming',
    startedAt: null,
    finishedAt: null,
  };
}

export function buildBracket(
  standings: { A: StandingRow[]; B: StandingRow[] },
  qualifiersPerGroup: number,
  thirdPlace: boolean,
): Match[] {
  const pairs = crossSeedPairs(qualifiersPerGroup);
  const pick = (r: SeedRef) => standings[r.group][r.pos - 1]?.teamId ?? null;
  const matches: Match[] = [];
  let count = pairs.length;
  let round = 0;
  pairs.forEach(([a, b], i) => {
    const m = emptyKo(0, i);
    m.teamA = pick(a);
    m.teamB = pick(b);
    matches.push(m);
  });
  while (count > 1) {
    round++;
    count /= 2;
    for (let i = 0; i < count; i++) matches.push(emptyKo(round, i));
  }
  if (thirdPlace && pairs.length >= 2) matches.push(emptyKo(round, 0, true));
  return syncBracket(matches);
}

/**
 * Recomputes who plays in every later knockout match from the earlier results.
 * If an earlier result changed so a later match's participants changed, that
 * later result is cleared.
 */
export function syncBracket(ko: Match[]): Match[] {
  const out = ko.map((m) => ({ ...m }));
  const main = out.filter((m) => !m.thirdPlace);
  const maxRound = Math.max(0, ...main.map((m) => m.round));
  const find = (round: number, slot: number) =>
    main.find((m) => m.round === round && m.slot === slot);

  for (let r = 1; r <= maxRound; r++) {
    main
      .filter((m) => m.round === r)
      .forEach((m) => {
        const s = m.slot ?? 0;
        const a = find(r - 1, s * 2);
        const b = find(r - 1, s * 2 + 1);
        const nextA = a && isFinished(a) ? a.winnerId : null;
        const nextB = b && isFinished(b) ? b.winnerId : null;
        if (nextA !== m.teamA || nextB !== m.teamB) {
          m.teamA = nextA;
          m.teamB = nextB;
          clearResult(m);
        }
      });
  }
  const third = out.find((m) => m.thirdPlace);
  if (third) {
    const semis = main.filter((m) => m.round === maxRound - 1);
    const la = semis[0] && isFinished(semis[0]) ? loserOf(semis[0]) : null;
    const lb = semis[1] && isFinished(semis[1]) ? loserOf(semis[1]) : null;
    if (la !== third.teamA || lb !== third.teamB) {
      third.teamA = la;
      third.teamB = lb;
      clearResult(third);
    }
  }
  return out;
}

function clearResult(m: Match) {
  m.winnerId = null;
  m.loserMarbles = null;
  m.finishedAt = null;
  if (m.status === 'finished') m.status = 'upcoming';
  if (!m.teamA || !m.teamB) {
    m.status = 'upcoming';
    m.startedAt = null;
  }
}

export function koMatches(matches: Match[]): Match[] {
  return matches
    .filter((m) => m.stage === 'knockout')
    .sort((a, b) => a.round - b.round || Number(!!a.thirdPlace) - Number(!!b.thirdPlace) || (a.slot ?? 0) - (b.slot ?? 0));
}

export function champion(matches: Match[]): string | null {
  const ko = koMatches(matches).filter((m) => !m.thirdPlace);
  if (!ko.length) return null;
  const maxRound = Math.max(...ko.map((m) => m.round));
  const final = ko.find((m) => m.round === maxRound);
  return final && isFinished(final) ? final.winnerId : null;
}

/** Rounds of the main bracket, each sorted by slot */
export function bracketRounds(matches: Match[]): Match[][] {
  const ko = koMatches(matches).filter((m) => !m.thirdPlace);
  const rounds: Match[][] = [];
  ko.forEach((m) => {
    (rounds[m.round] ??= []).push(m);
  });
  return rounds.map((r) => r.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)));
}
