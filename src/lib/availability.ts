import type { GroupId, Match, Team, Tournament, Weekday } from './types';
import { seededRandom } from './id';
import { parseMatchTime } from './matchTime';

export const WEEKDAYS: { id: Weekday; label: string; aliases: string[] }[] = [
  { id: 6, label: 'السبت', aliases: ['سبت', 'saturday', 'sat'] },
  { id: 0, label: 'الأحد', aliases: ['احد', 'sunday', 'sun'] },
  { id: 1, label: 'الاثنين', aliases: ['اثنين', 'اثنان', 'monday', 'mon'] },
  { id: 2, label: 'الثلاثاء', aliases: ['ثلاثاء', 'ثلاثا', 'tuesday', 'tue'] },
  { id: 3, label: 'الأربعاء', aliases: ['اربعاء', 'اربعا', 'wednesday', 'wed'] },
  { id: 4, label: 'الخميس', aliases: ['خميس', 'thursday', 'thu'] },
  { id: 5, label: 'الجمعة', aliases: ['جمعه', 'جمعة', 'friday', 'fri'] },
];

export const normalizeName = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[ً-ْ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ');
export function parseAvailableDays(value: unknown): { days: Weekday[]; invalid: string[] } {
  const parts = (Array.isArray(value) ? value : String(value ?? '').split(/[,،;؛|/\n]+/)).map(v => String(v).trim()).filter(Boolean);
  const found = new Set<Weekday>();
  const invalid: string[] = [];
  for (const part of parts) {
    const name = normalizeName(part).replace(/^يوم\s+/, '').replace(/^ال/, '');
    const day = WEEKDAYS.find(d => d.aliases.some(a => normalizeName(a) === name));
    if (day) found.add(day.id); else invalid.push(part);
  }
  return { days: WEEKDAYS.filter(d => found.has(d.id)).map(d => d.id), invalid };
}
export const daysLabel = (days?: Weekday[]) => days?.length ? WEEKDAYS.filter(d => days.includes(d.id)).map(d => d.label).join('، ') : 'الأيام غير محددة';
export const weekdayOf = (date: string): Weekday => new Date(`${date}T12:00:00Z`).getUTCDay() as Weekday;
export const commonDays = (a: Team, b: Team): Weekday[] => WEEKDAYS.filter(d => a.availableDays?.includes(d.id) && b.availableDays?.includes(d.id)).map(d => d.id);
export function groupAvailability(teams: Team[]) {
  const known = teams.filter(t => t.availableDays?.length);
  const conflicts: [Team, Team][] = [];
  for (let i = 0; i < known.length; i++) for (let j = i + 1; j < known.length; j++) if (!commonDays(known[i], known[j]).length) conflicts.push([known[i], known[j]]);
  return { conflicts, missing: teams.filter(t => !t.availableDays?.length), common: known.length === teams.length && teams.length ? WEEKDAYS.filter(d => teams.every(t => t.availableDays!.includes(d.id))).map(d => d.id) : [] };
}

/** Balanced, deterministic multi-start local search. Conflicting pairs take
 * priority over shared group days and the number of shared choices. This is a
 * heuristic proposal, not a claim that a perfect split always exists. */
export function drawByAvailability(teams: Team[], seed = 20261102): Record<string, GroupId> {
  const n = teams.length;
  if (n < 2) throw new Error('أضف فريقين على الأقل.');
  const rand = seededRandom(seed);
  const cost = teams.map((a, i) => teams.map((b, j) => i === j || !a.availableDays?.length || !b.availableDays?.length ? 0 : commonDays(a, b).length ? -commonDays(a, b).length : 1_000_000));
  const masks = teams.map(t => (t.availableDays ?? []).reduce<number>((mask, d) => mask | (1 << d), 0));
  const groupCost = (assign: number[]) => {
    let value = 0;
    for (const g of [0, 1]) {
      let mask = 127;
      for (let i = 0; i < n; i++) if (assign[i] === g) mask &= masks[i];
      value += mask ? -1000 - mask.toString(2).replace(/0/g, '').length : 0;
    }
    return value;
  };
  const score = (assign: number[]) => {
    let value = groupCost(assign);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (assign[i] === assign[j]) value += cost[i][j];
    return value;
  };
  let best: number[] = [];
  let bestScore = Infinity;
  const attempts = n <= 64 ? 48 : 8;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const order = teams.map((_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const assign = Array<number>(n);
    order.forEach((id, i) => { assign[id] = i < Math.ceil(n / 2) ? 0 : 1; });
    let value = score(assign);
    for (let step = 0; step < Math.min(60, n * 2); step++) {
      let change = 0;
      let swap: [number, number] | null = null;
      const oldGroupCost = groupCost(assign);
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        if (assign[a] === assign[b]) continue;
        let delta = 0;
        for (let k = 0; k < n; k++) if (k !== a && k !== b) delta += (assign[k] === assign[a] ? -cost[a][k] + cost[b][k] : cost[a][k] - cost[b][k]);
        [assign[a], assign[b]] = [assign[b], assign[a]];
        delta += groupCost(assign) - oldGroupCost;
        [assign[a], assign[b]] = [assign[b], assign[a]];
        if (delta < change) { change = delta; swap = [a, b]; }
      }
      if (!swap) break;
      [assign[swap[0]], assign[swap[1]]] = [assign[swap[1]], assign[swap[0]]];
      value += change;
    }
    if (value < bestScore) { bestScore = value; best = assign.slice(); }
  }
  return Object.fromEntries(teams.map((t, i) => [t.id, best[i] === 0 ? 'A' : 'B']));
}

export function assignedDate(m: Match): string | null {
  return m.playDay ?? (m.scheduledAt ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Hebron' }).format(m.scheduledAt) : null);
}
export const slotOf = (m: Match): 1 | 2 => m.dayRound ?? (m.round % 2 ? 1 : 2);
export function availabilityProblem(teams: Team[], m: Match): 'missingDays' | 'noCommonDays' | null {
  const a = teams.find(t => t.id === m.teamA), b = teams.find(t => t.id === m.teamB);
  if (!a?.availableDays?.length || !b?.availableDays?.length) return 'missingDays';
  return commonDays(a, b).length ? null : 'noCommonDays';
}
export function assertAvailable(teams: Team[], m: Match, date: string) {
  for (const id of [m.teamA, m.teamB]) {
    const team = teams.find(t => t.id === id);
    if (team?.availableDays?.length && !team.availableDays.includes(weekdayOf(date))) throw new Error(`${team.name} غير متاح في هذا اليوم. أيامه: ${daysLabel(team.availableDays)}`);
  }
}

export interface AvailabilityPlan {
  matches: Match[];
  added: number;
  days: number;
  unscheduled: { matchId: string; reason: 'missingDays' | 'noCommonDays' | 'horizon' }[];
}

/** Preserve existing assignments and results; fill only unassigned group games.
 * Each calendar day has exactly two slots, one game per team per slot, and at
 * most one game on each physical table. Scarce days and two-game visits are
 * preferred, but a second game is never promised if opponents don't fit. */
export function planByAvailability(t: Tournament, start: string, options: { horizon?: number; times?: Record<1 | 2, string> } = {}): AvailabilityPlan {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(Date.parse(`${start}T12:00:00Z`))) throw new Error('اختر تاريخ بداية صحيحاً.');
  if (new Date(`${start}T12:00:00Z`).toISOString().slice(0, 10) !== start) throw new Error('اختر تاريخ بداية صحيحاً.');
  if (t.groupsLocked) throw new Error('نتائج المجموعات معتمدة ومقفلة.');
  const horizon = options.horizon ?? 120;
  const team = new Map(t.teams.map(tm => [tm.id, tm]));
  const matches = t.matches.map(m => ({ ...m }));
  const pending = new Set(matches.filter(m => m.stage === 'group' && m.status === 'upcoming' && !m.winnerId && !assignedDate(m) && !availabilityProblem(t.teams, m)).map(m => m.id));
  const rand = seededRandom(20261102);
  const dates = new Set<string>();
  let added = 0;
  for (let offset = 0; offset < horizon && pending.size; offset++) {
    const instant = new Date(`${start}T12:00:00Z`);
    instant.setUTCDate(instant.getUTCDate() + offset);
    const date = instant.toISOString().slice(0, 10), weekday = weekdayOf(date);
    const today = matches.filter(m => assignedDate(m) === date);
    const playedToday = new Map<string, number>();
    for (const m of today) for (const id of [m.teamA, m.teamB]) if (id) playedToday.set(id, (playedToday.get(id) ?? 0) + 1);
    for (const slot of [1, 2] as const) {
      const existing = matches.filter(m => assignedDate(m) === date && slotOf(m) === slot);
      const used = new Set(existing.flatMap(m => [m.teamA, m.teamB]).filter((id): id is string => !!id));
      const capacity = t.settings.tablesCount > 0 ? Math.max(0, t.settings.tablesCount - existing.length) : Math.floor(t.teams.length / 2);
      if (!capacity) continue;
      const candidates = matches.filter(m => pending.has(m.id) && m.teamA && m.teamB && !used.has(m.teamA) && !used.has(m.teamB) && (playedToday.get(m.teamA) ?? 0) < 2 && (playedToday.get(m.teamB) ?? 0) < 2 && team.get(m.teamA)!.availableDays!.includes(weekday) && team.get(m.teamB)!.availableDays!.includes(weekday));
      const priority = (m: Match) => 20 / commonDays(team.get(m.teamA!)!, team.get(m.teamB!)!).length + (slot === 2 ? 10 * ((playedToday.get(m.teamA!) ?? 0) + (playedToday.get(m.teamB!) ?? 0)) : 0);
      let best: Match[] = [], bestWeight = -Infinity;
      for (let attempt = 0; attempt < 24; attempt++) {
        const order = candidates.map(m => ({ m, key: (attempt % 4 ? priority(m) : 0) + rand() * 5 })).sort((a, b) => b.key - a.key);
        const taken = new Set(used), chosen: Match[] = [];
        let weight = 0;
        for (const { m } of order) {
          if (chosen.length >= capacity) break;
          if (taken.has(m.teamA!) || taken.has(m.teamB!)) continue;
          chosen.push(m); taken.add(m.teamA!); taken.add(m.teamB!); weight += priority(m);
        }
        if (chosen.length > best.length || chosen.length === best.length && weight > bestWeight) { best = chosen; bestWeight = weight; }
      }
      const tables = new Set(existing.map(m => m.table));
      for (const m of best) {
        let table: number | null = null;
        if (t.settings.tablesCount > 0) for (let n = 1; n <= t.settings.tablesCount; n++) if (!tables.has(n)) { table = n; tables.add(n); break; }
        m.playDay = date; m.dayRound = slot; m.table = table;
        m.scheduledAt = options.times ? parseMatchTime(date, options.times[slot]) : null;
        pending.delete(m.id); dates.add(date); added++;
        for (const id of [m.teamA!, m.teamB!]) playedToday.set(id, (playedToday.get(id) ?? 0) + 1);
      }
    }
  }
  const unscheduled = matches.filter(m => m.stage === 'group' && m.status === 'upcoming' && !assignedDate(m)).map(m => ({ matchId: m.id, reason: availabilityProblem(t.teams, m) ?? 'horizon' as const }));
  return { matches, added, days: dates.size, unscheduled };
}
