import type { GroupId, Match, MatchStatus, Settings, StandingRow, Team, Tournament } from './types';
import { DEFAULT_BRAND } from './colors';
import { uid } from './id';
import { generateGroupSchedule } from './roundRobin';
import { computeStandings, groupMatchesDone, isFinished, unresolvedTies } from './standings';
import { buildBracket, syncBracket } from './knockout';

export function defaultSettings(): Settings {
  return {
    name: 'دوري جاكرو',
    maxMarbles: 8,
    qualifiersPerGroup: 4,
    thirdPlaceMatch: true,
    tablesCount: 3,
    rotationSeconds: 12,
    matchTimeLimitMin: 0,
    logo: null,
    palette: { ...DEFAULT_BRAND },
    overrides: {},
    dark: true,
    sound: true,
    pinHash: null,
    publicBaseUrl: '',
  };
}

export function newTournament(keepSettings?: Settings): Tournament {
  const now = Date.now();
  return {
    id: uid('t'),
    settings: keepSettings ? { ...keepSettings } : defaultSettings(),
    teams: [],
    matches: [],
    groupsLocked: false,
    tieOverrides: { A: [], B: [] },
    log: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function teamName(t: Tournament, id: string | null | undefined): string {
  if (!id) return '—';
  return t.teams.find((x) => x.id === id)?.name ?? '؟';
}

export function withLog(t: Tournament, text: string): Tournament {
  const entry = { id: uid('l'), at: Date.now(), text };
  return { ...t, log: [entry, ...t.log].slice(0, 500), updatedAt: Date.now() };
}

export function allStandings(t: Tournament): Record<GroupId, StandingRow[]> {
  return {
    A: computeStandings(t.teams, t.matches, 'A', t.tieOverrides.A),
    B: computeStandings(t.teams, t.matches, 'B', t.tieOverrides.B),
  };
}

export function hasGroupResults(t: Tournament): boolean {
  return t.matches.some((m) => m.stage === 'group' && isFinished(m));
}

export function generateSchedule(t: Tournament): Tournament {
  const matches = generateGroupSchedule(t.teams, t.settings.tablesCount);
  return withLog(
    { ...t, matches, groupsLocked: false },
    `تم توليد جدول المجموعات (${matches.length} مباراة)`,
  );
}

export function patchMatch(t: Tournament, id: string, fn: (m: Match) => Match): Tournament {
  let matches = t.matches.map((m) => (m.id === id ? fn({ ...m }) : m));
  const changed = matches.find((m) => m.id === id);
  if (changed?.stage === 'knockout') {
    const ko = syncBracket(matches.filter((m) => m.stage === 'knockout'));
    matches = [...matches.filter((m) => m.stage !== 'knockout'), ...ko];
  }
  return { ...t, matches, updatedAt: Date.now() };
}

export function matchLabel(t: Tournament, m: Match): string {
  return `${teamName(t, m.teamA)} × ${teamName(t, m.teamB)}`;
}

export function recordResult(
  t: Tournament,
  matchId: string,
  winnerId: string,
  loserMarbles: number,
): Tournament {
  const m = t.matches.find((x) => x.id === matchId);
  if (!m) return t;
  if (m.forfeit) throw new Error('صحّح البطاقة الحمراء أولاً لتعديل نتيجة الخسارة المباشرة.');
  if (winnerId !== m.teamA && winnerId !== m.teamB) throw new Error('الفائز ليس طرفاً في المباراة');
  const lm = Math.max(0, Math.min(t.settings.maxMarbles, Math.round(loserMarbles)));
  const wasFinished = isFinished(m);
  const next = patchMatch(t, matchId, (x) => ({
    ...x,
    winnerId,
    loserMarbles: lm,
    status: 'finished',
    finishedAt: x.finishedAt && wasFinished ? x.finishedAt : Date.now(),
  }));
  return withLog(
    next,
    `${wasFinished ? 'تعديل' : 'نتيجة'}: ${matchLabel(t, m)} — الفائز ${teamName(t, winnerId)}، كرات متبقية للخاسر ${lm}`,
  );
}

export function clearResult(t: Tournament, matchId: string): Tournament {
  const m = t.matches.find((x) => x.id === matchId);
  if (!m) return t;
  if (m.forfeit) throw new Error('ألغِ البطاقة الحمراء أولاً؛ ستُستعاد حالة المباراة السابقة تلقائياً.');
  const next = patchMatch(t, matchId, (x) => ({
    ...x,
    winnerId: null,
    loserMarbles: null,
    status: 'upcoming',
    finishedAt: null,
    startedAt: null,
  }));
  return withLog(next, `حذف نتيجة: ${matchLabel(t, m)}`);
}

export function setMatchStatus(t: Tournament, matchId: string, status: MatchStatus): Tournament {
  const m = t.matches.find((x) => x.id === matchId);
  if (!m || m.forfeit || (m.stage === 'group' && t.groupsLocked) || status === 'finished') return t;
  const next = patchMatch(t, matchId, (x) => ({
    ...x,
    status,
    startedAt: status === 'playing' ? (x.startedAt ?? Date.now()) : null,
  }));
  return status === 'playing' ? withLog(next, `بدأت المباراة: ${matchLabel(t, m)}`) : next;
}

export function setMatchTable(t: Tournament, matchId: string, table: number | null): Tournament {
  return patchMatch(t, matchId, (x) => ({ ...x, table }));
}

export function canLockGroups(t: Tournament): string | null {
  if (!t.matches.some((m) => m.stage === 'group')) return 'لم يتم توليد جدول المجموعات بعد';
  if (!groupMatchesDone(t.matches)) return 'لم تنتهِ كل مباريات المجموعات بعد';
  const st = allStandings(t);
  const q = t.settings.qualifiersPerGroup;
  for (const g of ['A', 'B'] as GroupId[]) {
    const ties = unresolvedTies(st[g]);
    // any unresolved tie touching a qualifying place affects qualification or seeding
    const critical = ties.some((ids) =>
      ids.some((id) => st[g].find((r) => r.teamId === id)!.rank <= q),
    );
    if (critical) return `يوجد تعادل غير محسوم في المجموعة ${g === 'A' ? 'أ' : 'ب'} — حدّد الترتيب يدوياً`;
  }
  for (const g of ['A', 'B'] as GroupId[]) {
    if (st[g].length < q) return `عدد فرق المجموعة ${g === 'A' ? 'أ' : 'ب'} أقل من عدد المتأهلين (${q})`;
  }
  return null;
}

export function lockGroups(t: Tournament): Tournament {
  return withLog({ ...t, groupsLocked: true }, 'تم اعتماد نتائج المجموعات');
}

export function unlockGroups(t: Tournament): Tournament {
  const hadKo = t.matches.some((m) => m.stage === 'knockout');
  return withLog(
    { ...t, groupsLocked: false, matches: t.matches.filter((m) => m.stage !== 'knockout') },
    hadKo ? 'تم إلغاء اعتماد المجموعات وحذف شجرة الأدوار الإقصائية' : 'تم إلغاء اعتماد نتائج المجموعات',
  );
}

export function generateKnockout(t: Tournament): Tournament {
  const st = allStandings(t);
  const ko = buildBracket(st, t.settings.qualifiersPerGroup, t.settings.thirdPlaceMatch);
  return withLog(
    { ...t, matches: [...t.matches.filter((m) => m.stage !== 'knockout'), ...ko] },
    'تم توليد شجرة الأدوار الإقصائية',
  );
}

export function upsertTeam(t: Tournament, team: Team): Tournament {
  const exists = t.teams.some((x) => x.id === team.id);
  const teams = exists ? t.teams.map((x) => (x.id === team.id ? team : x)) : [...t.teams, team];
  return withLog({ ...t, teams }, exists ? `تعديل فريق: ${team.name}` : `إضافة فريق: ${team.name}`);
}

export function removeTeam(t: Tournament, id: string): Tournament {
  const name = teamName(t, id);
  return withLog(
    {
      ...t,
      teams: t.teams.filter((x) => x.id !== id),
      matches: t.matches.filter((m) => m.teamA !== id && m.teamB !== id),
    },
    `حذف فريق: ${name}`,
  );
}

export function nextMatches(t: Tournament, limit = 8): Match[] {
  const pending = t.matches.filter((m) => !isFinished(m) && m.teamA && m.teamB);
  const order = (m: Match) => (m.stage === 'knockout' ? 1000 + m.round : m.round);
  return pending
    .sort(
      (a, b) =>
        Number(b.status === 'playing') - Number(a.status === 'playing') ||
        order(a) - order(b) ||
        (a.table ?? 99) - (b.table ?? 99),
    )
    .slice(0, limit);
}
