import type { Match, Team, Tournament } from './types';
import { isFinished } from './standings';

export interface GroupOpponent {
  team: Team;
  status: 'played' | 'playing' | 'scheduled' | 'pending' | 'missing';
  match?: Match;
}

/** Start from every group member, including opponents whose fixture was deleted. */
export function groupOpponents(t: Tournament, teamId: string): GroupOpponent[] {
  const team = t.teams.find(x => x.id === teamId);
  if (!team?.group) return [];
  return t.teams.filter(x => x.group === team.group && x.id !== teamId).map(opponent => {
    const matches = t.matches.filter(m => m.stage === 'group' && m.group === team.group &&
      ((m.teamA === teamId && m.teamB === opponent.id) || (m.teamA === opponent.id && m.teamB === teamId)));
    const match = matches.find(isFinished) ?? matches.find(m => m.status === 'playing') ?? matches[0];
    return { team: opponent, match, status: !match ? 'missing' : isFinished(match) ? 'played' : match.status === 'playing' ? 'playing' : match.playDay || match.scheduledAt ? 'scheduled' : 'pending' };
  });
}
