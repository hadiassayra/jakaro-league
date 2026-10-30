import type { Match, MatchCards, Tournament } from './types';
import { allStandings, matchLabel, patchMatch, teamName, withLog } from './tournament';

export function cardsFor(m: Match, teamId: string | null): MatchCards {
  return teamId ? m.cards?.[teamId] ?? { yellow: 0, red: false } : { yellow: 0, red: false };
}

export function setMatchCards(t: Tournament, matchId: string, teamId: string, cards: MatchCards, reason: string): Tournament {
  const m = t.matches.find(match => match.id === matchId);
  if (!m || !m.teamA || !m.teamB || ![m.teamA, m.teamB].includes(teamId)) throw new Error('اختر فريقاً مشاركاً في المباراة.');
  if (m.stage === 'group' && t.groupsLocked) throw new Error('ألغِ اعتماد المجموعات قبل تعديل البطاقات.');
  if (!reason.trim()) throw new Error('اكتب سبب إصدار البطاقة أو تصحيحها.');
  if (!Number.isInteger(cards.yellow) || cards.yellow < 0 || cards.yellow > 2 || typeof cards.red !== 'boolean') throw new Error('عدد البطاقات غير صالح.');
  if (cards.red && m.forfeit && m.forfeit.teamId !== teamId) throw new Error('لا يمكن منح الفريقين خسارة مباشرة في المباراة نفسها. صحّح القرار السابق أولاً.');
  const old = cardsFor(m, teamId);
  if (old.yellow === cards.yellow && old.red === cards.red) return t;
  const next = patchMatch(t, matchId, match => {
    let result = { ...match, cards: { ...match.cards, [teamId]: { ...cards } } };
    if (cards.red && !old.red) {
      const prior = { winnerId: match.winnerId, loserMarbles: match.loserMarbles, status: match.status, startedAt: match.startedAt, finishedAt: match.finishedAt };
      result = { ...result, forfeit: { teamId, prior }, winnerId: teamId === match.teamA ? match.teamB : match.teamA, loserMarbles: 0, status: 'finished', finishedAt: Date.now() };
    } else if (!cards.red && match.forfeit?.teamId === teamId) {
      result = { ...result, ...match.forfeit.prior, forfeit: undefined };
    }
    return result;
  });
  return withLog(next, `بطاقات ${teamName(t, teamId)} في ${matchLabel(t, m)} (جولة ${m.round}): ${cards.yellow} صفراء${cards.red ? ' + حمراء وخسارة مباشرة' : ''} — ${reason.trim()}`);
}

export function issueCard(t: Tournament, matchId: string, teamId: string, type: 'yellow' | 'red', reason: string): Tournament {
  const m = t.matches.find(match => match.id === matchId);
  if (!m) throw new Error('المباراة غير موجودة.');
  const cards = cardsFor(m, teamId);
  if (cards.red) throw new Error('الفريق حاصل على بطاقة حمراء بالفعل.');
  return setMatchCards(t, matchId, teamId, type === 'red' || cards.yellow === 2 ? { ...cards, red: true } : { ...cards, yellow: cards.yellow + 1 }, reason);
}

export function correctLastCard(t: Tournament, matchId: string, teamId: string, reason: string): Tournament {
  const m = t.matches.find(match => match.id === matchId);
  if (!m) throw new Error('المباراة غير موجودة.');
  const cards = cardsFor(m, teamId);
  return setMatchCards(t, matchId, teamId, cards.red ? { ...cards, red: false } : { ...cards, yellow: Math.max(0, cards.yellow - 1) }, reason);
}

export function correctTeamPoints(t: Tournament, teamId: string, total: number, reason: string): Tournament {
  if (t.groupsLocked) throw new Error('ألغِ اعتماد المجموعات قبل تصحيح النقاط.');
  if (!Number.isSafeInteger(total)) throw new Error('أدخل عدداً صحيحاً للنقاط.');
  if (!reason.trim()) throw new Error('اكتب سبب تصحيح النقاط.');
  const row = [...allStandings(t).A, ...allStandings(t).B].find(r => r.teamId === teamId);
  if (!row) throw new Error('الفريق غير موجود في مجموعة.');
  if (row.points === total) return t;
  const teams = t.teams.map(team => team.id === teamId ? { ...team, pointsAdjustment: (team.pointsAdjustment ?? 0) + total - row.points, pointsAdjustmentReason: reason.trim() } : team);
  return withLog({ ...t, teams }, `تصحيح نقاط ${teamName(t, teamId)} من ${row.points} إلى ${total} — ${reason.trim()}`);
}
