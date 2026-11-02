import type { Team } from './types';
import { shuffle } from './id';

/** Shuffle presentation order only. The approved group of every team is fixed. */
export function drawRevealOrder(teams: Team[], rand = Math.random): Team[] {
  if (!teams.length || teams.some(team => team.group !== 'A' && team.group !== 'B')) throw new Error('اعتمد توزيع كل الفرق على المجموعتين قبل تشغيل العرض.');
  if (new Set(teams.map(team => team.id)).size !== teams.length) throw new Error('توجد فرق مكررة في بيانات التوزيع.');
  return shuffle(teams.map(team => ({ ...team, availableDays: team.availableDays?.slice() })), rand);
}
