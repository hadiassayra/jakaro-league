import type { Tournament } from './types';
import { newTournament, withLog } from './tournament';

// Names from the registration workbook, in sheet order.
export const registeredTeamNames = [
  'مضيق هرمز',
  'ع الهدى',
  'Al Geeks',
  'Z&M',
  'فريق خليها على الله',
  'Oppa 7',
  'سينابون فرنسي',
  'Rulopak',
  'كوشوك',
  'لا يوجد',
  'حبايب القلول',
  'Checkmate',
  'ولاد رزق',
  'التوكل على الله',
  'فلاش',
  'G4',
  'لُدابلسي',
  'Mr Watterson',
  'Double triple',
  'فريق الفراشات',
  'التاج',
];

export function importRegisteredTeams(t: Tournament = newTournament()): Tournament {
  const existing = new Set(t.teams.map(team => team.name.trim()));
  const added = registeredTeamNames.flatMap((name, i) => existing.has(name) ? [] : [{
    id: `registration_20261026_${i + 1}`,
    name,
    player1: '',
    player2: '',
    group: null,
  }]);
  if (!added.length) return t;
  return withLog({ ...t, teams: [...t.teams, ...added] }, `تم استيراد أسماء الفرق من شيت التسجيل (${added.length} فريق)`);
}
