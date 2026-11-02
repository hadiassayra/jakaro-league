import type { Match, Tournament } from './types';
import { commonDays, weekdayOf } from './availability';
import { dayCounts, matchDay } from './playDay';
import { saveManualMatch, type ManualMatchInput } from './manualMatches';

export type ReplacementSlot = Omit<ManualMatchInput, 'teamA' | 'teamB'>;
export interface ReplacementSuggestion { teamA: string; teamB: string; group: 'A' | 'B'; score: number }

export function replacementSuggestions(t: Tournament, cancelled: Match, slot: ReplacementSlot): ReplacementSuggestion[] {
  if (t.groupsLocked || !slot.time || t.matches.some(m => m.id === cancelled.id)) return [];
  const counts = dayCounts(t, slot.day);
  const suggestions: ReplacementSuggestion[] = [];
  for (let i = 0; i < t.teams.length; i++) for (let j = i + 1; j < t.teams.length; j++) {
    const a = t.teams[i], b = t.teams[j];
    if (!a.group || a.group !== b.group || !commonDays(a, b).includes(weekdayOf(slot.day))) continue;
    const pair = (m: Match) => (m.teamA === a.id && m.teamB === b.id) || (m.teamA === b.id && m.teamB === a.id);
    if (pair(cancelled)) continue;
    // Never move another assigned pairing or replay an active/completed one.
    if (t.matches.some(m => m.stage === 'group' && pair(m) && (m.status !== 'upcoming' || !!m.winnerId || !!matchDay(m)))) continue;
    try {
      saveManualMatch(t, { ...slot, teamA: a.id, teamB: b.id });
      suggestions.push({ teamA: a.id, teamB: b.id, group: a.group,
        score: (a.group === cancelled.group ? 10 : 0) + (counts.get(a.id) ?? 0) + (counts.get(b.id) ?? 0) });
    } catch { /* Busy teams, daily limits and occupied tables are not eligible. */ }
  }
  return suggestions.sort((a, b) => b.score - a.score || a.teamA.localeCompare(b.teamA) || a.teamB.localeCompare(b.teamB));
}

export function applyReplacement(t: Tournament, cancelled: Match, slot: ReplacementSlot, teamA: string, teamB: string): Tournament {
  if (!replacementSuggestions(t, cancelled, slot).some(x => x.teamA === teamA && x.teamB === teamB)) {
    throw new Error('هذه المواجهة لم تعد متاحة لهذا الموعد. راجع الاقتراحات الحالية.');
  }
  return saveManualMatch(t, { ...slot, teamA, teamB });
}
