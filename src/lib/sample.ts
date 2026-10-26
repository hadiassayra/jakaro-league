import type { Settings, Team, Tournament } from './types';
import { seededRandom } from './id';
import { isFinished } from './standings';
import {
  allStandings,
  generateKnockout,
  generateSchedule,
  lockGroups,
  newTournament,
  recordResult,
  withLog,
} from './tournament';

const SAMPLE: [string, string, string][] = [
  ['الصقور', 'أحمد سالم', 'خالد يوسف'],
  ['النمور', 'محمد علي', 'سعد ناصر'],
  ['الكرات الذهبية', 'فهد عبدالله', 'ماجد حسن'],
  ['أبطال الجاكرو', 'عمر خليل', 'يزن محمود'],
  ['الفرسان', 'راشد سعيد', 'بدر عادل'],
  ['النجوم', 'ليان أحمد', 'سارة فيصل'],
  ['الأسود', 'حمد مبارك', 'تركي سلمان'],
  ['العاصفة', 'نواف جاسم', 'مشعل فهد'],
  ['الملوك', 'عبدالرحمن زيد', 'حسين علي'],
  ['الشهب', 'نورة سعد', 'ريم خالد'],
  ['البرق', 'سلطان ماجد', 'فارس عمر'],
  ['الذيب', 'مازن طارق', 'إياد سامي'],
];

/** Demo tournament. stage: 'groups' = group stage in progress, 'knockout' = semis under way */
export function sampleTournament(stage: 'groups' | 'knockout', settings?: Settings): Tournament {
  const rand = seededRandom(stage === 'groups' ? 7 : 11);
  let t = newTournament(settings);
  t.settings.name = settings?.name ?? 'دوري جاكرو';
  const teams: Team[] = SAMPLE.map(([name, p1, p2], i) => ({
    id: `team_${i + 1}`,
    name,
    player1: p1,
    player2: p2,
    group: i % 2 === 0 ? 'A' : 'B',
  }));
  t = { ...t, teams };
  t = generateSchedule(t);

  const groupMatches = t.matches.filter((m) => m.stage === 'group');
  const toPlay = stage === 'groups' ? Math.round(groupMatches.length * 0.7) : groupMatches.length;
  // team "strength" so results look plausible
  const strength = new Map(teams.map((tm, i) => [tm.id, 1 - (i % 6) * 0.12 + rand() * 0.2]));
  let clock = Date.now() - 1000 * 60 * 60 * 3;
  groupMatches.slice(0, toPlay).forEach((m) => {
    const pa = strength.get(m.teamA!)!;
    const pb = strength.get(m.teamB!)!;
    const winner = rand() < pa / (pa + pb) ? m.teamA! : m.teamB!;
    const left = 1 + Math.floor(rand() * 8);
    t = recordResult(t, m.id, winner, left);
    clock += 1000 * 60 * 6;
    const at = clock;
    t = { ...t, matches: t.matches.map((x) => (x.id === m.id ? { ...x, finishedAt: at } : x)) };
  });

  if (stage === 'groups') {
    // a couple of matches "playing now"
    const pending = t.matches.filter((m) => !isFinished(m));
    t = {
      ...t,
      matches: t.matches.map((m) =>
        pending.slice(0, 2).some((p) => p.id === m.id)
          ? { ...m, status: 'playing', startedAt: Date.now() - 1000 * 60 * (4 + Math.round(rand() * 8)) }
          : m,
      ),
    };
    return withLog(t, 'تم تحميل بيانات تجريبية (مرحلة المجموعات)');
  }

  // settle any exact ties with a manual order so the bracket can be generated
  const st = allStandings(t);
  t = { ...t, tieOverrides: { A: st.A.map((r) => r.teamId), B: st.B.map((r) => r.teamId) } };
  t = lockGroups(t);
  t = generateKnockout(t);
  const playKo = (round: number, count: number) => {
    t.matches
      .filter((m) => m.stage === 'knockout' && !m.thirdPlace && m.round === round)
      .slice(0, count)
      .forEach((m) => {
        if (!m.teamA || !m.teamB) return;
        const winner = rand() < 0.5 ? m.teamA : m.teamB;
        t = recordResult(t, m.id, winner, 1 + Math.floor(rand() * 7));
      });
  };
  playKo(0, 4);
  playKo(1, 1);
  return withLog(t, 'تم تحميل بيانات تجريبية (الأدوار الإقصائية)');
}
