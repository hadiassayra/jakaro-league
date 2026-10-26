import type { Match, Tournament } from './types';
import { isFinished } from './standings';
import { withLog } from './tournament';

export function matchDay(m: Match): string | null {
  return m.playDay ?? (m.scheduledAt ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Hebron' }).format(m.scheduledAt) : null);
}

export function matchDayRound(m: Match): 1 | 2 {
  return m.dayRound ?? (m.round % 2 === 1 ? 1 : 2);
}

export function dayCounts(t: Tournament, day: string): Map<string, number> {
  const counts = new Map<string, number>();
  t.matches.filter(m => m.stage === 'group' && matchDay(m) === day).forEach(m => {
    for (const id of [m.teamA, m.teamB]) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  return counts;
}

export function assignPlayDay(t: Tournament, ids: string[], day: string | null, dayRound?: 1 | 2): Tournament {
  if (t.groupsLocked) throw new Error('نتائج المجموعات معتمدة ومقفلة.');
  const matches = t.matches.map(m => {
    if (!ids.includes(m.id) || m.stage !== 'group') return m;
    if (isFinished(m) || m.status === 'playing') throw new Error('لا يمكن نقل مباراة بدأت أو انتهت إلى يوم آخر.');
    // A changed date clears the old time so the card never shows a conflicting date.
    return { ...m, playDay: day, dayRound: day ? dayRound ?? matchDayRound(m) : null, scheduledAt: matchDay(m) === day ? m.scheduledAt : null };
  });
  const next = { ...t, matches, currentPlayDay: day ?? t.currentPlayDay };
  if (day && [...dayCounts(next, day).values()].some(n => n > 2)) {
    throw new Error('لا يمكن إضافة المباريات: أحد الفرق سيلعب أكثر من مباراتين في هذا اليوم.');
  }
  if (day) {
    for (const slot of [1, 2] as const) {
      const seen = new Set<string>();
      for (const m of matches.filter(m => m.stage === 'group' && matchDay(m) === day && matchDayRound(m) === slot)) {
        for (const id of [m.teamA, m.teamB]) {
          if (!id) continue;
          if (seen.has(id)) throw new Error(`الفريق لا يمكنه لعب أكثر من مباراة في الجولة ${slot} من اليوم.`);
          seen.add(id);
        }
      }
    }
  }
  return withLog(next, day ? `تحديد مباريات يوم ${day}` : 'إزالة مباريات من يوم اللعب');
}
