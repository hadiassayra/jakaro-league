import type { Tournament } from './types';
import { uid } from './id';
import { assignPlayDay, matchDay, matchDayRound } from './playDay';
import { parseMatchTime } from './matchTime';
import { isFinished } from './standings';
import { matchLabel, withLog } from './tournament';

export interface ManualMatchInput {
  teamA: string;
  teamB: string;
  day: string;
  time: string;
  dayRound: 1 | 2;
  table: number | null;
}

/** Reuse an existing pending pairing instead of counting the same league game twice. */
export function saveManualMatch(t: Tournament, input: ManualMatchInput): Tournament {
  if (t.groupsLocked) throw new Error('ألغِ اعتماد نتائج المجموعات أولاً لتعديل الجدول.');
  const a = t.teams.find(x => x.id === input.teamA), b = t.teams.find(x => x.id === input.teamB);
  if (!a || !b || a.id === b.id) throw new Error('اختر فريقين مختلفين.');
  if (!a.group || a.group !== b.group) throw new Error('اختر فريقين من المجموعة نفسها.');
  if (!input.day || !input.time) throw new Error('اختر يوم المباراة وساعة البداية.');
  if (input.dayRound !== 1 && input.dayRound !== 2) throw new Error('اختر الجولة الأولى أو الثانية.');
  if (input.table !== null && (!Number.isInteger(input.table) || input.table < 1 || input.table > t.settings.tablesCount)) throw new Error('اختر طاولة صحيحة.');
  const scheduledAt = parseMatchTime(input.day, input.time);
  const existing = t.matches.find(m => m.stage === 'group' &&
    ((m.teamA === a.id && m.teamB === b.id) || (m.teamA === b.id && m.teamB === a.id)));
  if (existing && (isFinished(existing) || existing.status === 'playing')) throw new Error('المواجهة بين الفريقين بدأت أو انتهت بالفعل.');
  const m = existing ?? {
    id: uid('m'), stage: 'group' as const, group: a.group,
    round: Math.max(0, ...t.matches.filter(x => x.stage === 'group').map(x => x.round)) + 1,
    table: null, teamA: a.id, teamB: b.id, winnerId: null, loserMarbles: null,
    status: 'upcoming' as const, startedAt: null, finishedAt: null,
  };
  const next = assignPlayDay({ ...t, matches: existing ? t.matches : [...t.matches, m] }, [m.id], input.day, input.dayRound, { checkAvailability: false });
  if (input.table !== null && next.matches.some(x => x.id !== m.id && x.table === input.table &&
    matchDay(x) === input.day && (matchDayRound(x) === input.dayRound || x.scheduledAt === scheduledAt))) {
    throw new Error('الطاولة مستخدمة في هذه الجولة أو الساعة. اختر طاولة أخرى.');
  }
  return withLog({ ...next, matches: next.matches.map(x => x.id === m.id ? { ...x, scheduledAt, table: input.table } : x) },
    `${existing ? 'جدولة مواجهة موجودة' : 'إضافة مباراة يدوياً'}: ${matchLabel(t, m)}`);
}

export function deleteGroupMatch(t: Tournament, id: string): Tournament {
  const m = t.matches.find(x => x.id === id);
  if (!m) throw new Error('المباراة غير موجودة؛ حدّث الصفحة.');
  if (t.groupsLocked) throw new Error('ألغِ اعتماد نتائج المجموعات أولاً لتعديل الجدول.');
  if (m.stage !== 'group') throw new Error('تُدار مباريات الإقصائيات من صفحة الشجرة.');
  return withLog({ ...t, matches: t.matches.filter(x => x.id !== id) }, `إلغاء مباراة: ${matchLabel(t, m)}`);
}
