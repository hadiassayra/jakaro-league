import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '../lib/types';
import { useStore } from '../store/useStore';
import { isFinished } from '../lib/standings';
import { allStandings, nextMatches, teamName } from '../lib/tournament';
import { champion } from '../lib/knockout';
import { qualificationStatus } from '../lib/qualification';
import { Logo } from '../components/Logo';
import { MatchCard } from '../components/MatchCard';
import { ResultModal } from '../components/ResultModal';
import { StandingsTable, groupLabel } from '../components/StandingsTable';
import { SharePanel } from '../components/SharePanel';
import { Empty, SectionTitle, TeamMarble } from '../components/ui';
import { matchDay, matchDayRound } from '../lib/playDay';

export default function Dashboard() {
  const t = useStore((s) => s.t);
  const [open, setOpen] = useState<Match | null>(null);
  const group = t.matches.filter((m) => m.stage === 'group');
  const ko = t.matches.filter((m) => m.stage === 'knockout');
  const all = t.matches.filter((m) => m.teamA && m.teamB);
  const done = all.filter(isFinished).length;
  const playing = all.filter((m) => m.status === 'playing' && !isFinished(m)).length;
  const champ = champion(t.matches);
  const st = allStandings(t);
  const stage = champ ? 'انتهت البطولة' : ko.length ? 'الأدوار الإقصائية' : group.length ? 'دور المجموعات' : 'التحضير';
  const upcoming = nextMatches(t, 6);
  const currentDayMatches = t.matches.filter(m => t.currentPlayDay && matchDay(m) === t.currentPlayDay);
  const fixtures = currentDayMatches.length ? currentDayMatches : upcoming;
  const [matchView, setMatchView] = useState<'all' | 'playing' | 'upcoming' | 'finished'>('all');
  const visible = fixtures.filter(m => matchView === 'all' || (matchView === 'finished' ? isFinished(m) : !isFinished(m) && m.status === matchView));
  return (
    <div className="space-y-6">
      <section className="board overflow-hidden">
        <div className="flex flex-col items-center gap-4 p-5 sm:flex-row">
          <Logo src={t.settings.logo} className="h-16 w-auto max-w-[10rem] rounded-lg" />
          <div className="w-full flex-1 text-center sm:text-start">
            <p className="text-sm font-bold text-primary-ink">{stage}</p>
            <h1 className="text-3xl">{t.settings.name}</h1>
            <p className="text-sm text-ink/60">
              {t.teams.length} فريق · {done}/{all.length} مباراة منتهية
              {playing > 0 && ` · ${playing} تُلعب الآن`}
            </p>
            {all.length > 0 && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-label="تقدّم البطولة">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / all.length) * 100}%` }} />
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <Link to="/match-display" className="btn btn-accent px-6">عرض المباريات</Link>
            <button className="text-xs text-ink/60 hover:underline" onClick={() => window.open(`${window.location.pathname}#/match-display`, 'jakaro-matches', 'popup,width=1440,height=900')}>فتح المباريات في نافذة مستقلة ↗</button>
            <Link to="/show" className="btn btn-primary px-6">
              عرض النتائج
            </Link>
            <button
              className="text-xs text-ink/60 hover:text-ink hover:underline"
              onClick={() => window.open(`${window.location.pathname}#/show`, 'jakaro-show', 'popup,width=1280,height=720')}
            >
              فتح في نافذة منفصلة
            </button>
          </div>
        </div>
        {champ && (
          <div className="flex items-center justify-center gap-3 border-t border-ink/10 p-4 text-center">
            <span className="text-2xl">🏆</span>
            <TeamMarble teams={t.teams} id={champ} size={32} />
            <span className="font-display text-2xl">البطل: {teamName(t, champ)}</span>
          </div>
        )}
      </section>

      <div className="space-y-4">
        <section className="space-y-3">
          <SectionTitle rank="7" title="مركز المباريات" sub={currentDayMatches.length ? `يوم اللعب · ${new Date(t.currentPlayDay! + 'T12:00:00Z').toLocaleDateString('ar-PS', { timeZone: 'Asia/Hebron', weekday: 'long', day: 'numeric', month: 'long' })}` : 'المباريات الحالية والقادمة'} actions={<Link className="btn btn-ghost btn-sm" to="/matches">جدول المباريات ←</Link>} />
          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-ink/10" aria-label="حالة المباريات">
            {([['all', 'الكل'], ['playing', 'مباشر'], ['upcoming', 'القادمة'], ['finished', 'النتائج']] as const).map(([key, label]) => <button key={key} aria-pressed={matchView === key} onClick={() => setMatchView(key)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold ${matchView === key ? 'border-primary-ink text-primary-ink' : 'border-transparent text-ink/50'}`}>{label}</button>)}
          </div>
          {fixtures.length ? (
            <div className="space-y-6">
              {(currentDayMatches.length ? [1, 2] : [0]).map(slot => {
                const list = visible.filter(m => slot === 0 || matchDayRound(m) === slot).sort((a, b) => (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity));
                return <section key={slot}>
                  {slot > 0 && <div className="mb-3 flex items-center gap-3"><h3 className="text-xl">{slot === 1 ? 'الجولة الأولى' : 'الجولة الثانية'}</h3><span className="text-xs text-ink/50">{list.length} مباراة</span><span className="h-px flex-1 bg-ink/10" /></div>}
                  {list.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map(m => <MatchCard key={m.id} t={t} m={m} onOpen={setOpen} showRound />)}</div> : <Empty>لا توجد مباريات في هذا القسم.</Empty>}
                </section>;
              })}
            </div>
          ) : (
            <Empty action={group.length ? undefined : <Link className="btn btn-primary" to="/matches">توليد الجدول</Link>}>
              {group.length ? 'لا توجد مباريات متبقية حالياً' : 'لم يتم توليد جدول المباريات بعد'}
            </Empty>
          )}
        </section>

      </div>

      {group.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {(['A', 'B'] as const).map((g) => (
            <section key={g} className="board p-4">
              <SectionTitle rank={g === 'A' ? 'K' : '10'} title={groupLabel(g)} />
              <StandingsTable t={t} rows={st[g]} qual={qualificationStatus(t.teams, t.matches, g, t.settings.qualifiersPerGroup, st[g])} />
            </section>
          ))}
        </div>
      )}

      <section className="board p-5">
        <SectionTitle rank="5" title="المتابعة العامة" sub="رابط للقراءة فقط بدون أدوات الإدارة" actions={<Link className="btn btn-ghost btn-sm" to="/live">فتح العرض العام</Link>} />
        <details><summary className="cursor-pointer text-sm text-primary-ink">مشاركة رابط المتابعة</summary><div className="mt-4"><SharePanel t={t} /></div></details>
      </section>

      <ResultModal match={open} onClose={() => setOpen(null)} />
    </div>
  );
}
