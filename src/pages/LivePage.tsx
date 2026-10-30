import { useState } from 'react';
import { TournamentRules } from '../components/TournamentRules';
import { BackButton } from '../components/BackButton';
import { matchDay, matchDayRound } from '../lib/playDay';
import { Link } from 'react-router-dom';
import { useViewTournament } from '../sync/useSync';
import { useTheme } from '../components/useTheme';
import { allStandings } from '../lib/tournament';
import { qualificationStatus } from '../lib/qualification';
import { champion } from '../lib/knockout';
import { isFinished } from '../lib/standings';
import { teamName } from '../lib/tournament';
import { StandingsTable, groupLabel } from '../components/StandingsTable';
import { MatchCard } from '../components/MatchCard';
import { Bracket } from '../components/Bracket';
import { Logo } from '../components/Logo';
import { StatsView } from './StatsPage';
import { Empty, MarbleLoader, SectionTitle, TeamMarble } from '../components/ui';

type Tab = 'standings' | 'groupB' | 'day' | 'matches' | 'upcoming' | 'finished' | 'rules' | 'knockout' | 'stats';

export default function LivePage() {
  const { t, remote, status } = useViewTournament();
  useTheme(t?.settings);
  const [tab, setTab] = useState<Tab>('standings');
  if (!t)
    return (
      <div className="board-bg grid min-h-dvh place-items-center">
        <MarbleLoader label={status === 'error' ? 'تعذّر الاتصال — تحقق من الرابط' : 'جارٍ تحميل النتائج…'} />
      </div>
    );

  const st = allStandings(t);
  const hasKo = t.matches.some((m) => m.stage === 'knockout');
  const champ = champion(t.matches);
  const q = t.settings.qualifiersPerGroup;
  const query = window.location.hash.split('?')[1];
  const tabs: [Tab, string][] = [
    ['standings', 'نقاط المجموعة أ'],
    ['groupB', 'نقاط المجموعة ب'],
    ['day', 'يوم اللعب الحالي'],
    ['matches', 'المباريات ومواعيدها'],
    ['upcoming', 'المباريات الجاية'],
    ['finished', 'المباريات اللي انلعبت'],
    ['rules', 'تعليمات البطولة'],
    ...(hasKo ? ([['knockout', 'الإقصائيات']] as [Tab, string][]) : []),
    ['stats', 'الإحصائيات'],
  ];
  return (
    <div className="board-bg min-h-dvh pb-10">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
          <BackButton />
          <Logo src={t.settings.logo} className="h-11 w-auto max-w-[8rem] sm:h-12 sm:max-w-[10rem]" />
          <span className="truncate font-display text-xl sm:text-2xl">{t.settings.name}</span>
          <span className="chip ms-auto bg-ink/5 text-ink/80">
            <span className={`live-dot inline-block h-2 w-2 rounded-full ${remote ? (status === 'live' ? 'bg-m-green' : 'bg-m-yellow') : 'bg-loss'}`} />
            مباشر
          </span>
          <Link to={`/show${query ? `?${query}` : ''}`} className="btn btn-primary btn-sm hidden sm:inline-flex">
            وضع العرض
          </Link>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold whitespace-nowrap ${tab === k ? 'border-primary-ink text-primary-ink' : 'border-transparent text-ink/60 hover:text-ink'}`}
            >
              {l}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-5">
        {champ && (
          <div className="board flex items-center justify-center gap-3 border-2 border-accent p-4">
            <span className="text-4xl">🏆</span>
            <TeamMarble teams={t.teams} id={champ} size={40} />
            <span className="font-display text-3xl">البطل: {teamName(t, champ)}</span>
          </div>
        )}
        {tab === 'rules' && <TournamentRules settings={t.settings} />}
        {tab === 'day' && <section>
          <SectionTitle rank="7" title="مباريات يوم اللعب الحالي" sub={t.currentPlayDay ?? 'لم يتم اختيار يوم اللعب بعد'} />
          {([1, 2] as const).map(slot => <section key={slot} className="mb-6">
            <h3 className="mb-3 text-2xl">{slot === 1 ? 'الجولة الأولى' : 'الجولة الثانية'}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {t.matches.filter(m => t.currentPlayDay && matchDay(m) === t.currentPlayDay && matchDayRound(m) === slot).map(m => <MatchCard key={m.id} t={t} m={m} showRound />)}
            </div>
            {!t.matches.some(m => t.currentPlayDay && matchDay(m) === t.currentPlayDay && matchDayRound(m) === slot) && <Empty>لم تُحدد مباريات لهذه الجولة بعد.</Empty>}
          </section>)}
          {!t.matches.some(m => t.currentPlayDay && matchDay(m) === t.currentPlayDay) && <Empty>لم تُحدد مباريات لهذا اليوم بعد.</Empty>}
        </section>}
        {(tab === 'upcoming' || tab === 'finished' || tab === 'matches') && (
          <section>
            <SectionTitle rank="7" title={tab === 'upcoming' ? 'المباريات الجاية' : tab === 'finished' ? 'المباريات اللي انلعبت' : 'المباريات ومواعيدها'} />
            <div className="grid gap-3 sm:grid-cols-2">
              {t.matches.filter(m => tab === 'matches' || (tab === 'finished' ? isFinished(m) : !isFinished(m) && m.status === 'upcoming')).sort((a, b) => tab === 'finished' ? (b.finishedAt ?? 0) - (a.finishedAt ?? 0) : (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity) || a.round - b.round).map(m => <MatchCard key={m.id} t={t} m={m} showRound />)}
            </div>
            {!t.matches.some(m => tab === 'matches' || (tab === 'finished' ? isFinished(m) : !isFinished(m) && m.status === 'upcoming')) && <Empty>لا توجد مباريات في هذا القسم.</Empty>}
          </section>
        )}
        {(tab === 'standings' || tab === 'groupB') &&
          (tab === 'standings' ? ['A'] as const : ['B'] as const).map((g) => (
            <section key={g} className="board p-4">
              <SectionTitle rank={g === 'A' ? 'K' : '10'} title={groupLabel(g)} sub={`يتأهل أول ${q}`} />
              {st[g].length ? (
                <StandingsTable t={t} rows={st[g]} qual={qualificationStatus(t.teams, t.matches, g, q, st[g])} linkTeams={false} />
              ) : (
                <Empty>لا توجد فرق بعد</Empty>
              )}
            </section>
          ))}
        {tab === 'knockout' && (
          <section className="board p-4">
            <Bracket t={t} />
          </section>
        )}
        {tab === 'stats' && <StatsView t={t} links={false} />}
      </main>
    </div>
  );
}
