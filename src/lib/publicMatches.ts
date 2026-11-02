import type { Match, Tournament } from './types';
import { matchDay } from './playDay';

export function publicMatches(t: Tournament): Match[] {
  const days = t.settings.publicMatchDays;
  if (days == null) return t.matches;
  return t.matches.filter(m => {
    const day = matchDay(m);
    return day !== null && days.includes(day);
  });
}
